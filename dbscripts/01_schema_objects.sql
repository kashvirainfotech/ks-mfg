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
                                                CHECK (transaction_type IN ('PUTAWAY_INWARD', 'QUARANTINE_HOLD', 'QC_RELEASE', 'INTERNAL_TRANSFER', 'PRODUCTION_ISSUE', 'SCRAP_WRITE_OFF', 'ADJUSTMENT', 'SALES_DISPATCH', 'SALES_RETURN')),
    reference_doc_type          VARCHAR(50)     NOT NULL
                                                CHECK (reference_doc_type IN ('GRN', 'QC_INSPECTION', 'PUTAWAY', 'TRANSFER', 'WORK_ORDER', 'ADJUSTMENT', 'DELIVERY_CHALLAN', 'SALES_RETURN')),
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


-- ============================================================================
-- 42. MANUFACTURING BILL OF MATERIALS (BOM) HEADER (tbl_mfg_bom_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_bom_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_bom_header (
    bom_id                      BIGINT          PRIMARY KEY DEFAULT nextval('seq_bom_id'),
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    bom_code                    VARCHAR(50)     NOT NULL,
    bom_name                    VARCHAR(150)    NOT NULL,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    output_qty                  NUMERIC(14, 3)  NOT NULL DEFAULT 1.000,
    version_no                  VARCHAR(20)     NOT NULL DEFAULT '1.0',
    bom_type                    VARCHAR(30)     NOT NULL DEFAULT 'MANUFACTURING'
                                                CHECK (bom_type IN ('MANUFACTURING', 'SUBCONTRACTING', 'ASSEMBLY', 'DISASSEMBLY', 'PROTOTYPE')),
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'ACTIVE', 'OBSOLETE', 'UNDER_REVIEW')),
    is_default                  BOOLEAN         NOT NULL DEFAULT TRUE,
    effective_from              DATE            NOT NULL DEFAULT CURRENT_DATE,
    effective_to                DATE,
    routing_id                  BIGINT,
    total_material_cost         NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_labour_cost           NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_overhead_cost         NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_byproduct_recovery    NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    net_unit_cost               NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    approved_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    approved_date               TIMESTAMPTZ,
    approval_remarks            VARCHAR(350),
    remarks                     VARCHAR(350),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_mfg_bom_code UNIQUE (comp_id, bom_code),
    CONSTRAINT uq_mfg_bom_version UNIQUE (comp_id, item_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_mfg_bom_header_item ON tbl_mfg_bom_header (comp_id, item_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_bom_header_status ON tbl_mfg_bom_header (comp_id, status, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_bom_header_type ON tbl_mfg_bom_header (comp_id, bom_type);


-- ============================================================================
-- 43. MANUFACTURING BOM COMPONENTS & SCRAP FACTORS (tbl_mfg_bom_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_bom_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_bom_item (
    bom_item_id                 BIGINT          PRIMARY KEY DEFAULT nextval('seq_bom_item_id'),
    bom_id                      BIGINT          NOT NULL REFERENCES tbl_mfg_bom_header(bom_id) ON DELETE CASCADE,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_description            VARCHAR(250),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    quantity                    NUMERIC(14, 4)  NOT NULL DEFAULT 1.0000,
    scrap_factor_percent        NUMERIC(6, 2)   NOT NULL DEFAULT 0.00,
    gross_quantity              NUMERIC(14, 4)  NOT NULL DEFAULT 1.0000,
    child_bom_id                BIGINT          REFERENCES tbl_mfg_bom_header(bom_id),
    unit_cost                   NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    line_cost                   NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    source_type                 VARCHAR(30)     NOT NULL DEFAULT 'PURCHASED'
                                                CHECK (source_type IN ('PURCHASED', 'MANUFACTURED', 'SUBCONTRACTED', 'CUSTOMER_SUPPLIED')),
    operation_seq               INT             NOT NULL DEFAULT 10,
    operation_name              VARCHAR(100)    DEFAULT 'Component Assembly',
    is_critical                 BOOLEAN         NOT NULL DEFAULT FALSE,
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

CREATE INDEX IF NOT EXISTS idx_mfg_bom_item_bom ON tbl_mfg_bom_item (bom_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_bom_item_item ON tbl_mfg_bom_item (item_id);
CREATE INDEX IF NOT EXISTS idx_mfg_bom_item_child_bom ON tbl_mfg_bom_item (child_bom_id);


-- ============================================================================
-- 44. MANUFACTURING BOM CO-PRODUCTS & RECOVERABLE SCRAP (tbl_mfg_bom_byproduct)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_bom_byproduct_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_bom_byproduct (
    bom_byproduct_id            BIGINT          PRIMARY KEY DEFAULT nextval('seq_bom_byproduct_id'),
    bom_id                      BIGINT          NOT NULL REFERENCES tbl_mfg_bom_header(bom_id) ON DELETE CASCADE,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_description            VARCHAR(250),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    quantity                    NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    product_type                VARCHAR(30)     NOT NULL DEFAULT 'RECOVERABLE_SCRAP'
                                                CHECK (product_type IN ('CO_PRODUCT', 'BY_PRODUCT', 'RECOVERABLE_SCRAP', 'HAZARDOUS_WASTE')),
    cost_allocation_percent     NUMERIC(6, 2)   NOT NULL DEFAULT 0.00,
    estimated_recovery_rate     NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    estimated_recovery_value    NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
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

CREATE INDEX IF NOT EXISTS idx_mfg_bom_byproduct_bom ON tbl_mfg_bom_byproduct (bom_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_bom_byproduct_item ON tbl_mfg_bom_byproduct (item_id);


-- ============================================================================
-- 45. FACTORY SHIFT MASTER (tbl_mfg_shift)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_shift_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_shift (
    shift_id                    BIGINT          PRIMARY KEY DEFAULT nextval('seq_shift_id'),
    shift_code                  VARCHAR(30)     NOT NULL,
    shift_name                  VARCHAR(100)    NOT NULL,
    start_time                  TIME            NOT NULL,
    end_time                    TIME            NOT NULL,
    break_duration_mins         INT             NOT NULL DEFAULT 30,
    effective_working_hours     NUMERIC(5, 2)   NOT NULL DEFAULT 8.00,
    is_night_shift              BOOLEAN         NOT NULL DEFAULT FALSE,
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
    CONSTRAINT uq_mfg_shift_code UNIQUE (comp_id, branch_id, shift_code)
);

CREATE INDEX IF NOT EXISTS idx_mfg_shift_comp_branch ON tbl_mfg_shift (comp_id, branch_id, is_active);


-- ============================================================================
-- 46. MANUFACTURING WORK CENTERS & PRODUCTION CELLS (tbl_mfg_work_center)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_work_center_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_work_center (
    work_center_id              BIGINT          PRIMARY KEY DEFAULT nextval('seq_work_center_id'),
    work_center_code            VARCHAR(50)     NOT NULL,
    work_center_name            VARCHAR(250)    NOT NULL,
    work_center_type            VARCHAR(30)     NOT NULL DEFAULT 'MACHINE'
                                                CHECK (work_center_type IN ('MACHINE', 'LINE_ASSEMBLY', 'MANUAL', 'FURNACE', 'TEST_BENCH', 'SUBCONTRACTOR')),
    dept_id                     BIGINT          REFERENCES tbl_hr_department(dept_id),
    location_desc               VARCHAR(200),
    capacity_per_day_hours      NUMERIC(6, 2)   NOT NULL DEFAULT 8.00,
    efficiency_percent          NUMERIC(5, 2)   NOT NULL DEFAULT 85.00,
    capacity_uom                VARCHAR(20)     NOT NULL DEFAULT 'HOURS',
    cost_per_hour               NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    labour_cost_per_hour        NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    overhead_cost_per_hour      NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_hourly_rate           NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    status                      VARCHAR(30)     NOT NULL DEFAULT 'ACTIVE'
                                                CHECK (status IN ('ACTIVE', 'UNDER_MAINTENANCE', 'INACTIVE')),
    remarks                     VARCHAR(350),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_mfg_work_center_code UNIQUE (comp_id, branch_id, work_center_code)
);

CREATE INDEX IF NOT EXISTS idx_mfg_work_center_comp ON tbl_mfg_work_center (comp_id, branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_work_center_status ON tbl_mfg_work_center (comp_id, status);
CREATE INDEX IF NOT EXISTS idx_mfg_work_center_type ON tbl_mfg_work_center (comp_id, work_center_type);


-- ============================================================================
-- 47. WORK CENTER MACHINES & ASSETS (tbl_mfg_work_center_machine)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_wc_machine_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_work_center_machine (
    wc_machine_id               BIGINT          PRIMARY KEY DEFAULT nextval('seq_wc_machine_id'),
    work_center_id              BIGINT          NOT NULL REFERENCES tbl_mfg_work_center(work_center_id) ON DELETE CASCADE,
    machine_code                VARCHAR(50)     NOT NULL,
    machine_name                VARCHAR(200)    NOT NULL,
    model_no                    VARCHAR(100),
    serial_no                   VARCHAR(100),
    manufacturer                VARCHAR(150),
    installation_date           DATE,
    warranty_expiry_date        DATE,
    power_rating_kw             NUMERIC(8, 2)   DEFAULT 0.00,
    status                      VARCHAR(30)     NOT NULL DEFAULT 'OPERATIONAL'
                                                CHECK (status IN ('OPERATIONAL', 'BREAKDOWN', 'STANDBY', 'DECOMMISSIONED')),
    last_maintenance_date       DATE,
    next_maintenance_due        DATE,
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
    CONSTRAINT uq_mfg_wc_machine_code UNIQUE (comp_id, branch_id, machine_code)
);

CREATE INDEX IF NOT EXISTS idx_mfg_wc_machine_wc ON tbl_mfg_work_center_machine (work_center_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_wc_machine_status ON tbl_mfg_work_center_machine (comp_id, status);


-- ============================================================================
-- 48. WORK CENTER SHIFT ALLOCATIONS (tbl_mfg_work_center_shift)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_wc_shift_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_work_center_shift (
    wc_shift_id                 BIGINT          PRIMARY KEY DEFAULT nextval('seq_wc_shift_id'),
    work_center_id              BIGINT          NOT NULL REFERENCES tbl_mfg_work_center(work_center_id) ON DELETE CASCADE,
    shift_id                    BIGINT          NOT NULL REFERENCES tbl_mfg_shift(shift_id),
    days_of_week                VARCHAR(50)     DEFAULT 'MON,TUE,WED,THU,FRI,SAT',
    operator_count              INT             NOT NULL DEFAULT 1,
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
    CONSTRAINT uq_mfg_wc_shift UNIQUE (work_center_id, shift_id)
);

CREATE INDEX IF NOT EXISTS idx_mfg_wc_shift_wc ON tbl_mfg_work_center_shift (work_center_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_wc_shift_shift ON tbl_mfg_work_center_shift (shift_id);

-- ============================================================================
-- 49. MANUFACTURING ROUTING HEADER (tbl_mfg_routing_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_routing_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_routing_header (
    routing_id                  BIGINT          PRIMARY KEY DEFAULT nextval('seq_routing_id'),
    routing_code                VARCHAR(50)     NOT NULL,
    routing_name                VARCHAR(200)    NOT NULL,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    version_no                  VARCHAR(20)     NOT NULL DEFAULT '1.0',
    status                      VARCHAR(30)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'ACTIVE', 'OBSOLETE', 'UNDER_REVIEW')),
    is_default                  BOOLEAN         NOT NULL DEFAULT TRUE,
    effective_from              DATE            NOT NULL DEFAULT CURRENT_DATE,
    effective_to                DATE,
    batch_size                  NUMERIC(14, 3)  NOT NULL DEFAULT 1.000,
    total_setup_time_mins       NUMERIC(10, 2)  NOT NULL DEFAULT 0.00,
    total_run_time_mins         NUMERIC(10, 2)  NOT NULL DEFAULT 0.00,
    total_lead_time_days        NUMERIC(6, 2)   NOT NULL DEFAULT 1.00,
    total_machine_cost          NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_labor_cost            NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_overhead_cost         NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_cost_per_unit         NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    approved_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    approved_date               TIMESTAMPTZ,
    approval_remarks            VARCHAR(350),
    remarks                     VARCHAR(350),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_mfg_routing_code UNIQUE (comp_id, routing_code),
    CONSTRAINT uq_mfg_routing_version UNIQUE (comp_id, item_id, version_no)
);

CREATE INDEX IF NOT EXISTS idx_mfg_routing_header_comp ON tbl_mfg_routing_header (comp_id, branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_routing_header_item ON tbl_mfg_routing_header (comp_id, item_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_routing_header_status ON tbl_mfg_routing_header (comp_id, status);


-- ============================================================================
-- 50. MANUFACTURING ROUTING OPERATIONS (tbl_mfg_routing_operation)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_routing_op_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_routing_operation (
    routing_op_id               BIGINT          PRIMARY KEY DEFAULT nextval('seq_routing_op_id'),
    routing_id                  BIGINT          NOT NULL REFERENCES tbl_mfg_routing_header(routing_id) ON DELETE CASCADE,
    op_sequence                 INT             NOT NULL DEFAULT 10,
    op_code                     VARCHAR(30)     NOT NULL,
    op_name                     VARCHAR(200)    NOT NULL,
    work_center_id              BIGINT          NOT NULL REFERENCES tbl_mfg_work_center(work_center_id),
    machine_id                  BIGINT          REFERENCES tbl_mfg_work_center_machine(wc_machine_id),
    setup_time_mins             NUMERIC(10, 2)  NOT NULL DEFAULT 0.00,
    run_time_mins               NUMERIC(10, 2)  NOT NULL DEFAULT 0.00,
    overlap_percent             NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    machine_hourly_rate         NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    labor_hourly_rate           NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    overhead_hourly_rate        NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_hourly_rate           NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    machine_cost_per_unit       NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    labor_cost_per_unit         NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    overhead_cost_per_unit      NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    total_cost_per_unit         NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    tooling_description         VARCHAR(300),
    fixture_no                  VARCHAR(100),
    is_inspection_required      BOOLEAN         NOT NULL DEFAULT FALSE,
    qc_checkpoints              VARCHAR(350),
    is_subcontracted            BOOLEAN         NOT NULL DEFAULT FALSE,
    subcontract_vendor_id       BIGINT          REFERENCES tbl_crm_party(party_id),
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
    CONSTRAINT uq_mfg_routing_op_seq UNIQUE (routing_id, op_sequence)
);

CREATE INDEX IF NOT EXISTS idx_mfg_routing_op_routing ON tbl_mfg_routing_operation (routing_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_routing_op_wc ON tbl_mfg_routing_operation (work_center_id);

-- ============================================================================
-- 51. MATERIAL REQUIREMENTS PLANNING RUN (tbl_mfg_mrp_run_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_mrp_run_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_mrp_run_header (
    mrp_run_id                 BIGINT          PRIMARY KEY DEFAULT nextval('seq_mrp_run_id'),
    mrp_run_no                 VARCHAR(50)     NOT NULL,
    run_date                   TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    planning_horizon_days      INT             NOT NULL DEFAULT 30,
    demand_source              VARCHAR(30)     NOT NULL DEFAULT 'BUFFER_DEFICIT'
                                               CHECK (demand_source IN ('ALL', 'BUFFER_DEFICIT', 'SALES_ORDERS', 'MANUAL_FORECAST')),
    status                     VARCHAR(25)     NOT NULL DEFAULT 'COMPLETED'
                                               CHECK (status IN ('DRAFT', 'RUNNING', 'COMPLETED', 'RELEASED', 'CANCELLED')),
    total_items_analyzed       INT             NOT NULL DEFAULT 0,
    total_planned_orders       INT             NOT NULL DEFAULT 0,
    total_planned_buy_qty      NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    total_planned_make_qty     NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    total_estimated_spend      NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    execution_time_ms          INT             DEFAULT 0,
    run_by                     BIGINT          REFERENCES tbl_sec_user(user_id),
    remarks                    VARCHAR(350),
    is_active                  BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                    BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                  BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                   BIGINT,
    created_by                 BIGINT          NOT NULL,
    created_date               TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                 BIGINT,
    updated_date               TIMESTAMPTZ,
    CONSTRAINT uq_mfg_mrp_run_no UNIQUE (comp_id, branch_id, mrp_run_no)
);

CREATE INDEX IF NOT EXISTS idx_mfg_mrp_run_comp_branch ON tbl_mfg_mrp_run_header (comp_id, branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_mrp_run_date ON tbl_mfg_mrp_run_header (run_date);
CREATE INDEX IF NOT EXISTS idx_mfg_mrp_run_status ON tbl_mfg_mrp_run_header (status);


-- ============================================================================
-- 52. MRP GROSS-TO-NET PLANNED ORDERS (tbl_mfg_mrp_planned_order)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_mrp_planned_order_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_mrp_planned_order (
    planned_order_id            BIGINT          PRIMARY KEY DEFAULT nextval('seq_mrp_planned_order_id'),
    mrp_run_id                  BIGINT          NOT NULL REFERENCES tbl_mfg_mrp_run_header(mrp_run_id) ON DELETE CASCADE,
    planned_order_no            VARCHAR(50)     NOT NULL,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    bom_id                      BIGINT          REFERENCES tbl_mfg_bom_header(bom_id),
    routing_id                  BIGINT          REFERENCES tbl_mfg_routing_header(routing_id),
    order_type                  VARCHAR(25)     NOT NULL DEFAULT 'BUY'
                                                CHECK (order_type IN ('MAKE', 'BUY', 'SUBCONTRACT')),
    source_demand_type          VARCHAR(35)     NOT NULL DEFAULT 'BUFFER_DEFICIT'
                                                CHECK (source_demand_type IN ('BUFFER_DEFICIT', 'PARENT_BOM_EXPLOSION', 'SALES_ORDER', 'MANUAL_FORECAST')),
    parent_planned_order_id     BIGINT          REFERENCES tbl_mfg_mrp_planned_order(planned_order_id) ON DELETE SET NULL,
    bom_level                   INT             NOT NULL DEFAULT 0,
    gross_requirement_qty       NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    on_hand_stock_qty           NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    scheduled_receipts_qty      NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    safety_stock_qty            NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    net_requirement_qty         NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    planned_order_qty           NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    lead_time_days              INT             NOT NULL DEFAULT 1,
    required_by_date            DATE            NOT NULL,
    order_release_date          DATE            NOT NULL,
    estimated_unit_cost         NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    estimated_total_cost        NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    status                      VARCHAR(25)     NOT NULL DEFAULT 'SUGGESTED'
                                                CHECK (status IN ('SUGGESTED', 'CONFIRMED', 'CONVERTED_TO_PR', 'CONVERTED_TO_WO', 'CANCELLED')),
    converted_pr_id             BIGINT          REFERENCES tbl_pr_header(pr_id),
    converted_wo_id             BIGINT,
    remarks                     VARCHAR(350),
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

CREATE INDEX IF NOT EXISTS idx_mfg_mrp_plan_run ON tbl_mfg_mrp_planned_order (mrp_run_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_mrp_plan_item ON tbl_mfg_mrp_planned_order (item_id);
CREATE INDEX IF NOT EXISTS idx_mfg_mrp_plan_dates ON tbl_mfg_mrp_planned_order (order_release_date, required_by_date);
CREATE INDEX IF NOT EXISTS idx_mfg_mrp_plan_type ON tbl_mfg_mrp_planned_order (order_type, status);

-- ============================================================================
-- 53. MANUFACTURING WORK ORDER HEADER (tbl_mfg_wo_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_wo_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_wo_header (
    wo_id                       BIGINT          PRIMARY KEY DEFAULT nextval('seq_wo_id'),
    wo_no                       VARCHAR(50)     NOT NULL, -- e.g. 'WO-AHM-2627-0001'
    wo_date                     DATE            NOT NULL,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    bom_id                      BIGINT          REFERENCES tbl_mfg_bom_header(bom_id),
    routing_id                  BIGINT          REFERENCES tbl_mfg_routing_header(routing_id),
    target_warehouse_id         BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    wip_warehouse_id            BIGINT          REFERENCES tbl_inv_warehouse(warehouse_id),
    planned_qty                 NUMERIC(14, 3)  NOT NULL,
    completed_qty               NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    scrapped_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    scheduled_start_date        DATE            NOT NULL,
    scheduled_end_date          DATE            NOT NULL,
    actual_start_date           TIMESTAMPTZ,
    actual_end_date             TIMESTAMPTZ,
    priority                    VARCHAR(20)     NOT NULL DEFAULT 'MEDIUM'
                                                CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL_URGENT')),
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED')),
    sales_order_id              BIGINT,
    mrp_planned_order_id        BIGINT          REFERENCES tbl_mfg_mrp_planned_order(planned_order_id),
    batch_no                    VARCHAR(100),   -- Shopfloor production lot / melt batch
    estimated_material_cost     NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    estimated_operation_cost    NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    estimated_total_cost        NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    actual_material_cost        NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    actual_operation_cost       NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    actual_total_cost           NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    released_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    released_date               TIMESTAMPTZ,
    remarks                     VARCHAR(350),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_mfg_wo_no UNIQUE (comp_id, branch_id, wo_no)
);

CREATE INDEX IF NOT EXISTS idx_mfg_wo_comp_branch ON tbl_mfg_wo_header (comp_id, branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_wo_item ON tbl_mfg_wo_header (item_id);
CREATE INDEX IF NOT EXISTS idx_mfg_wo_status ON tbl_mfg_wo_header (status);
CREATE INDEX IF NOT EXISTS idx_mfg_wo_dates ON tbl_mfg_wo_header (scheduled_start_date, scheduled_end_date);
CREATE INDEX IF NOT EXISTS idx_mfg_wo_mrp ON tbl_mfg_wo_header (mrp_planned_order_id);


-- ============================================================================
-- 54. WORK ORDER BOM COMPONENT SNAPSHOT (tbl_mfg_wo_bom_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_wo_bom_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_wo_bom_item (
    wo_bom_item_id              BIGINT          PRIMARY KEY DEFAULT nextval('seq_wo_bom_item_id'),
    wo_id                       BIGINT          NOT NULL REFERENCES tbl_mfg_wo_header(wo_id) ON DELETE CASCADE,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_description            VARCHAR(250),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    standard_qty_per_unit       NUMERIC(14, 4)  NOT NULL,
    scrap_factor_percent        NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    required_qty                NUMERIC(14, 3)  NOT NULL,
    issued_qty                  NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    consumed_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    returned_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    unit_cost                   NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    estimated_cost              NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    actual_cost                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    source_type                 VARCHAR(25)     NOT NULL DEFAULT 'PURCHASED'
                                                CHECK (source_type IN ('PURCHASED', 'MANUFACTURED', 'SUBCONTRACT')),
    operation_seq               INT,
    is_critical                 BOOLEAN         NOT NULL DEFAULT FALSE,
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
    CONSTRAINT uq_mfg_wo_bom_item UNIQUE (wo_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_mfg_wo_bom_wo ON tbl_mfg_wo_bom_item (wo_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_wo_bom_item ON tbl_mfg_wo_bom_item (item_id);


-- ============================================================================
-- 55. WORK ORDER ROUTING OPERATIONS SNAPSHOT (tbl_mfg_wo_routing_op)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_wo_routing_op_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_wo_routing_op (
    wo_routing_op_id            BIGINT          PRIMARY KEY DEFAULT nextval('seq_wo_routing_op_id'),
    wo_id                       BIGINT          NOT NULL REFERENCES tbl_mfg_wo_header(wo_id) ON DELETE CASCADE,
    op_sequence                 INT             NOT NULL,
    op_code                     VARCHAR(30)     NOT NULL,
    op_name                     VARCHAR(200)    NOT NULL,
    work_center_id              BIGINT          NOT NULL REFERENCES tbl_mfg_work_center(work_center_id),
    machine_id                  BIGINT          REFERENCES tbl_mfg_work_center_machine(wc_machine_id),
    planned_setup_time_mins     NUMERIC(10, 2)  NOT NULL DEFAULT 0.00,
    planned_run_time_mins       NUMERIC(10, 2)  NOT NULL DEFAULT 0.00,
    actual_setup_time_mins      NUMERIC(10, 2)  NOT NULL DEFAULT 0.00,
    actual_run_time_mins        NUMERIC(10, 2)  NOT NULL DEFAULT 0.00,
    planned_cost                NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    actual_cost                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    planned_qty                 NUMERIC(14, 3)  NOT NULL,
    completed_qty               NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    scrapped_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    rework_qty                  NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    status                      VARCHAR(25)     NOT NULL DEFAULT 'PENDING'
                                                CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'SKIPPED')),
    scheduled_start_date        DATE,
    scheduled_end_date          DATE,
    is_inspection_required      BOOLEAN         NOT NULL DEFAULT FALSE,
    is_subcontracted            BOOLEAN         NOT NULL DEFAULT FALSE,
    subcontract_vendor_id       BIGINT          REFERENCES tbl_crm_party(party_id),
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
    CONSTRAINT uq_mfg_wo_op_seq UNIQUE (wo_id, op_sequence)
);

CREATE INDEX IF NOT EXISTS idx_mfg_wo_routing_wo ON tbl_mfg_wo_routing_op (wo_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_wo_routing_wc ON tbl_mfg_wo_routing_op (work_center_id);
CREATE INDEX IF NOT EXISTS idx_mfg_wo_routing_status ON tbl_mfg_wo_routing_op (status);


-- ============================================================================
-- 56. SHOPFLOOR MATERIAL ISSUE HEADER (tbl_mfg_material_issue_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_material_issue_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_material_issue_header (
    issue_id                    BIGINT          PRIMARY KEY DEFAULT nextval('seq_material_issue_id'),
    issue_no                    VARCHAR(50)     NOT NULL,
    issue_date                  DATE            NOT NULL DEFAULT CURRENT_DATE,
    wo_id                       BIGINT          NOT NULL REFERENCES tbl_mfg_wo_header(wo_id),
    issue_type                  VARCHAR(30)     NOT NULL DEFAULT 'STANDARD_ISSUE'
                                                CHECK (issue_type IN ('STANDARD_ISSUE', 'RETURN_TO_STORE', 'SCRAP_ADJUSTMENT', 'LINESIDE_TRANSFER')),
    from_warehouse_id           BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    to_warehouse_id             BIGINT          REFERENCES tbl_inv_warehouse(warehouse_id),
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'SUBMITTED', 'POSTED', 'CANCELLED')),
    total_items                 INT             NOT NULL DEFAULT 0,
    total_quantity              NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    total_cost                  NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    issued_by                   BIGINT          REFERENCES tbl_sec_user(user_id),
    received_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    remarks                     VARCHAR(400),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_mfg_material_issue_no UNIQUE (comp_id, branch_id, issue_no)
);

CREATE INDEX IF NOT EXISTS idx_mfg_material_issue_comp_branch ON tbl_mfg_material_issue_header (comp_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_mfg_material_issue_wo ON tbl_mfg_material_issue_header (wo_id);
CREATE INDEX IF NOT EXISTS idx_mfg_material_issue_status ON tbl_mfg_material_issue_header (status);
CREATE INDEX IF NOT EXISTS idx_mfg_material_issue_date ON tbl_mfg_material_issue_header (issue_date);


-- ============================================================================
-- 57. SHOPFLOOR MATERIAL ISSUE ITEMS (tbl_mfg_material_issue_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_material_issue_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_material_issue_item (
    issue_item_id               BIGINT          PRIMARY KEY DEFAULT nextval('seq_material_issue_item_id'),
    issue_id                    BIGINT          NOT NULL REFERENCES tbl_mfg_material_issue_header(issue_id) ON DELETE CASCADE,
    wo_bom_item_id              BIGINT          REFERENCES tbl_mfg_wo_bom_item(wo_bom_item_id),
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    required_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    previously_issued_qty       NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    issue_qty                   NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    unit_cost                   NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    total_cost                  NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
    bin_location                VARCHAR(60),
    remarks                     VARCHAR(255),
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

CREATE INDEX IF NOT EXISTS idx_mfg_mi_item_issue ON tbl_mfg_material_issue_item (issue_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_mi_item_item ON tbl_mfg_material_issue_item (item_id);
CREATE INDEX IF NOT EXISTS idx_mfg_mi_item_wo_bom ON tbl_mfg_material_issue_item (wo_bom_item_id);




-- ============================================================================
-- 58. PRODUCTION JOB CARDS (tbl_mfg_job_card)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_job_card_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_job_card (
    job_card_id                 BIGINT          PRIMARY KEY DEFAULT nextval('seq_job_card_id'),
    job_card_no                 VARCHAR(50)     NOT NULL,
    job_card_date               DATE            NOT NULL DEFAULT CURRENT_DATE,
    wo_id                       BIGINT          NOT NULL REFERENCES tbl_mfg_wo_header(wo_id),
    wo_routing_op_id            BIGINT          NOT NULL REFERENCES tbl_mfg_wo_routing_op(wo_routing_op_id),
    op_sequence                 INT             NOT NULL,
    op_code                     VARCHAR(50)     NOT NULL,
    op_name                     VARCHAR(200)    NOT NULL,
    work_center_id              BIGINT          NOT NULL REFERENCES tbl_mfg_work_center(work_center_id),
    machine_id                  BIGINT          REFERENCES tbl_mfg_work_center_machine(wc_machine_id),
    assigned_operator_id        BIGINT          REFERENCES tbl_sec_user(user_id),
    planned_qty                 NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    input_qty                   NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    completed_qty               NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    scrapped_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    rework_qty                  NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    status                      VARCHAR(25)     NOT NULL DEFAULT 'PENDING'
                                                CHECK (status IN ('PENDING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED')),
    scheduled_start_date        DATE,
    scheduled_end_date          DATE,
    actual_start_time           TIMESTAMPTZ,
    actual_end_time             TIMESTAMPTZ,
    planned_setup_mins          NUMERIC(10, 2)  NOT NULL DEFAULT 0.00,
    planned_run_mins            NUMERIC(10, 2)  NOT NULL DEFAULT 0.00,
    actual_setup_mins           NUMERIC(10, 2)  NOT NULL DEFAULT 0.00,
    actual_run_mins             NUMERIC(10, 2)  NOT NULL DEFAULT 0.00,
    downtime_mins               NUMERIC(10, 2)  NOT NULL DEFAULT 0.00,
    downtime_reason             VARCHAR(250),
    hourly_rate                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    actual_cost                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    is_inspection_required      BOOLEAN         NOT NULL DEFAULT FALSE,
    in_process_qc_status        VARCHAR(30)     NOT NULL DEFAULT 'NA'
                                                CHECK (in_process_qc_status IN ('NA', 'PENDING', 'INSPECTION_IN_PROGRESS', 'ACCEPTED', 'REJECTED', 'DEVIATION_ACCEPTED')),
    qc_inspector_id             BIGINT          REFERENCES tbl_sec_user(user_id),
    qc_inspected_at             TIMESTAMPTZ,
    qc_sample_size              INT             DEFAULT 0,
    qc_accepted_qty             NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    qc_rejected_qty             NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    qc_remarks                  VARCHAR(400),
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
    remarks                     VARCHAR(400),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_mfg_job_card_no UNIQUE (comp_id, branch_id, job_card_no)
);

CREATE INDEX IF NOT EXISTS idx_mfg_job_card_comp_branch ON tbl_mfg_job_card (comp_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_mfg_job_card_wo ON tbl_mfg_job_card (wo_id);
CREATE INDEX IF NOT EXISTS idx_mfg_job_card_wo_op ON tbl_mfg_job_card (wo_routing_op_id);
CREATE INDEX IF NOT EXISTS idx_mfg_job_card_wc ON tbl_mfg_job_card (work_center_id);
CREATE INDEX IF NOT EXISTS idx_mfg_job_card_status ON tbl_mfg_job_card (status);
CREATE INDEX IF NOT EXISTS idx_mfg_job_card_qc ON tbl_mfg_job_card (in_process_qc_status);


-- ============================================================================
-- 59. PRODUCTION JOB CARD TIME & OUTPUT LOGS (tbl_mfg_job_card_time_log)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_job_card_time_log_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_job_card_time_log (
    log_id                      BIGINT          PRIMARY KEY DEFAULT nextval('seq_job_card_time_log_id'),
    job_card_id                 BIGINT          NOT NULL REFERENCES tbl_mfg_job_card(job_card_id) ON DELETE CASCADE,
    operator_id                 BIGINT          REFERENCES tbl_sec_user(user_id),
    machine_id                  BIGINT          REFERENCES tbl_mfg_work_center_machine(wc_machine_id),
    start_time                  TIMESTAMPTZ     NOT NULL,
    end_time                    TIMESTAMPTZ,
    setup_mins                  NUMERIC(8, 2)   NOT NULL DEFAULT 0.00,
    run_mins                    NUMERIC(8, 2)   NOT NULL DEFAULT 0.00,
    downtime_mins               NUMERIC(8, 2)   NOT NULL DEFAULT 0.00,
    downtime_reason             VARCHAR(250),
    completed_qty               NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    scrapped_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    rework_qty                  NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
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

CREATE INDEX IF NOT EXISTS idx_mfg_jc_log_job_card ON tbl_mfg_job_card_time_log (job_card_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_jc_log_operator ON tbl_mfg_job_card_time_log (operator_id);

-- ============================================================================
-- 60. SUBCONTRACTOR JOB-WORK OUTWARD DELIVERY CHALLAN (tbl_mfg_job_work_challan)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_job_work_challan_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_job_work_challan (
    challan_id                  BIGINT          PRIMARY KEY DEFAULT nextval('seq_job_work_challan_id'),
    challan_no                  VARCHAR(50)     NOT NULL,
    challan_date                DATE            NOT NULL DEFAULT CURRENT_DATE,
    vendor_id                   BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id),
    wo_id                       BIGINT          REFERENCES tbl_mfg_wo_header(wo_id),
    wo_routing_op_id            BIGINT          REFERENCES tbl_mfg_wo_routing_op(wo_routing_op_id),
    job_card_id                 BIGINT          REFERENCES tbl_mfg_job_card(job_card_id),
    nature_of_processing        VARCHAR(250)    NOT NULL,
    from_warehouse_id           BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    expected_return_date        DATE,
    transporter_name            VARCHAR(150),
    vehicle_no                  VARCHAR(50),
    eway_bill_no                VARCHAR(60),
    status                      VARCHAR(30)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'DISPATCHED', 'PARTIALLY_RECEIVED', 'COMPLETED', 'CANCELLED')),
    total_items                 INT             NOT NULL DEFAULT 0,
    total_sent_qty              NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    total_estimated_value       NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    dispatched_by               BIGINT          REFERENCES tbl_sec_user(user_id),
    dispatched_at               TIMESTAMPTZ,
    remarks                     VARCHAR(400),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_mfg_jw_challan_no UNIQUE (comp_id, branch_id, challan_no)
);

CREATE INDEX IF NOT EXISTS idx_mfg_jw_challan_comp_branch ON tbl_mfg_job_work_challan (comp_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_mfg_jw_challan_vendor ON tbl_mfg_job_work_challan (vendor_id);
CREATE INDEX IF NOT EXISTS idx_mfg_jw_challan_wo ON tbl_mfg_job_work_challan (wo_id);
CREATE INDEX IF NOT EXISTS idx_mfg_jw_challan_status ON tbl_mfg_job_work_challan (status);
CREATE INDEX IF NOT EXISTS idx_mfg_jw_challan_date ON tbl_mfg_job_work_challan (challan_date);


-- ============================================================================
-- 61. SUBCONTRACTOR JOB-WORK CHALLAN ITEMS (tbl_mfg_job_work_challan_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_job_work_challan_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_job_work_challan_item (
    challan_item_id             BIGINT          PRIMARY KEY DEFAULT nextval('seq_job_work_challan_item_id'),
    challan_id                  BIGINT          NOT NULL REFERENCES tbl_mfg_job_work_challan(challan_id) ON DELETE CASCADE,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_description            VARCHAR(250),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    sent_qty                    NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    unit_rate                   NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    total_value                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    hsn_code                    VARCHAR(30),
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
    received_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    scrap_returned_qty          NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    loss_qty                    NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    pending_qty                 NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
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

CREATE INDEX IF NOT EXISTS idx_mfg_jw_challan_item_ch ON tbl_mfg_job_work_challan_item (challan_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_jw_challan_item_it ON tbl_mfg_job_work_challan_item (item_id);


-- ============================================================================
-- 62. SUBCONTRACTOR JOB-WORK INWARD RECEIPT (tbl_mfg_job_work_receipt)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_job_work_receipt_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_job_work_receipt (
    receipt_id                  BIGINT          PRIMARY KEY DEFAULT nextval('seq_job_work_receipt_id'),
    receipt_no                  VARCHAR(50)     NOT NULL,
    receipt_date                DATE            NOT NULL DEFAULT CURRENT_DATE,
    challan_id                  BIGINT          NOT NULL REFERENCES tbl_mfg_job_work_challan(challan_id),
    vendor_id                   BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id),
    wo_id                       BIGINT          REFERENCES tbl_mfg_wo_header(wo_id),
    vendor_dc_no                VARCHAR(60),
    vendor_dc_date              DATE,
    vendor_invoice_no           VARCHAR(60),
    to_warehouse_id             BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    service_charges             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    tax_amount                  NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_amount                NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    status                      VARCHAR(30)     NOT NULL DEFAULT 'SUBMITTED'
                                                CHECK (status IN ('DRAFT', 'SUBMITTED', 'CANCELLED')),
    received_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    qc_inspected_by             BIGINT          REFERENCES tbl_sec_user(user_id),
    qc_status                   VARCHAR(30)     NOT NULL DEFAULT 'PENDING'
                                                CHECK (qc_status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'DEVIATION_ACCEPTED')),
    remarks                     VARCHAR(400),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_mfg_jw_receipt_no UNIQUE (comp_id, branch_id, receipt_no)
);

CREATE INDEX IF NOT EXISTS idx_mfg_jw_receipt_comp_branch ON tbl_mfg_job_work_receipt (comp_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_mfg_jw_receipt_challan ON tbl_mfg_job_work_receipt (challan_id);
CREATE INDEX IF NOT EXISTS idx_mfg_jw_receipt_vendor ON tbl_mfg_job_work_receipt (vendor_id);
CREATE INDEX IF NOT EXISTS idx_mfg_jw_receipt_status ON tbl_mfg_job_work_receipt (status);


-- ============================================================================
-- 63. SUBCONTRACTOR JOB-WORK RECEIPT ITEMS (tbl_mfg_job_work_receipt_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_job_work_receipt_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_job_work_receipt_item (
    receipt_item_id             BIGINT          PRIMARY KEY DEFAULT nextval('seq_job_work_receipt_item_id'),
    receipt_id                  BIGINT          NOT NULL REFERENCES tbl_mfg_job_work_receipt(receipt_id) ON DELETE CASCADE,
    challan_item_id             BIGINT          REFERENCES tbl_mfg_job_work_challan_item(challan_item_id),
    received_item_id            BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    received_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    accepted_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    rejected_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    rework_qty                  NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    scrap_qty                   NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    loss_qty                    NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    processing_rate             NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    processing_amount           NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
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

CREATE INDEX IF NOT EXISTS idx_mfg_jw_receipt_item_rc ON tbl_mfg_job_work_receipt_item (receipt_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_jw_receipt_item_it ON tbl_mfg_job_work_receipt_item (received_item_id);


-- ============================================================================
-- 64. FINISHED GOODS (FG) PRODUCTION RECEIPT HEADER (tbl_mfg_fg_receipt_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_fg_receipt_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_fg_receipt_header (
    fg_receipt_id               BIGINT          PRIMARY KEY DEFAULT nextval('seq_fg_receipt_id'),
    receipt_no                  VARCHAR(50)     NOT NULL, -- e.g. 'FGR-AHM-2627-0001'
    receipt_date                DATE            NOT NULL DEFAULT CURRENT_DATE,
    wo_id                       BIGINT          NOT NULL REFERENCES tbl_mfg_wo_header(wo_id),
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    to_warehouse_id             BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    to_bin_id                   BIGINT          REFERENCES tbl_inv_storage_bin(bin_id),
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
    manufacturing_date          DATE            NOT NULL DEFAULT CURRENT_DATE,
    expiry_date                 DATE,
    received_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    accepted_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    rejected_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    rework_qty                  NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    qc_status                   VARCHAR(30)     NOT NULL DEFAULT 'PENDING'
                                                CHECK (qc_status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'DEVIATION_ACCEPTED')),
    qc_inspected_by             BIGINT          REFERENCES tbl_sec_user(user_id),
    qc_inspected_at             TIMESTAMPTZ,
    qc_remarks                  VARCHAR(350),
    material_cost               NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    operation_cost              NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    byproduct_credit            NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_cost                  NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    unit_cost                   NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED')),
    posted_by                   BIGINT          REFERENCES tbl_sec_user(user_id),
    posted_at                   TIMESTAMPTZ,
    remarks                     VARCHAR(400),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_mfg_fg_receipt_no UNIQUE (comp_id, branch_id, receipt_no)
);

CREATE INDEX IF NOT EXISTS idx_mfg_fgr_comp_branch ON tbl_mfg_fg_receipt_header (comp_id, branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_fgr_wo ON tbl_mfg_fg_receipt_header (wo_id);
CREATE INDEX IF NOT EXISTS idx_mfg_fgr_item ON tbl_mfg_fg_receipt_header (item_id);
CREATE INDEX IF NOT EXISTS idx_mfg_fgr_status ON tbl_mfg_fg_receipt_header (status);
CREATE INDEX IF NOT EXISTS idx_mfg_fgr_date ON tbl_mfg_fg_receipt_header (receipt_date);


-- ============================================================================
-- 65. FG RECEIPT SCRAP & BY-PRODUCT ACCOUNTING (tbl_mfg_fg_receipt_byproduct)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_fg_receipt_byproduct_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_mfg_fg_receipt_byproduct (
    receipt_byproduct_id        BIGINT          PRIMARY KEY DEFAULT nextval('seq_fg_receipt_byproduct_id'),
    fg_receipt_id               BIGINT          NOT NULL REFERENCES tbl_mfg_fg_receipt_header(fg_receipt_id) ON DELETE CASCADE,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    product_type                VARCHAR(30)     NOT NULL DEFAULT 'RECOVERABLE_SCRAP'
                                                CHECK (product_type IN ('CO_PRODUCT', 'BY_PRODUCT', 'RECOVERABLE_SCRAP', 'HAZARDOUS_WASTE')),
    quantity                    NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    recovery_rate               NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    total_recovery_value        NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    to_warehouse_id             BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    to_bin_id                   BIGINT          REFERENCES tbl_inv_storage_bin(bin_id),
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

CREATE INDEX IF NOT EXISTS idx_mfg_fgr_byproduct_fgr ON tbl_mfg_fg_receipt_byproduct (fg_receipt_id, is_active);
CREATE INDEX IF NOT EXISTS idx_mfg_fgr_byproduct_item ON tbl_mfg_fg_receipt_byproduct (item_id);


-- ============================================================================
-- 66. CUSTOMER INQUIRY & SALES QUOTATION HEADER (tbl_sales_quotation_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_quotation_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sales_quotation_header (
    quotation_id                BIGINT          PRIMARY KEY DEFAULT nextval('seq_quotation_id'),
    quotation_no                VARCHAR(50)     NOT NULL,
    quotation_date              DATE            NOT NULL DEFAULT CURRENT_DATE,
    inquiry_ref_no              VARCHAR(80),
    inquiry_date                DATE,
    customer_id                 BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id),
    customer_name               VARCHAR(150)    NOT NULL,
    contact_person              VARCHAR(100),
    contact_email               VARCHAR(150),
    contact_phone               VARCHAR(25),
    billing_address_id          BIGINT          REFERENCES tbl_crm_party_address(address_id),
    billing_address             TEXT,
    shipping_address_id         BIGINT          REFERENCES tbl_crm_party_address(address_id),
    shipping_address            TEXT,
    shipping_state_code         VARCHAR(10)     NOT NULL DEFAULT '24',
    shipping_state_name         VARCHAR(100)    NOT NULL DEFAULT 'Gujarat',
    customer_gstin              VARCHAR(20),
    price_list_id               BIGINT          REFERENCES tbl_crm_price_list(price_list_id),
    currency_code               VARCHAR(10)     NOT NULL DEFAULT 'INR',
    exchange_rate               NUMERIC(10, 4)  NOT NULL DEFAULT 1.0000,
    valid_until                 DATE            NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    delivery_lead_time_days     INTEGER         NOT NULL DEFAULT 14,
    payment_terms               VARCHAR(100)    NOT NULL DEFAULT 'NET_30',
    delivery_terms              VARCHAR(100)    NOT NULL DEFAULT 'EX_WORKS',
    subtotal_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    discount_percent            NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    discount_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    taxable_amount              NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    cgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    sgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    igst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_tax_amount            NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    freight_charges             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    packaging_charges           NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    round_off                   NUMERIC(8, 2)   NOT NULL DEFAULT 0.00,
    grand_total                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    revision_no                 INTEGER         NOT NULL DEFAULT 0,
    revision_date               DATE,
    revision_reason             VARCHAR(255),
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'SUBMITTED', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED_TO_SO')),
    submitted_by                BIGINT          REFERENCES tbl_sec_user(user_id),
    submitted_at                TIMESTAMPTZ,
    sent_at                     TIMESTAMPTZ,
    accepted_at                 TIMESTAMPTZ,
    converted_to_so_id          BIGINT,
    converted_at                TIMESTAMPTZ,
    remarks                     VARCHAR(500),
    terms_and_conditions        TEXT,
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_sales_quotation_no UNIQUE (comp_id, branch_id, quotation_no, revision_no)
);

CREATE INDEX IF NOT EXISTS idx_sales_qt_comp_branch ON tbl_sales_quotation_header (comp_id, branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sales_qt_customer ON tbl_sales_quotation_header (customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_qt_status ON tbl_sales_quotation_header (status);
CREATE INDEX IF NOT EXISTS idx_sales_qt_date ON tbl_sales_quotation_header (quotation_date);


-- ============================================================================
-- 67. CUSTOMER INQUIRY & SALES QUOTATION ITEMS (tbl_sales_quotation_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_quotation_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sales_quotation_item (
    quotation_item_id           BIGINT          PRIMARY KEY DEFAULT nextval('seq_quotation_item_id'),
    quotation_id                BIGINT          NOT NULL REFERENCES tbl_sales_quotation_header(quotation_id) ON DELETE CASCADE,
    item_sequence               INTEGER         NOT NULL DEFAULT 1,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_code                   VARCHAR(50)     NOT NULL,
    item_name                   VARCHAR(150)    NOT NULL,
    description                 VARCHAR(400),
    hsn_sac_code                VARCHAR(20),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    quantity                    NUMERIC(14, 3)  NOT NULL DEFAULT 1.000,
    unit_rate                   NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    gross_amount                NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    discount_percent            NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    discount_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    taxable_amount              NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    gst_rate                    NUMERIC(5, 2)   NOT NULL DEFAULT 18.00,
    cgst_rate                   NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    cgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    sgst_rate                   NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    sgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    igst_rate                   NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    igst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_tax_amount            NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_amount                NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    delivery_lead_time_days     INTEGER         DEFAULT 14,
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

CREATE INDEX IF NOT EXISTS idx_sales_qt_item_qt ON tbl_sales_quotation_item (quotation_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sales_qt_item_item ON tbl_sales_quotation_item (item_id);


-- ============================================================================
-- 68. SALES ORDER HEADER & CREDIT EXPOSURE MANAGEMENT (tbl_sales_order_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_sales_order_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sales_order_header (
    so_id                       BIGINT          PRIMARY KEY DEFAULT nextval('seq_sales_order_id'),
    so_no                       VARCHAR(50)     NOT NULL,
    so_date                     DATE            NOT NULL DEFAULT CURRENT_DATE,
    quotation_id                BIGINT          REFERENCES tbl_sales_quotation_header(quotation_id),
    customer_id                 BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id),
    customer_name               VARCHAR(150)    NOT NULL,
    customer_po_no              VARCHAR(80),
    customer_po_date            DATE,
    contact_person              VARCHAR(100),
    contact_email               VARCHAR(150),
    contact_phone               VARCHAR(25),
    billing_address_id          BIGINT          REFERENCES tbl_crm_party_address(address_id),
    billing_address             TEXT,
    shipping_address_id         BIGINT          REFERENCES tbl_crm_party_address(address_id),
    shipping_address            TEXT,
    shipping_state_code         VARCHAR(10)     NOT NULL DEFAULT '24',
    shipping_state_name         VARCHAR(100)    NOT NULL DEFAULT 'Gujarat',
    customer_gstin              VARCHAR(20),
    price_list_id               BIGINT          REFERENCES tbl_crm_price_list(price_list_id),
    currency_code               VARCHAR(10)     NOT NULL DEFAULT 'INR',
    exchange_rate               NUMERIC(10, 4)  NOT NULL DEFAULT 1.0000,
    target_delivery_date        DATE            NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '21 days'),
    payment_terms               VARCHAR(100)    NOT NULL DEFAULT 'NET_30',
    delivery_terms              VARCHAR(100)    NOT NULL DEFAULT 'EX_WORKS',
    customer_credit_limit       NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    current_credit_exposure     NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    is_credit_limit_exceeded    BOOLEAN         NOT NULL DEFAULT FALSE,
    credit_override_by          BIGINT          REFERENCES tbl_sec_user(user_id),
    credit_override_at          TIMESTAMPTZ,
    credit_override_reason      VARCHAR(255),
    subtotal_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    discount_percent            NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    discount_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    taxable_amount              NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    cgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    sgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    igst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_tax_amount            NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    freight_charges             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    packaging_charges           NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    round_off                   NUMERIC(8, 2)   NOT NULL DEFAULT 0.00,
    grand_total                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'READY_FOR_DISPATCH', 'PARTIALLY_DELIVERED', 'COMPLETED', 'CANCELLED', 'ON_HOLD')),
    atp_reservation_status      VARCHAR(25)     NOT NULL DEFAULT 'PENDING'
                                                CHECK (atp_reservation_status IN ('PENDING', 'PARTIAL', 'FULL', 'RELEASED')),
    confirmed_by                BIGINT          REFERENCES tbl_sec_user(user_id),
    confirmed_at                TIMESTAMPTZ,
    hold_reason                 VARCHAR(255),
    remarks                     VARCHAR(500),
    terms_and_conditions        TEXT,
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_sales_order_no UNIQUE (comp_id, branch_id, so_no)
);

CREATE INDEX IF NOT EXISTS idx_so_comp_branch ON tbl_sales_order_header (comp_id, branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_so_customer ON tbl_sales_order_header (customer_id);
CREATE INDEX IF NOT EXISTS idx_so_quotation ON tbl_sales_order_header (quotation_id);
CREATE INDEX IF NOT EXISTS idx_so_status ON tbl_sales_order_header (status);
CREATE INDEX IF NOT EXISTS idx_so_date ON tbl_sales_order_header (so_date);


-- ============================================================================
-- 69. SALES ORDER ITEMS & ATP RESERVATION (tbl_sales_order_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_so_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sales_order_item (
    so_item_id                  BIGINT          PRIMARY KEY DEFAULT nextval('seq_so_item_id'),
    so_id                       BIGINT          NOT NULL REFERENCES tbl_sales_order_header(so_id) ON DELETE CASCADE,
    item_sequence               INTEGER         NOT NULL DEFAULT 1,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_code                   VARCHAR(50)     NOT NULL,
    item_name                   VARCHAR(150)    NOT NULL,
    description                 VARCHAR(400),
    hsn_sac_code                VARCHAR(20),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    ordered_qty                 NUMERIC(14, 3)  NOT NULL DEFAULT 1.000,
    reserved_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    delivered_qty               NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    invoiced_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    cancelled_qty               NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    unit_rate                   NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    gross_amount                NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    discount_percent            NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    discount_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    taxable_amount              NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    gst_rate                    NUMERIC(5, 2)   NOT NULL DEFAULT 18.00,
    cgst_rate                   NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    cgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    sgst_rate                   NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    sgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    igst_rate                   NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    igst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_tax_amount            NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_amount                NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    target_delivery_date        DATE,
    reservation_status          VARCHAR(25)     NOT NULL DEFAULT 'PENDING'
                                                CHECK (reservation_status IN ('PENDING', 'PARTIAL', 'FULL', 'RELEASED')),
    work_order_id               BIGINT          REFERENCES tbl_mfg_wo_header(wo_id),
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

CREATE INDEX IF NOT EXISTS idx_so_item_so ON tbl_sales_order_item (so_id, is_active);
CREATE INDEX IF NOT EXISTS idx_so_item_item ON tbl_sales_order_item (item_id);
CREATE INDEX IF NOT EXISTS idx_so_item_wo ON tbl_sales_order_item (work_order_id);




-- ============================================================================
-- 70. OUTWARD SALES DELIVERY CHALLAN HEADER (tbl_sales_delivery_challan_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_delivery_challan_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sales_delivery_challan_header (
    challan_id                  BIGINT          PRIMARY KEY DEFAULT nextval('seq_delivery_challan_id'),
    challan_no                  VARCHAR(50)     NOT NULL,
    challan_date                DATE            NOT NULL DEFAULT CURRENT_DATE,
    so_id                       BIGINT          REFERENCES tbl_sales_order_header(so_id),
    so_no                       VARCHAR(50),
    customer_id                 BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id),
    customer_name               VARCHAR(150)    NOT NULL,
    contact_person              VARCHAR(100),
    contact_phone               VARCHAR(25),
    billing_address_id          BIGINT          REFERENCES tbl_crm_party_address(address_id),
    billing_address             TEXT,
    shipping_address_id         BIGINT          REFERENCES tbl_crm_party_address(address_id),
    shipping_address            TEXT,
    shipping_state_code         VARCHAR(10)     NOT NULL DEFAULT '24',
    shipping_state_name         VARCHAR(100)    NOT NULL DEFAULT 'Gujarat',
    customer_gstin              VARCHAR(20),
    dispatch_purpose            VARCHAR(50)     NOT NULL DEFAULT 'SUPPLY_ON_SALE'
                                                CHECK (dispatch_purpose IN ('SUPPLY_ON_SALE', 'SAMPLE_DEMO', 'JOB_WORK_RETURN', 'EXHIBITION', 'APPROVAL_BASIS', 'OTHERS')),
    transporter_id              BIGINT          REFERENCES tbl_crm_party(party_id),
    transporter_name            VARCHAR(150),
    vehicle_no                  VARCHAR(50),
    lr_rr_no                    VARCHAR(80),
    lr_rr_date                  DATE,
    e_way_bill_no               VARCHAR(50),
    e_way_bill_date             DATE,
    delivery_terms              VARCHAR(100)    NOT NULL DEFAULT 'EX_WORKS',
    total_packages              INTEGER         NOT NULL DEFAULT 1,
    package_type                VARCHAR(80)     DEFAULT 'Corrugated Boxes',
    gross_weight_kg             NUMERIC(10, 3)  DEFAULT 0.000,
    net_weight_kg               NUMERIC(10, 3)  DEFAULT 0.000,
    warehouse_id                BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    total_quantity              NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    total_value                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'PICKED', 'PACKED', 'DISPATCHED', 'DELIVERED', 'CANCELLED')),
    picked_by                   BIGINT          REFERENCES tbl_sec_user(user_id),
    picked_at                   TIMESTAMPTZ,
    packed_by                   BIGINT          REFERENCES tbl_sec_user(user_id),
    packed_at                   TIMESTAMPTZ,
    dispatched_by               BIGINT          REFERENCES tbl_sec_user(user_id),
    dispatched_at               TIMESTAMPTZ,
    delivered_at                TIMESTAMPTZ,
    remarks                     VARCHAR(500),
    terms_and_conditions        TEXT,
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_sales_delivery_challan_no UNIQUE (comp_id, branch_id, challan_no)
);

CREATE INDEX IF NOT EXISTS idx_sales_dc_comp_branch ON tbl_sales_delivery_challan_header (comp_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_dc_customer ON tbl_sales_delivery_challan_header (customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_dc_so ON tbl_sales_delivery_challan_header (so_id);
CREATE INDEX IF NOT EXISTS idx_sales_dc_status ON tbl_sales_delivery_challan_header (status);
CREATE INDEX IF NOT EXISTS idx_sales_dc_date ON tbl_sales_delivery_challan_header (challan_date);

-- ============================================================================
-- 71. OUTWARD SALES DELIVERY CHALLAN ITEM (tbl_sales_delivery_challan_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_challan_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sales_delivery_challan_item (
    challan_item_id             BIGINT          PRIMARY KEY DEFAULT nextval('seq_challan_item_id'),
    challan_id                  BIGINT          NOT NULL REFERENCES tbl_sales_delivery_challan_header(challan_id) ON DELETE CASCADE,
    so_item_id                  BIGINT          REFERENCES tbl_sales_order_item(so_item_id),
    item_sequence               INTEGER         NOT NULL DEFAULT 1,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_code                   VARCHAR(50)     NOT NULL,
    item_name                   VARCHAR(150)    NOT NULL,
    description                 VARCHAR(400),
    hsn_sac_code                VARCHAR(20),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    ordered_qty                 NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    dispatched_qty              NUMERIC(14, 3)  NOT NULL DEFAULT 1.000,
    warehouse_id                BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    bin_id                      BIGINT          REFERENCES tbl_inv_storage_bin(bin_id),
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
    unit_rate                   NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    total_amount                NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
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

CREATE INDEX IF NOT EXISTS idx_sales_dc_item_challan ON tbl_sales_delivery_challan_item (challan_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sales_dc_item_item ON tbl_sales_delivery_challan_item (item_id);
CREATE INDEX IF NOT EXISTS idx_sales_dc_item_so_item ON tbl_sales_delivery_challan_item (so_item_id);
CREATE INDEX IF NOT EXISTS idx_sales_dc_item_wh_bin ON tbl_sales_delivery_challan_item (warehouse_id, bin_id);


-- ============================================================================
-- 72. STATUTORY SALES TAX INVOICE & E-INVOICE HEADER (tbl_sales_invoice_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_sales_invoice_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sales_invoice_header (
    invoice_id                  BIGINT          PRIMARY KEY DEFAULT nextval('seq_sales_invoice_id'),
    invoice_no                  VARCHAR(50)     NOT NULL,
    invoice_date                DATE            NOT NULL DEFAULT CURRENT_DATE,
    invoice_type                VARCHAR(30)     NOT NULL DEFAULT 'TAX_INVOICE'
                                                CHECK (invoice_type IN ('TAX_INVOICE', 'EXPORT_INVOICE', 'PROFORMA_INVOICE', 'DEBIT_NOTE', 'BILL_OF_SUPPLY')),
    challan_id                  BIGINT          REFERENCES tbl_sales_delivery_challan_header(challan_id),
    so_id                       BIGINT          REFERENCES tbl_sales_order_header(so_id),
    customer_id                 BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id),
    customer_name               VARCHAR(150)    NOT NULL,
    contact_person              VARCHAR(100),
    contact_phone               VARCHAR(25),
    billing_address_id          BIGINT          REFERENCES tbl_crm_party_address(address_id),
    billing_address             TEXT,
    shipping_address_id         BIGINT          REFERENCES tbl_crm_party_address(address_id),
    shipping_address            TEXT,
    place_of_supply             VARCHAR(100)    NOT NULL DEFAULT '24 - Gujarat',
    customer_gstin              VARCHAR(20),
    customer_pan                VARCHAR(15),
    supply_type                 VARCHAR(30)     NOT NULL DEFAULT 'INTRA_STATE'
                                                CHECK (supply_type IN ('INTRA_STATE', 'INTER_STATE', 'EXPORT_WITH_PAY', 'EXPORT_WITHOUT_PAY')),
    reverse_charge_applicable   BOOLEAN         NOT NULL DEFAULT FALSE,
    transporter_name            VARCHAR(150),
    vehicle_no                  VARCHAR(50),
    lr_rr_no                    VARCHAR(80),
    lr_rr_date                  DATE,
    irn_status                  VARCHAR(25)     NOT NULL DEFAULT 'NOT_GENERATED'
                                                CHECK (irn_status IN ('NOT_GENERATED', 'GENERATED', 'CANCELLED', 'FAILED')),
    irn_no                      VARCHAR(64),
    ack_no                      VARCHAR(30),
    ack_date                    TIMESTAMPTZ,
    signed_qr_code              TEXT,
    e_way_bill_no               VARCHAR(50),
    e_way_bill_date             DATE,
    payment_terms_days          INTEGER         NOT NULL DEFAULT 30,
    due_date                    DATE            NOT NULL,
    currency_code               VARCHAR(5)      NOT NULL DEFAULT 'INR',
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
    tcs_rate                    NUMERIC(6, 3)   NOT NULL DEFAULT 0.000,
    tcs_amount                  NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    round_off                   NUMERIC(8, 2)   NOT NULL DEFAULT 0.00,
    total_invoice_amount        NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    paid_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    balance_amount              NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'POSTED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED')),
    payment_status              VARCHAR(25)     NOT NULL DEFAULT 'UNPAID'
                                                CHECK (payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
    posted_by                   BIGINT          REFERENCES tbl_sec_user(user_id),
    posted_at                   TIMESTAMPTZ,
    cancelled_by                BIGINT          REFERENCES tbl_sec_user(user_id),
    cancelled_at                TIMESTAMPTZ,
    cancellation_reason         VARCHAR(350),
    remarks                     VARCHAR(500),
    terms_and_conditions        TEXT,
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_sales_invoice_no UNIQUE (comp_id, branch_id, invoice_no)
);

CREATE INDEX IF NOT EXISTS idx_sales_inv_comp_branch ON tbl_sales_invoice_header (comp_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_inv_customer ON tbl_sales_invoice_header (customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_inv_so ON tbl_sales_invoice_header (so_id);
CREATE INDEX IF NOT EXISTS idx_sales_inv_dc ON tbl_sales_invoice_header (challan_id);
CREATE INDEX IF NOT EXISTS idx_sales_inv_status ON tbl_sales_invoice_header (status);
CREATE INDEX IF NOT EXISTS idx_sales_inv_pay_status ON tbl_sales_invoice_header (payment_status);
CREATE INDEX IF NOT EXISTS idx_sales_inv_date ON tbl_sales_invoice_header (invoice_date, due_date);
CREATE INDEX IF NOT EXISTS idx_sales_inv_irn ON tbl_sales_invoice_header (irn_status, irn_no);


-- ============================================================================
-- 73. SALES TAX INVOICE LINE ITEMS (tbl_sales_invoice_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_sales_invoice_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sales_invoice_item (
    invoice_item_id             BIGINT          PRIMARY KEY DEFAULT nextval('seq_sales_invoice_item_id'),
    invoice_id                  BIGINT          NOT NULL REFERENCES tbl_sales_invoice_header(invoice_id) ON DELETE CASCADE,
    so_item_id                  BIGINT          REFERENCES tbl_sales_order_item(so_item_id),
    challan_item_id             BIGINT          REFERENCES tbl_sales_delivery_challan_item(challan_item_id),
    item_sequence               INTEGER         NOT NULL DEFAULT 1,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_code                   VARCHAR(50)     NOT NULL,
    item_name                   VARCHAR(150)    NOT NULL,
    description                 VARCHAR(400),
    hsn_sac_code                VARCHAR(20),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    quantity                    NUMERIC(14, 3)  NOT NULL DEFAULT 1.000,
    unit_rate                   NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    gross_amount                NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    discount_percent            NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    discount_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    taxable_amount              NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    gst_rate                    NUMERIC(5, 2)   NOT NULL DEFAULT 18.00,
    cgst_rate                   NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    cgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    sgst_rate                   NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    sgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    igst_rate                   NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    igst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_tax_amount            NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_item_amount           NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
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

CREATE INDEX IF NOT EXISTS idx_sales_inv_item_invoice ON tbl_sales_invoice_item (invoice_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sales_inv_item_item ON tbl_sales_invoice_item (item_id);
CREATE INDEX IF NOT EXISTS idx_sales_inv_item_so_item ON tbl_sales_invoice_item (so_item_id);
CREATE INDEX IF NOT EXISTS idx_sales_inv_item_dc_item ON tbl_sales_invoice_item (challan_item_id);


-- ============================================================================
-- 74. CUSTOMER AR PAYMENT RECEIPTS & CLEARANCES (tbl_sales_ar_payment_receipt)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_ar_payment_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sales_ar_payment_receipt (
    payment_id                  BIGINT          PRIMARY KEY DEFAULT nextval('seq_ar_payment_id'),
    receipt_no                  VARCHAR(50)     NOT NULL,
    receipt_date                DATE            NOT NULL DEFAULT CURRENT_DATE,
    invoice_id                  BIGINT          NOT NULL REFERENCES tbl_sales_invoice_header(invoice_id),
    customer_id                 BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id),
    payment_mode                VARCHAR(30)     NOT NULL DEFAULT 'NEFT_RTGS'
                                                CHECK (payment_mode IN ('NEFT_RTGS', 'CHEQUE', 'UPI', 'CASH', 'BANK_TRANSFER', 'CREDIT_ADJUSTMENT')),
    reference_no                VARCHAR(100),
    payment_amount              NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    tds_amount                  NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_allocated_amount      NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    bank_name                   VARCHAR(100),
    cheque_date                 DATE,
    remarks                     VARCHAR(350),
    recorded_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_sales_ar_receipt_no UNIQUE (comp_id, branch_id, receipt_no)
);

CREATE INDEX IF NOT EXISTS idx_sales_ar_comp_branch ON tbl_sales_ar_payment_receipt (comp_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_ar_invoice ON tbl_sales_ar_payment_receipt (invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_ar_customer ON tbl_sales_ar_payment_receipt (customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_ar_date ON tbl_sales_ar_payment_receipt (receipt_date);


-- ============================================================================
-- 75. SALES RETURN / RMA & CREDIT NOTE HEADER (tbl_sales_return_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_sales_return_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sales_return_header (
    return_id                   BIGINT          PRIMARY KEY DEFAULT nextval('seq_sales_return_id'),
    return_no                   VARCHAR(50)     NOT NULL,
    return_date                 DATE            NOT NULL DEFAULT CURRENT_DATE,
    return_type                 VARCHAR(30)     NOT NULL DEFAULT 'COMMERCIAL_RETURN'
                                                CHECK (return_type IN ('COMMERCIAL_RETURN', 'QUALITY_REJECTION', 'TRANSIT_DAMAGE', 'WRONG_SHIPMENT', 'WARRANTY_REPLACEMENT')),
    credit_note_no              VARCHAR(50),
    credit_note_date            DATE,
    invoice_id                  BIGINT          NOT NULL REFERENCES tbl_sales_invoice_header(invoice_id),
    invoice_no                  VARCHAR(50)     NOT NULL,
    invoice_date                DATE            NOT NULL,
    customer_id                 BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id),
    customer_name               VARCHAR(150)    NOT NULL,
    customer_gstin              VARCHAR(15),
    customer_pan                VARCHAR(10),
    billing_address             VARCHAR(400)    NOT NULL,
    billing_city                VARCHAR(50),
    billing_state               VARCHAR(50),
    billing_pincode             VARCHAR(10),
    billing_state_code          VARCHAR(2)      NOT NULL DEFAULT '24',
    place_of_supply             VARCHAR(50)     NOT NULL DEFAULT 'Gujarat (24)',
    pos_state_code              VARCHAR(2)      NOT NULL DEFAULT '24',
    rma_reference_no            VARCHAR(50),
    rma_reference_date          DATE,
    gate_entry_no               VARCHAR(50),
    gate_entry_date             DATE,
    vehicle_no                  VARCHAR(50),
    transporter_name            VARCHAR(100),
    lr_no                       VARCHAR(50),
    lr_date                     DATE,
    currency_code               VARCHAR(10)     NOT NULL DEFAULT 'INR',
    exchange_rate               NUMERIC(10, 4)  NOT NULL DEFAULT 1.0000,
    subtotal_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    discount_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    taxable_amount              NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    cgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    sgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    igst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    round_off_amount            NUMERIC(8, 2)   NOT NULL DEFAULT 0.00,
    total_credit_amount         NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    ar_adjusted_amount          NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    irn_status                  VARCHAR(20)     NOT NULL DEFAULT 'NOT_APPLICABLE'
                                                CHECK (irn_status IN ('NOT_APPLICABLE', 'PENDING', 'GENERATED', 'CANCELLED', 'FAILED')),
    irn_no                      VARCHAR(64),
    ack_no                      VARCHAR(50),
    ack_date                    TIMESTAMPTZ,
    signed_qr_code              TEXT,
    return_reason               VARCHAR(300)    NOT NULL,
    qc_status                   VARCHAR(20)     NOT NULL DEFAULT 'PENDING'
                                                CHECK (qc_status IN ('PENDING', 'INSPECTED', 'ACCEPTED', 'REJECTED', 'PARTIALLY_ACCEPTED')),
    qc_inspected_by             BIGINT          REFERENCES tbl_sec_user(user_id),
    qc_inspected_at             TIMESTAMPTZ,
    qc_remarks                  VARCHAR(400),
    restock_status              VARCHAR(20)     NOT NULL DEFAULT 'PENDING'
                                                CHECK (restock_status IN ('PENDING', 'RESTOCKED', 'SCRAPPED', 'PARTIALLY_RESTOCKED')),
    restocked_by                BIGINT          REFERENCES tbl_sec_user(user_id),
    restocked_at                TIMESTAMPTZ,
    credit_note_status          VARCHAR(20)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (credit_note_status IN ('DRAFT', 'POSTED', 'CANCELLED')),
    credit_posted_by            BIGINT          REFERENCES tbl_sec_user(user_id),
    credit_posted_at            TIMESTAMPTZ,
    status                      VARCHAR(20)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'INSPECTED', 'CREDITED', 'RESTOCKED', 'COMPLETED', 'CANCELLED')),
    remarks                     VARCHAR(500),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_sales_return_no UNIQUE (comp_id, branch_id, return_no)
);

CREATE INDEX IF NOT EXISTS idx_sales_ret_comp_branch ON tbl_sales_return_header (comp_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_sales_ret_customer ON tbl_sales_return_header (customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_ret_invoice ON tbl_sales_return_header (invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_ret_status ON tbl_sales_return_header (status);
CREATE INDEX IF NOT EXISTS idx_sales_ret_qc_status ON tbl_sales_return_header (qc_status);
CREATE INDEX IF NOT EXISTS idx_sales_ret_date ON tbl_sales_return_header (return_date);
CREATE INDEX IF NOT EXISTS idx_sales_ret_cn_no ON tbl_sales_return_header (credit_note_no);

-- ============================================================================
-- 76. SALES RETURN / RMA ITEM DETAILS (tbl_sales_return_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_sales_return_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sales_return_item (
    return_item_id              BIGINT          PRIMARY KEY DEFAULT nextval('seq_sales_return_item_id'),
    return_id                   BIGINT          NOT NULL REFERENCES tbl_sales_return_header(return_id) ON DELETE CASCADE,
    invoice_item_id             BIGINT          REFERENCES tbl_sales_invoice_item(invoice_item_id),
    item_sequence               INTEGER         NOT NULL DEFAULT 1,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_code                   VARCHAR(50)     NOT NULL,
    item_name                   VARCHAR(150)    NOT NULL,
    description                 VARCHAR(400),
    hsn_sac_code                VARCHAR(20)     NOT NULL,
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    invoiced_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    returned_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 1.000,
    accepted_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    rejected_scrap_qty          NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    unit_price                  NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    discount_percent            NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    discount_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    taxable_amount              NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    gst_rate                    NUMERIC(5, 2)   NOT NULL DEFAULT 18.00,
    cgst_rate                   NUMERIC(5, 2)   NOT NULL DEFAULT 9.00,
    cgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    sgst_rate                   NUMERIC(5, 2)   NOT NULL DEFAULT 9.00,
    sgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    igst_rate                   NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    igst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    line_total                  NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    target_warehouse_id         BIGINT          REFERENCES tbl_inv_warehouse(warehouse_id),
    target_bin_id               BIGINT          REFERENCES tbl_inv_storage_bin(bin_id),
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
    defect_type                 VARCHAR(100),
    qc_verdict                  VARCHAR(30)     NOT NULL DEFAULT 'PENDING'
                                                CHECK (qc_verdict IN ('PENDING', 'ACCEPT_FOR_RESTOCK', 'ACCEPT_FOR_REWORK', 'REJECT_SCRAP')),
    action_taken                VARCHAR(100),
    remarks                     VARCHAR(250),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sales_ret_item_return ON tbl_sales_return_item (return_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sales_ret_item_item ON tbl_sales_return_item (item_id);
CREATE INDEX IF NOT EXISTS idx_sales_ret_item_inv_item ON tbl_sales_return_item (invoice_item_id);
CREATE INDEX IF NOT EXISTS idx_sales_ret_item_target_bin ON tbl_sales_return_item (target_bin_id);


-- ============================================================================
-- 77. PHYSICAL STOCK RECONCILIATION & ADJUSTMENT HEADER (tbl_inv_adjustment_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_inv_adjustment_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_adjustment_header (
    adjustment_id               BIGINT          PRIMARY KEY DEFAULT nextval('seq_inv_adjustment_id'),
    adjustment_no               VARCHAR(50)     NOT NULL,
    adjustment_date             DATE            NOT NULL DEFAULT CURRENT_DATE,
    adjustment_type             VARCHAR(40)     NOT NULL DEFAULT 'CYCLE_COUNT'
                                                CHECK (adjustment_type IN ('CYCLE_COUNT', 'PERIODIC_AUDIT', 'DAMAGE_WRITEOFF', 'EXPIRY_WRITEOFF', 'SPILLAGE_LOSS', 'FOUND_SURPLUS', 'REVALUATION_VARIANCE')),
    warehouse_id                BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    audited_by                  BIGINT          REFERENCES tbl_sec_user(user_id),
    audited_at                  TIMESTAMPTZ,
    approved_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    approval_date               TIMESTAMPTZ,
    total_items                 INTEGER         NOT NULL DEFAULT 0,
    total_book_value            NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_physical_value        NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    net_variance_value          NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'CANCELLED')),
    cancellation_reason         VARCHAR(350),
    remarks                     VARCHAR(500),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_inv_adjustment_no UNIQUE (comp_id, branch_id, adjustment_no)
);

CREATE INDEX IF NOT EXISTS idx_inv_adj_comp_branch ON tbl_inv_adjustment_header (comp_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_inv_adj_warehouse ON tbl_inv_adjustment_header (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inv_adj_status ON tbl_inv_adjustment_header (status);
CREATE INDEX IF NOT EXISTS idx_inv_adj_date ON tbl_inv_adjustment_header (adjustment_date);


-- ============================================================================
-- 78. PHYSICAL STOCK RECONCILIATION & ADJUSTMENT ITEM (tbl_inv_adjustment_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_inv_adjustment_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_adjustment_item (
    adjustment_item_id          BIGINT          PRIMARY KEY DEFAULT nextval('seq_inv_adjustment_item_id'),
    adjustment_id               BIGINT          NOT NULL REFERENCES tbl_inv_adjustment_header(adjustment_id) ON DELETE CASCADE,
    item_sequence               INTEGER         NOT NULL DEFAULT 1,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_code                   VARCHAR(50)     NOT NULL,
    item_name                   VARCHAR(150)    NOT NULL,
    bin_id                      BIGINT          NOT NULL REFERENCES tbl_inv_storage_bin(bin_id),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
    book_qty                    NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    physical_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    variance_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    unit_cost                   NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    book_value                  NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    physical_value              NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    variance_value              NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    variance_direction          VARCHAR(20)     NOT NULL DEFAULT 'NONE'
                                                CHECK (variance_direction IN ('SURPLUS_GAIN', 'DEFICIT_LOSS', 'NONE')),
    discrepancy_reason          VARCHAR(300),
    remarks                     VARCHAR(250),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inv_adj_item_adj ON tbl_inv_adjustment_item (adjustment_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inv_adj_item_item ON tbl_inv_adjustment_item (item_id);
CREATE INDEX IF NOT EXISTS idx_inv_adj_item_bin ON tbl_inv_adjustment_item (bin_id);


-- ============================================================================
-- 79. WAREHOUSE STOCK TRANSFER ORDER & MOVEMENT HEADER (tbl_inv_transfer_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_inv_transfer_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_transfer_header (
    transfer_id                 BIGINT          PRIMARY KEY DEFAULT nextval('seq_inv_transfer_id'),
    transfer_no                 VARCHAR(50)     NOT NULL,
    transfer_date               DATE            NOT NULL DEFAULT CURRENT_DATE,
    transfer_type               VARCHAR(30)     NOT NULL DEFAULT 'BIN_TO_BIN'
                                                CHECK (transfer_type IN ('BIN_TO_BIN', 'INTER_WAREHOUSE', 'INTER_BRANCH_STO')),
    from_warehouse_id           BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    to_warehouse_id             BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    to_branch_id                BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    transporter_name            VARCHAR(150),
    vehicle_no                  VARCHAR(50),
    lr_no                       VARCHAR(50),
    lr_date                     DATE,
    eway_bill_no                VARCHAR(60),
    challan_no                  VARCHAR(50),
    challan_date                DATE,
    total_items                 INTEGER         NOT NULL DEFAULT 0,
    total_transfer_qty          NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    total_transfer_value        NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'DISPATCHED', 'RECEIVED', 'CANCELLED')),
    dispatched_by               BIGINT          REFERENCES tbl_sec_user(user_id),
    dispatched_at               TIMESTAMPTZ,
    received_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    received_at                 TIMESTAMPTZ,
    cancellation_reason         VARCHAR(350),
    remarks                     VARCHAR(500),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_inv_transfer_no UNIQUE (comp_id, branch_id, transfer_no)
);

CREATE INDEX IF NOT EXISTS idx_inv_transfer_comp_branch ON tbl_inv_transfer_header (comp_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_inv_transfer_warehouses ON tbl_inv_transfer_header (from_warehouse_id, to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inv_transfer_status ON tbl_inv_transfer_header (status);
CREATE INDEX IF NOT EXISTS idx_inv_transfer_date ON tbl_inv_transfer_header (transfer_date);
CREATE INDEX IF NOT EXISTS idx_inv_transfer_type ON tbl_inv_transfer_header (transfer_type);


-- ============================================================================
-- 80. WAREHOUSE STOCK TRANSFER ORDER & MOVEMENT ITEM (tbl_inv_transfer_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_inv_transfer_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_transfer_item (
    transfer_item_id            BIGINT          PRIMARY KEY DEFAULT nextval('seq_inv_transfer_item_id'),
    transfer_id                 BIGINT          NOT NULL REFERENCES tbl_inv_transfer_header(transfer_id) ON DELETE CASCADE,
    item_sequence               INTEGER         NOT NULL DEFAULT 1,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_code                   VARCHAR(50)     NOT NULL,
    item_name                   VARCHAR(150)    NOT NULL,
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    from_bin_id                 BIGINT          NOT NULL REFERENCES tbl_inv_storage_bin(bin_id),
    to_bin_id                   BIGINT          NOT NULL REFERENCES tbl_inv_storage_bin(bin_id),
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
    available_qty               NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    transfer_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 1.000,
    received_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    unit_cost                   NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    line_total                  NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    remarks                     VARCHAR(250),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inv_transfer_item_trans ON tbl_inv_transfer_item (transfer_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inv_transfer_item_item ON tbl_inv_transfer_item (item_id);
CREATE INDEX IF NOT EXISTS idx_inv_transfer_item_bins ON tbl_inv_transfer_item (from_bin_id, to_bin_id);






-- ============================================================================
-- SECTION 81: tbl_inv_batch_master
-- DATE: 2026-10-19
-- FEATURE: Step 8.4 - Batch, Heat & Metallurgical Quality Passport Registry
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_inv_batch_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_batch_master (
    batch_id                    BIGINT          PRIMARY KEY DEFAULT nextval('seq_inv_batch_id'),
    batch_no                    VARCHAR(100)    NOT NULL,
    heat_no                     VARCHAR(100),
    lot_no                      VARCHAR(100),
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_code                   VARCHAR(50)     NOT NULL,
    item_name                   VARCHAR(200)    NOT NULL,
    supplier_id                 BIGINT          REFERENCES tbl_crm_party(party_id),
    grn_id                      BIGINT          REFERENCES tbl_inv_grn_header(grn_id),
    work_order_id               BIGINT          REFERENCES tbl_mfg_wo_header(wo_id),
    manufacture_date            DATE,
    expiry_date                 DATE,
    retest_date                 DATE,
    initial_qty                 NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    current_qty                 NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    qc_status                   VARCHAR(30)     NOT NULL DEFAULT 'APPROVED'
                                                CHECK (qc_status IN ('APPROVED', 'QUARANTINE', 'REJECTED', 'EXPIRED', 'CONDITIONAL')),
    mtc_no                      VARCHAR(100),
    mtc_date                    DATE,
    mtc_url                     VARCHAR(255),
    -- Chemical Composition (wt %)
    chem_c                      NUMERIC(6, 4),
    chem_mn                     NUMERIC(6, 4),
    chem_si                     NUMERIC(6, 4),
    chem_p                      NUMERIC(6, 4),
    chem_s                      NUMERIC(6, 4),
    chem_cr                     NUMERIC(6, 4),
    chem_ni                     NUMERIC(6, 4),
    chem_mo                     NUMERIC(6, 4),
    -- Mechanical & Physical Properties
    yield_strength_mpa          NUMERIC(8, 2),
    tensile_strength_mpa        NUMERIC(8, 2),
    elongation_pct              NUMERIC(5, 2),
    hardness_val                NUMERIC(6, 2),
    hardness_scale              VARCHAR(20)     DEFAULT 'BHN',
    impact_joules               NUMERIC(6, 2),
    ultrasonic_test_status      VARCHAR(50)     DEFAULT 'PASSED',
    radiography_status          VARCHAR(50)     DEFAULT 'NOT_APPLICABLE',
    remarks                     VARCHAR(500),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_inv_batch_comp_item_batch UNIQUE (comp_id, item_id, batch_no)
);

CREATE INDEX IF NOT EXISTS idx_inv_batch_comp_branch ON tbl_inv_batch_master (comp_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_inv_batch_item ON tbl_inv_batch_master (item_id);
CREATE INDEX IF NOT EXISTS idx_inv_batch_no ON tbl_inv_batch_master (batch_no);
CREATE INDEX IF NOT EXISTS idx_inv_batch_heat ON tbl_inv_batch_master (heat_no);
CREATE INDEX IF NOT EXISTS idx_inv_batch_qc_status ON tbl_inv_batch_master (qc_status);
CREATE INDEX IF NOT EXISTS idx_inv_batch_supplier ON tbl_inv_batch_master (supplier_id);
CREATE INDEX IF NOT EXISTS idx_inv_batch_wo ON tbl_inv_batch_master (work_order_id);


-- ============================================================================
-- SECTION 82: tbl_inv_batch_genealogy
-- DATE: 2026-10-19
-- FEATURE: Step 8.4 - Bi-directional Parent-Child Transformation Linkage
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_inv_genealogy_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_batch_genealogy (
    genealogy_id                BIGINT          PRIMARY KEY DEFAULT nextval('seq_inv_genealogy_id'),
    parent_batch_id             BIGINT          REFERENCES tbl_inv_batch_master(batch_id) ON DELETE CASCADE,
    parent_batch_no             VARCHAR(100)    NOT NULL,
    parent_item_id              BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    child_batch_id              BIGINT          REFERENCES tbl_inv_batch_master(batch_id) ON DELETE CASCADE,
    child_batch_no              VARCHAR(100)    NOT NULL,
    child_item_id               BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    work_order_id               BIGINT          REFERENCES tbl_mfg_wo_header(wo_id),
    job_card_id                 BIGINT          REFERENCES tbl_mfg_job_card(job_card_id),
    consumed_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 1.000,
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    transformation_type         VARCHAR(50)     NOT NULL DEFAULT 'WORK_ORDER_ASSEMBLY'
                                                CHECK (transformation_type IN ('WORK_ORDER_ASSEMBLY', 'JOB_WORK_PROCESSING', 'BLENDING', 'SPLIT_LOT', 'REWORK')),
    link_date                   TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    remarks                     VARCHAR(250),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inv_genealogy_parent ON tbl_inv_batch_genealogy (parent_batch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inv_genealogy_child ON tbl_inv_batch_genealogy (child_batch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inv_genealogy_wo ON tbl_inv_batch_genealogy (work_order_id);
CREATE INDEX IF NOT EXISTS idx_inv_genealogy_parent_no ON tbl_inv_batch_genealogy (parent_batch_no);
CREATE INDEX IF NOT EXISTS idx_inv_genealogy_child_no ON tbl_inv_batch_genealogy (child_batch_no);


-- ============================================================================
-- SECTION 83: tbl_inv_serial_master
-- DATE: 2026-10-19
-- FEATURE: Step 8.4 - Unit Serial Number Lifecycle & Asset Registry
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_inv_serial_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_serial_master (
    serial_id                   BIGINT          PRIMARY KEY DEFAULT nextval('seq_inv_serial_id'),
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_code                   VARCHAR(50)     NOT NULL,
    item_name                   VARCHAR(200)    NOT NULL,
    batch_id                    BIGINT          REFERENCES tbl_inv_batch_master(batch_id),
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
    serial_no                   VARCHAR(100)    NOT NULL,
    barcode                     VARCHAR(100),
    rfid_tag                    VARCHAR(100),
    current_warehouse_id        BIGINT          REFERENCES tbl_inv_warehouse(warehouse_id),
    current_bin_id              BIGINT          REFERENCES tbl_inv_storage_bin(bin_id),
    status                      VARCHAR(30)     NOT NULL DEFAULT 'AVAILABLE'
                                                CHECK (status IN ('AVAILABLE', 'ALLOCATED', 'ISSUED_TO_PROD', 'IN_TRANSIT', 'DELIVERED', 'RETURNED_RMA', 'SCRAPPED')),
    grn_id                      BIGINT          REFERENCES tbl_inv_grn_header(grn_id),
    work_order_id               BIGINT          REFERENCES tbl_mfg_wo_header(wo_id),
    job_card_id                 BIGINT          REFERENCES tbl_mfg_job_card(job_card_id),
    challan_id                  BIGINT          REFERENCES tbl_sales_delivery_challan_header(challan_id),
    invoice_id                  BIGINT          REFERENCES tbl_sales_invoice_header(invoice_id),
    customer_id                 BIGINT          REFERENCES tbl_crm_party(party_id),
    warranty_start_date         DATE,
    warranty_end_date           DATE,
    remarks                     VARCHAR(250),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_inv_serial_comp_item_serial UNIQUE (comp_id, item_id, serial_no)
);

CREATE INDEX IF NOT EXISTS idx_inv_serial_comp_branch ON tbl_inv_serial_master (comp_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_inv_serial_item ON tbl_inv_serial_master (item_id);
CREATE INDEX IF NOT EXISTS idx_inv_serial_no ON tbl_inv_serial_master (serial_no);
CREATE INDEX IF NOT EXISTS idx_inv_serial_batch ON tbl_inv_serial_master (batch_id);
CREATE INDEX IF NOT EXISTS idx_inv_serial_status ON tbl_inv_serial_master (status);
CREATE INDEX IF NOT EXISTS idx_inv_serial_customer ON tbl_inv_serial_master (customer_id);
CREATE INDEX IF NOT EXISTS idx_inv_serial_invoice ON tbl_inv_serial_master (invoice_id);
CREATE INDEX IF NOT EXISTS idx_inv_serial_challan ON tbl_inv_serial_master (challan_id);
CREATE INDEX IF NOT EXISTS idx_inv_serial_wh_bin ON tbl_inv_serial_master (current_warehouse_id, current_bin_id);


-- ============================================================================
-- SECTION 84: tbl_inv_stock_provision_header
-- DATE: 2026-10-20
-- FEATURE: Step 8.5 - Inventory Aging, Dead Stock & Valuation Provisioning (Ind AS 2 / CARO 2020)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_inv_provision_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_stock_provision_header (
    provision_id                BIGINT          PRIMARY KEY DEFAULT nextval('seq_inv_provision_id'),
    provision_no                VARCHAR(50)     NOT NULL,
    provision_date              DATE            NOT NULL DEFAULT CURRENT_DATE,
    valuation_date              DATE            NOT NULL DEFAULT CURRENT_DATE,
    warehouse_id                BIGINT          REFERENCES tbl_inv_warehouse(warehouse_id),
    category_id                 BIGINT          REFERENCES tbl_inv_item_category(category_id),
    total_items_evaluated       INT             NOT NULL DEFAULT 0,
    total_gross_valuation       NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    fresh_stock_value           NUMERIC(14, 2)  NOT NULL DEFAULT 0.00, -- 0-30 Days
    normal_stock_value          NUMERIC(14, 2)  NOT NULL DEFAULT 0.00, -- 31-60 Days
    slow_moving_value           NUMERIC(14, 2)  NOT NULL DEFAULT 0.00, -- 61-90 Days
    stagnant_stock_value        NUMERIC(14, 2)  NOT NULL DEFAULT 0.00, -- 91-180 Days
    dormant_stock_value         NUMERIC(14, 2)  NOT NULL DEFAULT 0.00, -- 181-365 Days
    dead_stock_value            NUMERIC(14, 2)  NOT NULL DEFAULT 0.00, -- >365 Days
    recommended_provision_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    approved_provision_amount   NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED')),
    reviewed_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    reviewed_at                 TIMESTAMPTZ,
    approved_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    approved_at                 TIMESTAMPTZ,
    audit_standard_citation     VARCHAR(150)    NOT NULL DEFAULT 'Ind AS 2 (Inventories) & CARO 2020 Clause 3(ii)',
    provision_policy_matrix     JSONB,          -- Bracket percentage rules applied
    remarks                     VARCHAR(500),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_inv_provision_header_no UNIQUE (comp_id, branch_id, provision_no)
);

CREATE INDEX IF NOT EXISTS idx_inv_provision_comp_branch ON tbl_inv_stock_provision_header (comp_id, branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inv_provision_date ON tbl_inv_stock_provision_header (valuation_date);
CREATE INDEX IF NOT EXISTS idx_inv_provision_status ON tbl_inv_stock_provision_header (status);
CREATE INDEX IF NOT EXISTS idx_inv_provision_wh ON tbl_inv_stock_provision_header (warehouse_id);


-- ============================================================================
-- SECTION 85: tbl_inv_stock_provision_item
-- DATE: 2026-10-20
-- FEATURE: Step 8.5 - Inventory Item-level Aging & Net Realisable Value (NRV) Provisioning
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_inv_provision_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_stock_provision_item (
    provision_item_id           BIGINT          PRIMARY KEY DEFAULT nextval('seq_inv_provision_item_id'),
    provision_id                BIGINT          NOT NULL REFERENCES tbl_inv_stock_provision_header(provision_id) ON DELETE CASCADE,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    warehouse_id                BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    bin_id                      BIGINT          REFERENCES tbl_inv_storage_bin(bin_id),
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
    item_code                   VARCHAR(50)     NOT NULL,
    item_name                   VARCHAR(200)    NOT NULL,
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    on_hand_qty                 NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    unit_cost                   NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    gross_valuation             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    first_inward_date           DATE,
    last_movement_date          DATE,
    age_in_days                 INT             NOT NULL DEFAULT 0,
    aging_bracket               VARCHAR(30)     NOT NULL DEFAULT '0_30'
                                                CHECK (aging_bracket IN ('0_30', '31_60', '61_90', '91_180', '181_365', 'GT_365')),
    fsn_classification          VARCHAR(20)     NOT NULL DEFAULT 'FAST'
                                                CHECK (fsn_classification IN ('FAST', 'SLOW', 'NON_MOVING')),
    provision_rate_percent      NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    provision_amount            NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    net_realizable_value        NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    justification               VARCHAR(250),
    remarks                     VARCHAR(250),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_inv_provision_item UNIQUE (provision_id, item_id, warehouse_id, batch_no)
);

CREATE INDEX IF NOT EXISTS idx_inv_provision_item_prov ON tbl_inv_stock_provision_item (provision_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inv_provision_item_item ON tbl_inv_stock_provision_item (item_id);
CREATE INDEX IF NOT EXISTS idx_inv_provision_item_bracket ON tbl_inv_stock_provision_item (aging_bracket);
CREATE INDEX IF NOT EXISTS idx_inv_provision_item_fsn ON tbl_inv_stock_provision_item (fsn_classification);


-- ============================================================================
-- SECTION 86: tbl_qc_in_process_header
-- DATE: 2026-10-20
-- FEATURE: Step 9.1 - In-Process & Stage-Wise Quality Inspection Header
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_qc_in_process_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_qc_in_process_header (
    ipqc_id                     BIGINT          PRIMARY KEY DEFAULT nextval('seq_qc_in_process_id'),
    ipqc_no                     VARCHAR(50)     NOT NULL, -- e.g. 'IPQC-AHM-2627-0001'
    ipqc_date                   DATE            NOT NULL DEFAULT CURRENT_DATE,
    wo_id                       BIGINT          NOT NULL REFERENCES tbl_mfg_wo_header(wo_id),
    job_card_id                 BIGINT          REFERENCES tbl_mfg_job_card(job_card_id),
    wo_routing_op_id            BIGINT          REFERENCES tbl_mfg_wo_routing_op(wo_routing_op_id),
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    work_center_id              BIGINT          REFERENCES tbl_mfg_work_center(work_center_id),
    machine_id                  BIGINT          REFERENCES tbl_mfg_work_center_machine(wc_machine_id),
    assigned_operator_id        BIGINT          REFERENCES tbl_sec_user(user_id),
    inspector_id                BIGINT          NOT NULL REFERENCES tbl_sec_user(user_id),
    inspection_stage            VARCHAR(40)     NOT NULL DEFAULT 'STAGE_COMPLETION'
                                                CHECK (inspection_stage IN ('FIRST_PIECE', 'PATROL_INSPECTION', 'STAGE_COMPLETION', 'LAST_PIECE')),
    shift_name                  VARCHAR(30)     NOT NULL DEFAULT 'Shift A',
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
    lot_qty                     NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    sample_size                 INT             NOT NULL DEFAULT 5,
    accepted_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    rejected_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    rework_qty                  NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    overall_result              VARCHAR(30)     NOT NULL DEFAULT 'PENDING'
                                                CHECK (overall_result IN ('PENDING', 'ACCEPTED', 'REJECTED', 'ACCEPTED_UNDER_DEVIATION')),
    disposition_type            VARCHAR(50)     DEFAULT 'DIRECT_ACCEPT'
                                                CHECK (disposition_type IN ('DIRECT_ACCEPT', 'SCRAP', 'REWORK_SAME_OP', 'REWORK_NEW_OP', 'CONCESSION_USE_AS_IS')),
    deviation_reason            VARCHAR(500),
    approver_id                 BIGINT          REFERENCES tbl_sec_user(user_id),
    approval_date               TIMESTAMPTZ,
    is_capa_required            BOOLEAN         NOT NULL DEFAULT FALSE,
    ncr_no                      VARCHAR(50),
    remarks                     VARCHAR(500),
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
    CONSTRAINT uq_qc_in_process_header_no UNIQUE (comp_id, branch_id, ipqc_no)
);

CREATE INDEX IF NOT EXISTS idx_qc_in_process_comp_branch ON tbl_qc_in_process_header (comp_id, branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_qc_in_process_wo ON tbl_qc_in_process_header (wo_id);
CREATE INDEX IF NOT EXISTS idx_qc_in_process_jc ON tbl_qc_in_process_header (job_card_id);
CREATE INDEX IF NOT EXISTS idx_qc_in_process_item ON tbl_qc_in_process_header (item_id);
CREATE INDEX IF NOT EXISTS idx_qc_in_process_status ON tbl_qc_in_process_header (status);
CREATE INDEX IF NOT EXISTS idx_qc_in_process_result ON tbl_qc_in_process_header (overall_result);
CREATE INDEX IF NOT EXISTS idx_qc_in_process_dates ON tbl_qc_in_process_header (ipqc_date, created_date);


-- ============================================================================
-- SECTION 87: tbl_qc_in_process_param
-- DATE: 2026-10-20
-- FEATURE: Step 9.1 - In-Process QC Inspection Characteristic / Parameter Observations
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_qc_in_process_param_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_qc_in_process_param (
    ipqc_param_id               BIGINT          PRIMARY KEY DEFAULT nextval('seq_qc_in_process_param_id'),
    ipqc_id                     BIGINT          NOT NULL REFERENCES tbl_qc_in_process_header(ipqc_id) ON DELETE CASCADE,
    param_sequence              INT             NOT NULL DEFAULT 1,
    param_name                  VARCHAR(150)    NOT NULL,
    param_category              VARCHAR(50)     NOT NULL DEFAULT 'DIMENSIONAL'
                                                CHECK (param_category IN ('DIMENSIONAL', 'METALLURGICAL', 'SURFACE_FINISH', 'VISUAL', 'FUNCTIONAL', 'TORQUE_TENSION')),
    instrument_name             VARCHAR(150),
    nominal_val                 NUMERIC(12, 4),
    min_tolerance               NUMERIC(12, 4),
    max_tolerance               NUMERIC(12, 4),
    uom_code                    VARCHAR(20)     DEFAULT 'mm',
    obs_val_1                   NUMERIC(12, 4),
    obs_val_2                   NUMERIC(12, 4),
    obs_val_3                   NUMERIC(12, 4),
    obs_val_4                   NUMERIC(12, 4),
    obs_val_5                   NUMERIC(12, 4),
    mean_val                    NUMERIC(12, 4),
    visual_result               VARCHAR(20)     DEFAULT 'PASS' CHECK (visual_result IN ('PASS', 'FAIL', 'NA')),
    param_result                VARCHAR(20)     NOT NULL DEFAULT 'PASS' CHECK (param_result IN ('PASS', 'FAIL', 'CONCESSION')),
    deviation_remarks           VARCHAR(250),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_qc_in_process_param_header ON tbl_qc_in_process_param (ipqc_id, is_active);
CREATE INDEX IF NOT EXISTS idx_qc_in_process_param_result ON tbl_qc_in_process_param (param_result);


-- ============================================================================
-- SECTION 88: tbl_qc_pdi_header
-- DATE: 2026-10-20
-- FEATURE: Step 9.2 - Final Pre-Dispatch Inspection (PDI) & Certificate of Analysis (CoA) Header
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_qc_pdi_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_qc_pdi_header (
    pdi_id                      BIGINT          PRIMARY KEY DEFAULT nextval('seq_qc_pdi_id'),
    pdi_no                      VARCHAR(50)     NOT NULL, -- e.g. 'PDI-AHM-2627-0001'
    pdi_date                    DATE            NOT NULL DEFAULT CURRENT_DATE,
    sales_order_id              BIGINT          REFERENCES tbl_sales_order_header(so_id),
    customer_id                 BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id),
    wo_id                       BIGINT          REFERENCES tbl_mfg_wo_header(wo_id),
    challan_id                  BIGINT          REFERENCES tbl_sales_delivery_challan_header(challan_id),
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    warehouse_id                BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
    lot_qty                     NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    sample_size                 INT             NOT NULL DEFAULT 5,
    accepted_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    rejected_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    rework_qty                  NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    overall_verdict             VARCHAR(30)     NOT NULL DEFAULT 'PENDING'
                                                CHECK (overall_verdict IN ('PENDING', 'APPROVED_FOR_DISPATCH', 'REJECTED_QUARANTINE', 'CONCESSION_ACCEPTED')),
    disposition                 VARCHAR(50)     DEFAULT 'CLEAR_FOR_INVOICE'
                                                CHECK (disposition IN ('CLEAR_FOR_INVOICE', 'QUARANTINE_HOLD', 'RETURN_TO_SHOPFLOOR', 'SCRAP', 'CONCESSION_USE_AS_IS')),
    inspector_id                BIGINT          NOT NULL REFERENCES tbl_sec_user(user_id),
    approver_id                 BIGINT          REFERENCES tbl_sec_user(user_id),
    approval_date               TIMESTAMPTZ,
    coa_no                      VARCHAR(50),    -- e.g. 'COA-AHM-2627-0001'
    coa_date                    DATE,
    mtc_no                      VARCHAR(100),   -- Linked MTC / EN 10204 3.1
    standard_specification      VARCHAR(150),   -- e.g. 'API 6D / ASME B16.34'
    packaging_condition         VARCHAR(30)     DEFAULT 'ACCEPTABLE'
                                                CHECK (packaging_condition IN ('ACCEPTABLE', 'DAMAGED_REPACK', 'POOR_LABELING', 'CRATE_HOLD')),
    labeling_verification       VARCHAR(20)     DEFAULT 'PASS' CHECK (labeling_verification IN ('PASS', 'FAIL', 'NA')),
    preservation_coating        VARCHAR(100),   -- e.g. 'Rust Preventive Oil VCI wrap'
    customer_witness_required   BOOLEAN         NOT NULL DEFAULT FALSE,
    customer_witness_name       VARCHAR(100),   -- e.g. TPI / Inspector Name
    customer_witness_date       DATE,
    is_coa_released             BOOLEAN         NOT NULL DEFAULT FALSE,
    coa_released_by             BIGINT          REFERENCES tbl_sec_user(user_id),
    coa_released_at             TIMESTAMPTZ,
    remarks                     VARCHAR(500),
    deviation_reason            VARCHAR(500),
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED')),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_qc_pdi_header_no UNIQUE (comp_id, branch_id, pdi_no)
);

CREATE INDEX IF NOT EXISTS idx_qc_pdi_comp_branch ON tbl_qc_pdi_header (comp_id, branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_qc_pdi_so ON tbl_qc_pdi_header (sales_order_id);
CREATE INDEX IF NOT EXISTS idx_qc_pdi_customer ON tbl_qc_pdi_header (customer_id);
CREATE INDEX IF NOT EXISTS idx_qc_pdi_item ON tbl_qc_pdi_header (item_id);
CREATE INDEX IF NOT EXISTS idx_qc_pdi_status ON tbl_qc_pdi_header (status);
CREATE INDEX IF NOT EXISTS idx_qc_pdi_verdict ON tbl_qc_pdi_header (overall_verdict);
CREATE INDEX IF NOT EXISTS idx_qc_pdi_coa ON tbl_qc_pdi_header (coa_no);
CREATE INDEX IF NOT EXISTS idx_qc_pdi_dates ON tbl_qc_pdi_header (pdi_date, created_date);

-- ============================================================================
-- SECTION 89: tbl_qc_pdi_param
-- DATE: 2026-10-20
-- FEATURE: Step 9.2 - Final PDI Characteristic & Functional Test Observations
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_qc_pdi_param_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_qc_pdi_param (
    pdi_param_id                BIGINT          PRIMARY KEY DEFAULT nextval('seq_qc_pdi_param_id'),
    pdi_id                      BIGINT          NOT NULL REFERENCES tbl_qc_pdi_header(pdi_id) ON DELETE CASCADE,
    param_sequence              INT             NOT NULL DEFAULT 1,
    param_name                  VARCHAR(150)    NOT NULL,
    param_category              VARCHAR(50)     NOT NULL DEFAULT 'FUNCTIONAL'
                                                CHECK (param_category IN ('DIMENSIONAL', 'FUNCTIONAL_PRESSURE', 'SURFACE_PAINT_DFT', 'VISUAL_PACKAGING', 'ELECTRICAL_ACTUATOR', 'METALLURGICAL_HARDNESS')),
    instrument_name             VARCHAR(150),
    nominal_val                 NUMERIC(12, 4),
    min_tolerance               NUMERIC(12, 4),
    max_tolerance               NUMERIC(12, 4),
    uom_code                    VARCHAR(20)     DEFAULT 'mm',
    observed_val_1              NUMERIC(12, 4),
    observed_val_2              NUMERIC(12, 4),
    observed_val_3              NUMERIC(12, 4),
    observed_val_4              NUMERIC(12, 4),
    observed_val_5              NUMERIC(12, 4),
    mean_val                    NUMERIC(12, 4),
    visual_result               VARCHAR(20)     DEFAULT 'PASS' CHECK (visual_result IN ('PASS', 'FAIL', 'NA')),
    param_result                VARCHAR(20)     NOT NULL DEFAULT 'PASS' CHECK (param_result IN ('PASS', 'FAIL', 'CONCESSION')),
    notes                       VARCHAR(250),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_qc_pdi_param_pdi ON tbl_qc_pdi_param (pdi_id, is_active);
CREATE INDEX IF NOT EXISTS idx_qc_pdi_param_result ON tbl_qc_pdi_param (param_result);

-- ============================================================================
-- SECTION 90: tbl_qc_pdi_coa_spec
-- DATE: 2026-10-20
-- FEATURE: Step 9.2 - Certificate of Analysis Chemical & Mechanical Matrix
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_qc_pdi_coa_spec_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_qc_pdi_coa_spec (
    coa_spec_id                 BIGINT          PRIMARY KEY DEFAULT nextval('seq_qc_pdi_coa_spec_id'),
    pdi_id                      BIGINT          NOT NULL REFERENCES tbl_qc_pdi_header(pdi_id) ON DELETE CASCADE,
    -- Chemical Composition % Matrix
    elem_c_pct                  NUMERIC(6, 4)   DEFAULT 0.0300,
    elem_mn_pct                 NUMERIC(6, 4)   DEFAULT 1.4500,
    elem_si_pct                 NUMERIC(6, 4)   DEFAULT 0.4200,
    elem_p_pct                  NUMERIC(6, 4)   DEFAULT 0.0250,
    elem_s_pct                  NUMERIC(6, 4)   DEFAULT 0.0120,
    elem_cr_pct                 NUMERIC(6, 4)   DEFAULT 17.2000,
    elem_ni_pct                 NUMERIC(6, 4)   DEFAULT 11.1000,
    elem_mo_pct                 NUMERIC(6, 4)   DEFAULT 2.1500,
    -- Mechanical Properties Matrix
    yield_strength_mpa          NUMERIC(8, 2)   DEFAULT 285.00,
    tensile_strength_mpa        NUMERIC(8, 2)   DEFAULT 580.00,
    elongation_pct              NUMERIC(6, 2)   DEFAULT 42.00,
    hardness_val                VARCHAR(30)     DEFAULT '185 HBW',
    impact_energy_joules        NUMERIC(8, 2)   DEFAULT 95.00,
    -- Metallurgical NDE & Testing Agency
    hydro_shell_test_bar        NUMERIC(8, 2)   DEFAULT 31.00, -- 450 PSI approx
    hydro_seat_test_bar         NUMERIC(8, 2)   DEFAULT 22.00,
    air_seat_test_bar           NUMERIC(8, 2)   DEFAULT 6.00,
    nde_test_type               VARCHAR(100)    DEFAULT '100% Visual + Dye Penetrant (PT) Flange Faces',
    nde_result                  VARCHAR(20)     DEFAULT 'ACCEPTED' CHECK (nde_result IN ('ACCEPTED', 'REJECTED', 'NA')),
    lab_name                    VARCHAR(150)    DEFAULT 'Kashvira Metallurgical Testing Laboratory (NABL Accredited)',
    certified_engineer          VARCHAR(100)    DEFAULT 'Er. R. K. Patel (Level-II NDT / ASNT)',
    certification_standard      VARCHAR(100)    DEFAULT 'EN 10204:2004 Type 3.1 / ISO 10474',
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_qc_pdi_coa_spec UNIQUE (pdi_id)
);

CREATE INDEX IF NOT EXISTS idx_qc_pdi_coa_spec_pdi ON tbl_qc_pdi_coa_spec (pdi_id);

-- ============================================================================
-- SECTION 91: tbl_qc_ncr_header
-- DATE: 2026-10-20
-- FEATURE: Step 9.3 - Non-Conformance Reports (NCR) & Material Review Board (MRB)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_qc_ncr_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_qc_ncr_header (
    ncr_id                      BIGINT          PRIMARY KEY DEFAULT nextval('seq_qc_ncr_id'),
    ncr_no                      VARCHAR(50)     NOT NULL UNIQUE,
    ncr_date                    DATE            NOT NULL DEFAULT CURRENT_DATE,
    ncr_type                    VARCHAR(40)     NOT NULL DEFAULT 'IN_PROCESS_DEFECT'
                                                CHECK (ncr_type IN ('INWARD_REJECTION', 'IN_PROCESS_DEFECT', 'PDI_FAILURE', 'CUSTOMER_RMA_RETURN', 'INTERNAL_AUDIT')),
    source_doc_type             VARCHAR(40)     NOT NULL DEFAULT 'IN_PROCESS_QC'
                                                CHECK (source_doc_type IN ('INWARD_QC', 'IN_PROCESS_QC', 'PDI_QC', 'SALES_RETURN', 'WORK_ORDER', 'GENERAL')),
    source_doc_id               BIGINT,
    source_doc_no               VARCHAR(50),
    source_doc_date             DATE,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_code                   VARCHAR(50)     NOT NULL,
    item_name                   VARCHAR(150)    NOT NULL,
    batch_no                    VARCHAR(50),
    heat_no                     VARCHAR(50),
    defect_severity             VARCHAR(20)     NOT NULL DEFAULT 'MAJOR'
                                                CHECK (defect_severity IN ('CRITICAL', 'MAJOR', 'MINOR')),
    defect_category             VARCHAR(50)     NOT NULL DEFAULT 'DIMENSIONAL'
                                                CHECK (defect_category IN ('DIMENSIONAL', 'METALLURGICAL', 'SURFACE_FINISH', 'PRESSURE_LEAK', 'VISUAL_PACKAGING', 'DOCUMENTATION', 'ASSEMBLY_FIT')),
    defect_description          TEXT            NOT NULL,
    inspected_qty               NUMERIC(14, 4)  NOT NULL DEFAULT 1.0000,
    rejected_qty                NUMERIC(14, 4)  NOT NULL DEFAULT 1.0000,
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    uom_code                    VARCHAR(20),
    containment_action          TEXT,
    quarantine_location         VARCHAR(100)    DEFAULT 'Quarantine Bay A1 (Red Tagged)',
    red_tag_no                  VARCHAR(50),
    mrb_disposition             VARCHAR(40)     NOT NULL DEFAULT 'PENDING'
                                                CHECK (mrb_disposition IN ('PENDING', 'SCRAP', 'REWORK_SAME_OP', 'REWORK_NEW_OP', 'USE_AS_IS_CONCESSION', 'RETURN_TO_VENDOR')),
    mrb_approver_id             BIGINT          REFERENCES tbl_sec_user(user_id),
    mrb_approver_name           VARCHAR(100),
    mrb_approval_date           TIMESTAMPTZ,
    mrb_notes                   TEXT,
    is_capa_required            BOOLEAN         NOT NULL DEFAULT TRUE,
    capa_status                 VARCHAR(30)     NOT NULL DEFAULT 'NOT_INITIATED'
                                                CHECK (capa_status IN ('NOT_INITIATED', 'INITIATED', 'UNDER_INVESTIGATION', 'IMPLEMENTED', 'VERIFIED_CLOSED')),
    status                      VARCHAR(30)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'UNDER_MRB_REVIEW', 'DISPOSITIONED', 'CAPA_ASSIGNED', 'CLOSED', 'CANCELLED')),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_qc_ncr_comp_branch ON tbl_qc_ncr_header (comp_id, branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_qc_ncr_item ON tbl_qc_ncr_header (item_id);
CREATE INDEX IF NOT EXISTS idx_qc_ncr_status ON tbl_qc_ncr_header (status);
CREATE INDEX IF NOT EXISTS idx_qc_ncr_date ON tbl_qc_ncr_header (ncr_date DESC);

-- ============================================================================
-- SECTION 92: tbl_qc_ncr_mrb_vote
-- DATE: 2026-10-20
-- FEATURE: Step 9.3 - Material Review Board (MRB) Member Votes & Dispositions
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_qc_ncr_mrb_vote_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_qc_ncr_mrb_vote (
    vote_id                     BIGINT          PRIMARY KEY DEFAULT nextval('seq_qc_ncr_mrb_vote_id'),
    ncr_id                      BIGINT          NOT NULL REFERENCES tbl_qc_ncr_header(ncr_id) ON DELETE CASCADE,
    voter_id                    BIGINT          NOT NULL REFERENCES tbl_sec_user(user_id),
    voter_name                  VARCHAR(100)    NOT NULL,
    voter_role                  VARCHAR(50)     NOT NULL,
    recommended_disposition     VARCHAR(40)     NOT NULL
                                                CHECK (recommended_disposition IN ('SCRAP', 'REWORK_SAME_OP', 'REWORK_NEW_OP', 'USE_AS_IS_CONCESSION', 'RETURN_TO_VENDOR')),
    vote_comments               TEXT,
    voted_at                    TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_qc_ncr_mrb_vote_ncr ON tbl_qc_ncr_mrb_vote (ncr_id, is_active);

-- ============================================================================
-- SECTION 93: tbl_qc_capa_action
-- DATE: 2026-10-20
-- FEATURE: Step 9.3 - 8D Corrective and Preventive Action (CAPA) Engine
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_qc_capa_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_qc_capa_action (
    capa_id                     BIGINT          PRIMARY KEY DEFAULT nextval('seq_qc_capa_id'),
    capa_no                     VARCHAR(50)     NOT NULL UNIQUE,
    ncr_id                      BIGINT          NOT NULL REFERENCES tbl_qc_ncr_header(ncr_id) ON DELETE CASCADE,
    initiation_date             DATE            NOT NULL DEFAULT CURRENT_DATE,
    target_completion_date      DATE            NOT NULL,
    actual_closure_date         DATE,
    root_cause_method           VARCHAR(50)     NOT NULL DEFAULT '5_WHY'
                                                CHECK (root_cause_method IN ('5_WHY', 'FISHBONE_ISHIKAWA', 'FMEA', 'FAULT_TREE')),
    root_cause_analysis         TEXT            NOT NULL,
    containment_action_plan     TEXT,
    corrective_action_plan      TEXT            NOT NULL,
    preventive_action_plan      TEXT            NOT NULL,
    assigned_to_id              BIGINT          NOT NULL REFERENCES tbl_sec_user(user_id),
    assigned_to_name            VARCHAR(100)    NOT NULL,
    verifier_id                 BIGINT          REFERENCES tbl_sec_user(user_id),
    verifier_name               VARCHAR(100),
    verification_remarks        TEXT,
    effectiveness_status        VARCHAR(30)     NOT NULL DEFAULT 'PENDING'
                                                CHECK (effectiveness_status IN ('PENDING', 'IMPLEMENTED', 'VERIFIED_EFFECTIVE', 'REOPENED')),
    status                      VARCHAR(25)     NOT NULL DEFAULT 'OPEN'
                                                CHECK (status IN ('OPEN', 'IN_PROGRESS', 'SUBMITTED_FOR_VERIFICATION', 'CLOSED', 'REOPENED')),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_qc_capa_ncr ON tbl_qc_capa_action (ncr_id, is_active);
CREATE INDEX IF NOT EXISTS idx_qc_capa_status ON tbl_qc_capa_action (status);

-- ============================================================================
-- SECTION 94: tbl_qc_gauge_master
-- DATE: 2026-10-20
-- FEATURE: Step 9.4 - Measuring Equipment & Gauge Calibration Master
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_qc_gauge_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_qc_gauge_master (
    gauge_id                    BIGINT          PRIMARY KEY DEFAULT nextval('seq_qc_gauge_id'),
    gauge_code                  VARCHAR(50)     NOT NULL UNIQUE,
    gauge_name                  VARCHAR(150)    NOT NULL,
    gauge_type                  VARCHAR(50)     NOT NULL DEFAULT 'MICROMETER'
                                                CHECK (gauge_type IN ('VERNIER_CALIPER', 'MICROMETER', 'DIAL_INDICATOR', 'PRESSURE_GAUGE', 'TORQUE_WRENCH', 'TEMPERATURE_CONTROLLER', 'HARDNESS_TESTER', 'CMM_PROBE', 'HEIGHT_GAUGE', 'BORE_GAUGE', 'SURFACE_ROUGHNESS_TESTER')),
    make_manufacturer           VARCHAR(100)    NOT NULL,
    model_no                    VARCHAR(50),
    serial_no                   VARCHAR(100)    NOT NULL,
    range_min                   NUMERIC(10, 4)  NOT NULL DEFAULT 0.0000,
    range_max                   NUMERIC(10, 4)  NOT NULL DEFAULT 25.0000,
    uom                         VARCHAR(20)     NOT NULL DEFAULT 'mm',
    least_count                 NUMERIC(10, 5)  NOT NULL DEFAULT 0.00100,
    max_permissible_error       NUMERIC(10, 5)  NOT NULL DEFAULT 0.00200,
    location_custody            VARCHAR(100)    NOT NULL DEFAULT 'CNC Machining Cell 01 - Quality Inspection Station',
    custodian_id                BIGINT          REFERENCES tbl_sec_user(user_id),
    custodian_name              VARCHAR(100),
    calibration_frequency_days  INT             NOT NULL DEFAULT 180,
    last_calibration_date       DATE            NOT NULL,
    next_calibration_due_date   DATE            NOT NULL,
    calibration_agency_type     VARCHAR(30)     NOT NULL DEFAULT 'NABL_EXTERNAL_LAB'
                                                CHECK (calibration_agency_type IN ('INTERNAL_LAB', 'NABL_EXTERNAL_LAB', 'OEM_MANUFACTURER')),
    agency_name                 VARCHAR(150)    NOT NULL DEFAULT 'Central Metallurgical & Gauge Metrology Lab (NABL Cert #CC-2914)',
    calibration_certificate_no  VARCHAR(100)    NOT NULL DEFAULT 'NABL-CAL-2026-9912',
    current_status              VARCHAR(30)     NOT NULL DEFAULT 'VALID'
                                                CHECK (current_status IN ('VALID', 'CALIBRATION_DUE', 'OVERDUE', 'UNDER_CALIBRATION', 'OUT_OF_TOLERANCE_LOCKOUT', 'SCRAPPED')),
    remarks                     TEXT,
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_qc_gauge_comp_branch ON tbl_qc_gauge_master (comp_id, branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_qc_gauge_status ON tbl_qc_gauge_master (current_status);
CREATE INDEX IF NOT EXISTS idx_qc_gauge_due_date ON tbl_qc_gauge_master (next_calibration_due_date ASC);

-- ============================================================================
-- SECTION 95: tbl_qc_gauge_calibration_history
-- DATE: 2026-10-20
-- FEATURE: Step 9.4 - Periodic Calibration Verification Events & MTC History
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_qc_gauge_cal_hist_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_qc_gauge_calibration_history (
    history_id                  BIGINT          PRIMARY KEY DEFAULT nextval('seq_qc_gauge_cal_hist_id'),
    gauge_id                    BIGINT          NOT NULL REFERENCES tbl_qc_gauge_master(gauge_id) ON DELETE CASCADE,
    calibration_event_no        VARCHAR(50)     NOT NULL,
    calibration_date            DATE            NOT NULL,
    certificate_no              VARCHAR(100)    NOT NULL,
    calibrated_by_agency        VARCHAR(150)    NOT NULL,
    calibrator_name             VARCHAR(100)    NOT NULL,
    master_instrument_traceability VARCHAR(200) NOT NULL DEFAULT 'Grade-0 Ceramic Gauge Block Set (NPL / NIST Traceable)',
    nominal_value               NUMERIC(10, 5)  NOT NULL DEFAULT 10.00000,
    observed_value              NUMERIC(10, 5)  NOT NULL DEFAULT 10.00050,
    error_val                   NUMERIC(10, 5)  NOT NULL DEFAULT 0.00050,
    permissible_tolerance       NUMERIC(10, 5)  NOT NULL DEFAULT 0.00200,
    calibration_result          VARCHAR(30)     NOT NULL DEFAULT 'PASS'
                                                CHECK (calibration_result IN ('PASS', 'PASS_WITH_CORRECTION', 'FAIL_OUT_OF_TOLERANCE')),
    next_due_date               DATE            NOT NULL,
    environmental_conditions    VARCHAR(150)    DEFAULT 'Temp: 20.0 ± 0.5 °C, Humidity: 50 ± 5% RH',
    certificate_url             VARCHAR(255),
    verified_by_user_id         BIGINT          REFERENCES tbl_sec_user(user_id),
    verified_by_name            VARCHAR(100),
    remarks                     TEXT,
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_qc_gauge_cal_hist_gauge ON tbl_qc_gauge_calibration_history (gauge_id, is_active);
CREATE INDEX IF NOT EXISTS idx_qc_gauge_cal_hist_date ON tbl_qc_gauge_calibration_history (calibration_date DESC);



