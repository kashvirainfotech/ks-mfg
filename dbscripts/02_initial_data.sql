-- ============================================================================
-- KS-MFG ERP: Necessary System Initial Data & Inserts
-- Description: Single SQL file containing ALL necessary system INSERT
--              statements required for the application to function (e.g.,
--              system configurations, default voucher types, system roles,
--              standard UOMs, system screens, actions, super admin seed).
-- Rule:
--   1. All essential setup/seed INSERT statements must reside in this file.
--   2. New system inserts for newly introduced screens/features must be
--      appended at the END of this file with proper date and info comments.
-- ============================================================================

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 0.1 - Core Foundation System Seeds (Tenancy, Global Roles,
--          Screens, Action Items, and Root Super Admin Account)
-- ============================================================================

-- 1. Default Primary Company (comp_id = 1001)
INSERT INTO tbl_org_company (
    comp_id, comp_code, comp_name, legal_name, gstin, pan_no, cin_no,
    base_currency_code, registered_address, city, state_name, state_code,
    pincode, country, phone, email, website, is_active,
    branch_id, fyear_id, created_by
) VALUES (
    1001, 'KSMFG', 'Kashvira Manufacturing ERP', 'Kashvira Precision Manufacturing Pvt. Ltd.',
    '24AABCK1234F1Z5', 'AABCK1234F', 'U29100GJ2020PTC112233',
    'INR', 'Plot 42, GIDC Industrial Estate, Sanand', 'Ahmedabad', 'Gujarat', '24',
    '382110', 'India', '+91-79-26543210', 'info@ksmfg.com', 'https://www.ksmfg.com', TRUE,
    1001, 1001, 1001
) ON CONFLICT (comp_id) DO NOTHING;

SELECT setval('seq_comp_id', GREATEST((SELECT COALESCE(MAX(comp_id), 1001) FROM tbl_org_company), 1001));

-- 2. Default Head Office & Main Manufacturing Plant Branch (branch_id = 1001)
INSERT INTO tbl_org_branch (
    branch_id, branch_code, branch_name, branch_type, gstin,
    address, city, state_name, state_code, pincode, country,
    phone, email, is_head_office, is_active,
    comp_id, fyear_id, created_by
) VALUES (
    1001, 'PLT-AHM-01', 'Ahmedabad Main Plant & HO', 'PLANT', '24AABCK1234F1Z5',
    'Plot 42, GIDC Industrial Estate, Sanand', 'Ahmedabad', 'Gujarat', '24', '382110', 'India',
    '+91-79-26543210', 'ahm.plant@ksmfg.com', TRUE, TRUE,
    1001, 1001, 1001
) ON CONFLICT (branch_id) DO NOTHING;

SELECT setval('seq_branch_id', GREATEST((SELECT COALESCE(MAX(branch_id), 1001) FROM tbl_org_branch), 1001));

-- 3. Default Active Financial Year (fyear_id = 1001)
INSERT INTO tbl_org_financial_year (
    fyear_id, fyear_code, fyear_name, start_date, end_date,
    is_current, is_closed, is_active,
    comp_id, branch_id, created_by
) VALUES (
    1001, '2026-27', 'FY 2026-2027', '2026-04-01', '2027-03-31',
    TRUE, FALSE, TRUE,
    1001, 1001, 1001
) ON CONFLICT (fyear_id) DO NOTHING;

SELECT setval('seq_fyear_id', GREATEST((SELECT COALESCE(MAX(fyear_id), 1001) FROM tbl_org_financial_year), 1001));

-- 4. Default Branch-Financial Year Activation Mapping (branch_fyear_id = 1001)
INSERT INTO tbl_org_branch_fyear (
    branch_fyear_id, is_locked, books_begin_from, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1001, FALSE, '2026-04-01', TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (branch_fyear_id) DO NOTHING;

SELECT setval('seq_branch_fyear_id', GREATEST((SELECT COALESCE(MAX(branch_fyear_id), 1001) FROM tbl_org_branch_fyear), 1001));

-- 5. System Global Roles (Independent of Company/Branch)
INSERT INTO tbl_sec_role (
    role_id, role_code, role_name, role_description, is_system_role, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'SUPER_ADMIN',   'Super Administrator',      'Unrestricted global system administrator across all companies and branches', TRUE,  TRUE, 1001, 1001, 1001, 1001),
    (1002, 'PLANT_MANAGER', 'Plant Operations Manager', 'Full manufacturing, planning, quality, and store approval authority at assigned branches', TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1003, 'STORE_OFFICER', 'Warehouse & Store Officer','Manages GRN inward, bin put-away, shopfloor material issue, and stock transfers', TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1004, 'PURCHASE_EXEC', 'Procurement Executive',    'Manages supplier master, purchase orders, and purchase invoices', TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1005, 'SALES_EXEC',    'Sales & Dispatch Executive','Manages customer master, price lists, sales orders, challans, and invoicing', TRUE, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id) DO NOTHING;

SELECT setval('seq_role_id', GREATEST((SELECT COALESCE(MAX(role_id), 1005) FROM tbl_sec_role), 1005));

-- 6. System Screen Catalogue (tbl_sec_screen)
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'DASHBOARD',        'Plant Operations Dashboard', 'DASHBOARD',     '/dashboard',             'LayoutDashboard', 1,  TRUE, 1001, 1001, 1001, 1001),
    (1002, 'COMPANY_MASTER',   'Company Master',             'ORGANIZATION',  '/org/companies',         'Building2',       2,  TRUE, 1001, 1001, 1001, 1001),
    (1003, 'BRANCH_MASTER',    'Branch & Plant Master',      'ORGANIZATION',  '/org/branches',          'GitBranch',       3,  TRUE, 1001, 1001, 1001, 1001),
    (1004, 'FYEAR_MASTER',     'Financial Year Master',      'ORGANIZATION',  '/org/financial-years',   'CalendarRange',   4,  TRUE, 1001, 1001, 1001, 1001),
    (1005, 'DEPT_MASTER',      'Department & Designation',   'SECURITY',      '/hr/departments',        'Network',         5,  TRUE, 1001, 1001, 1001, 1001),
    (1006, 'EMPLOYEE_MASTER',  'Employee Master',            'SECURITY',      '/hr/employees',          'IdCard',          6,  TRUE, 1001, 1001, 1001, 1001),
    (1007, 'ROLE_MASTER',      'Global Roles & Permissions', 'SECURITY',      '/security/roles',        'ShieldCheck',     7,  TRUE, 1001, 1001, 1001, 1001),
    (1008, 'USER_MASTER',      'User Master & Role Mapping', 'SECURITY',      '/security/users',        'UserCog',         8,  TRUE, 1001, 1001, 1001, 1001),
    (1009, 'AUDIT_LOG',        'Security & Delta Audit Log', 'SECURITY',      '/security/audit-logs',   'History',         9,  TRUE, 1001, 1001, 1001, 1001),
    (1010, 'CONFIG_MASTER',    'System Configuration Matrix','ADMINISTRATION','/admin/configurations',  'Sliders',         10, TRUE, 1001, 1001, 1001, 1001),
    (1011, 'WAREHOUSE_MASTER', 'Warehouse & Bin Hierarchy',  'INVENTORY',     '/inventory/warehouses',  'Warehouse',       11, TRUE, 1001, 1001, 1001, 1001),
    (1012, 'UOM_MASTER',       'UOM & Item Categories',      'INVENTORY',     '/inventory/uoms',        'Scale',           12, TRUE, 1001, 1001, 1001, 1001),
    (1013, 'ITEM_MASTER',      'Item & Material Master',     'INVENTORY',     '/inventory/items',       'Package',         13, TRUE, 1001, 1001, 1001, 1001),
    (1014, 'PARTY_MASTER',     'Customer & Supplier Master', 'CRM_SRM',       '/parties/master',        'Users',           14, TRUE, 1001, 1001, 1001, 1001),
    (1015, 'PRICE_LIST',       'Tiered Price List Master',   'CRM_SRM',       '/parties/price-lists',   'Tag',             15, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1015) FROM tbl_sec_screen), 1015));

-- 7. Screen Custom Action Items (PRINT, EXPORT) for Core Screens
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 'EXPORT', 'Export Dashboard KPIs', TRUE, 1001, 1001, 1001, 1001),
    (1002, 1002, 'EXPORT', 'Export Companies List', TRUE, 1001, 1001, 1001, 1001),
    (1003, 1003, 'EXPORT', 'Export Branches List',  TRUE, 1001, 1001, 1001, 1001),
    (1004, 1009, 'EXPORT', 'Export Audit Trail',    TRUE, 1001, 1001, 1001, 1001),
    (1005, 1013, 'EXPORT', 'Export Item Master',    TRUE, 1001, 1001, 1001, 1001),
    (1006, 1014, 'EXPORT', 'Export Party Master',   TRUE, 1001, 1001, 1001, 1001),
    (1007, 1014, 'PRINT',  'Print Party Directory', TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (action_id) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1007) FROM tbl_sec_action), 1007));

-- 8. Grant Full Screen Permissions to SUPER_ADMIN (role_id = 1001)
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
)
SELECT 1001, s.screen_id, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001
FROM tbl_sec_screen s
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- 9. Grant Full Action Permissions to SUPER_ADMIN (role_id = 1001)
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
)
SELECT 1001, a.screen_id, a.action_id, TRUE, 1001, 1001, 1001, 1001
FROM tbl_sec_action a
ON CONFLICT (role_id, action_id) DO NOTHING;

-- 10. Root Super Admin User Account (user_id = 1001, username = 'admin', password = 'Admin@123')
-- Bcrypt hash below is for 'Admin@123' (12 rounds)
INSERT INTO tbl_sec_user (
    user_id, username, email, mobile, password_hash, full_name,
    user_category, linked_entity_id, is_super_admin, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1001, 'admin', 'admin@ksmfg.com', '+91-9876543210',
    '$2b$12$BmHc8w3xeoS0Jai/3btss.XgwSnwCX6QjMc2lMCuw0qnGiR44HAbS',
    'Rajesh Patel (Super Admin)',
    'SYSTEM', NULL, TRUE, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (user_id) DO NOTHING;

SELECT setval('seq_user_id', GREATEST((SELECT COALESCE(MAX(user_id), 1001) FROM tbl_sec_user), 1001));

-- 11. Super Admin Company & Branch Role Assignments
INSERT INTO tbl_sec_user_company_role (
    user_company_role_id, user_id, mapped_comp_id, role_id, is_default, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1001, 1001, 1001, 1001, TRUE, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (user_id, mapped_comp_id, role_id) DO NOTHING;

SELECT setval('seq_user_company_role_id', GREATEST((SELECT COALESCE(MAX(user_company_role_id), 1001) FROM tbl_sec_user_company_role), 1001));

INSERT INTO tbl_sec_user_branch_role (
    user_branch_role_id, user_id, mapped_comp_id, mapped_branch_id, role_id, is_default, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1001, 1001, 1001, 1001, 1001, TRUE, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (user_id, mapped_branch_id, role_id) DO NOTHING;

SELECT setval('seq_user_branch_role_id', GREATEST((SELECT COALESCE(MAX(user_branch_role_id), 1001) FROM tbl_sec_user_branch_role), 1001));

-- 12. Super Admin Default UI & Theme Preferences
INSERT INTO tbl_sec_user_preference (
    user_preference_id, user_id, theme_mode, theme_color, sidebar_collapsed,
    default_comp_id, default_branch_id, default_fyear_id,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1001, 1001, 'light', 'indigo', FALSE,
    1001, 1001, 1001,
    1001, 1001, 1001, 1001
) ON CONFLICT (user_id) DO NOTHING;

SELECT setval('seq_user_preference_id', GREATEST((SELECT COALESCE(MAX(user_preference_id), 1001) FROM tbl_sec_user_preference), 1001));


-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 1.1 - Company Master Screen Action Seeds
-- ============================================================================
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1008, 1002, 'PRINT', 'Print Company Directory', TRUE, 1001, 1001, 1001, 1001
) ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1008) FROM tbl_sec_action), 1008));

INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1001, 1002, 1008, TRUE, 1001, 1001, 1001, 1001
) ON CONFLICT (role_id, action_id) DO NOTHING;


-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 1.2 - Branch & Plant Master Screen Action Seeds
-- ============================================================================
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1009, 1003, 'PRINT', 'Print Branch & Plant Directory', TRUE, 1001, 1001, 1001, 1001
) ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1009) FROM tbl_sec_action), 1009));

INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1001, 1003, 1009, TRUE, 1001, 1001, 1001, 1001
) ON CONFLICT (role_id, action_id) DO NOTHING;


-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 1.3 - Financial Year Master & Branch-FY Locking Action Seeds
-- ============================================================================
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1010, 1004, 'EXPORT', 'Export Financial Years & Branch Locks', TRUE, 1001, 1001, 1001, 1001),
    (1011, 1004, 'PRINT',  'Print Financial Year Register',         TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1011) FROM tbl_sec_action), 1011));

INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1004, 1010, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1004, 1011, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;




-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.1 - Department & Designation Master Action Seeds
-- ============================================================================
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1012, 1005, 'EXPORT', 'Export Departments & Designations', TRUE, 1001, 1001, 1001, 1001),
    (1013, 1005, 'PRINT',  'Print HR Organization Directory',   TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1013) FROM tbl_sec_action), 1013));

INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1005, 1012, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1005, 1013, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.2 - Employee Master Screen Action Seeds
-- ============================================================================
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1014, 1006, 'EXPORT', 'Export Employee Master Directory', TRUE, 1001, 1001, 1001, 1001),
    (1015, 1006, 'PRINT',  'Print Employee Register',          TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1015) FROM tbl_sec_action), 1015));

INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1006, 1014, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1006, 1015, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.3 - Global Roles & Granular Screen/Action Permissions Matrix
-- ============================================================================
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1016, 1007, 'EXPORT', 'Export Global Roles & Permission Matrix', TRUE, 1001, 1001, 1001, 1001),
    (1017, 1007, 'PRINT',  'Print Role Permission Matrix',            TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1017) FROM tbl_sec_action), 1017));

INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1007, 1016, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1007, 1017, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- Baseline Screen Permissions for System Operational Roles (1002..1005)
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- 1002: PLANT_MANAGER
    (1002, 1001, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001),
    (1002, 1003, TRUE, FALSE, TRUE,  FALSE, 1001, 1001, 1001, 1001),
    (1002, 1004, TRUE, FALSE, TRUE,  FALSE, 1001, 1001, 1001, 1001),
    (1002, 1005, TRUE, TRUE,  TRUE,  FALSE, 1001, 1001, 1001, 1001),
    (1002, 1006, TRUE, TRUE,  TRUE,  FALSE, 1001, 1001, 1001, 1001),
    (1002, 1011, TRUE, TRUE,  TRUE,  FALSE, 1001, 1001, 1001, 1001),
    (1002, 1012, TRUE, TRUE,  TRUE,  FALSE, 1001, 1001, 1001, 1001),
    (1002, 1013, TRUE, TRUE,  TRUE,  FALSE, 1001, 1001, 1001, 1001),
    -- 1003: STORE_OFFICER
    (1003, 1001, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1011, TRUE, TRUE,  TRUE,  FALSE, 1001, 1001, 1001, 1001),
    (1003, 1012, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1013, TRUE, TRUE,  TRUE,  FALSE, 1001, 1001, 1001, 1001),
    -- 1004: PURCHASE_EXEC
    (1004, 1001, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1013, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1014, TRUE, TRUE,  TRUE,  FALSE, 1001, 1001, 1001, 1001),
    (1004, 1015, TRUE, TRUE,  TRUE,  FALSE, 1001, 1001, 1001, 1001),
    -- 1005: SALES_EXEC
    (1005, 1001, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1013, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1014, TRUE, TRUE,  TRUE,  FALSE, 1001, 1001, 1001, 1001),
    (1005, 1015, TRUE, TRUE,  TRUE,  FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, screen_id) DO NOTHING;

SELECT setval('seq_role_permission_id', GREATEST((SELECT COALESCE(MAX(role_permission_id), 1001) FROM tbl_sec_role_permission), 1001));

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.4 - User Master & Multi-Company / Multi-Branch Role Assignment
-- ============================================================================
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1018, 1008, 'EXPORT', 'Export User Directory & Role Mappings', TRUE, 1001, 1001, 1001, 1001),
    (1019, 1008, 'PRINT',  'Print User & Role Matrix Register',     TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1019) FROM tbl_sec_action), 1019));

INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1008, 1018, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1008, 1019, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.5 - Security & Field-Delta Audit Trail Viewer Action Seeds
-- ============================================================================
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1020, 1009, 'PRINT', 'Print Security & Delta Audit Trail', TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1020) FROM tbl_sec_action), 1020));

INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1009, 1020, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.6 - System Configuration Matrix & Document Numbering Series
--          Engine Seeds (tbl_sec_action, tbl_sys_config, tbl_sys_doc_number_series)
-- ============================================================================
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1021, 1010, 'EXPORT', 'Export System Configurations & Number Series', TRUE, 1001, 1001, 1001, 1001),
    (1022, 1010, 'PRINT',  'Print System Configuration & Series Register', TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1022) FROM tbl_sec_action), 1022));

INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1010, 1021, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1010, 1022, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- Baseline Global System Configurations (tbl_sys_config)
INSERT INTO tbl_sys_config (
    config_id, config_key, config_name, config_group, data_type,
    config_value, default_value, allowed_values, scope_level,
    target_comp_id, target_branch_id, description, is_system_locked, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'INV_VALUATION_METHOD',          'Default Inventory Valuation Method',            'INVENTORY_VALUATION',  'ENUM',    'FIFO',          'FIFO',          'FIFO,WEIGHTED_AVG,STANDARD_COST', 'GLOBAL', NULL, NULL, 'Determines how raw materials, WIP, and finished goods are valued across ledger postings', TRUE,  TRUE, 1001, 1001, 1001, 1001),
    (1002, 'INV_ALLOW_NEGATIVE_STOCK',      'Allow Negative Bin Stock on Issue',             'INVENTORY_VALUATION',  'BOOLEAN', 'FALSE',         'FALSE',         NULL,                              'GLOBAL', NULL, NULL, 'Strictly blocks material issue or dispatch when available bin stock is insufficient',     TRUE,  TRUE, 1001, 1001, 1001, 1001),
    (1003, 'INV_BATCH_TRACEABILITY_STRICT', 'Enforce Mandatory Heat/Batch Lot Traceability', 'INVENTORY_VALUATION',  'BOOLEAN', 'TRUE',          'TRUE',          NULL,                              'GLOBAL', NULL, NULL, 'Requires batch/heat number capture at GRN, QC, shopfloor issue, and customer dispatch',    FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1004, 'PROD_BACKFLUSH_RAW_MATERIAL',   'Auto-Backflush Child BOM Items on PRN',         'PRODUCTION_SHOPFLOOR', 'BOOLEAN', 'FALSE',         'FALSE',         NULL,                              'GLOBAL', NULL, NULL, 'Automatically deducts shopfloor WIP bin stock based on standard BOM quantities on PRN',   FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1005, 'PROD_MAX_SCRAP_TOLERANCE_PCT',  'Shopfloor Scrap Variance Alert Threshold (%)',  'PRODUCTION_SHOPFLOOR', 'NUMBER',  '3.5',           '5.0',           NULL,                              'GLOBAL', NULL, NULL, 'Triggers supervisor authorization when work order scrap exceeds standard BOM scrap %',     FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1006, 'QC_MANDATORY_BEFORE_GRN_PUTAWAY','Mandatory Inward QC Clearance Before Bin Put-Away','QUALITY_CONTROL',  'BOOLEAN', 'TRUE',          'TRUE',          NULL,                              'GLOBAL', NULL, NULL, 'Holds inward GRN stock in Quarantine Zone until QA Manager approves test certificate',    TRUE,  TRUE, 1001, 1001, 1001, 1001),
    (1007, 'PROC_PO_RATE_VARIANCE_LIMIT_PCT','Max GRN vs PO Rate Variance Tolerance (%)',    'PROCUREMENT_APPROVAL', 'NUMBER',  '2.0',           '2.0',           NULL,                              'GLOBAL', NULL, NULL, 'Maximum upward price variance (%) permitted on supplier invoice against approved PO rate', FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1008, 'GST_EINVOICE_AUTO_IRN_THRESHOLD','E-Invoice & E-Way Bill Auto-Trigger Limit (INR)','GST_STATUTORY',      'NUMBER',  '50000',         '50000',         NULL,                              'GLOBAL', NULL, NULL, 'Minimum invoice value in INR above which E-Way Bill / IRN validation is enforced',        FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1009, 'SEC_MAX_FAILED_LOGIN_ATTEMPTS', 'Account Lockout Failed Login Threshold',        'SECURITY_SESSION',     'NUMBER',  '5',             '5',             NULL,                              'GLOBAL', NULL, NULL, 'Locks ERP user account for 30 minutes after consecutive failed password attempts',        TRUE,  TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (config_id) DO NOTHING;

SELECT setval('seq_config_id', GREATEST((SELECT COALESCE(MAX(config_id), 1009) FROM tbl_sys_config), 1009));

-- Baseline Document Numbering Series for Primary Plant (comp_id=1001, branch_id=1001, fyear_id=1001)
INSERT INTO tbl_sys_doc_number_series (
    series_id, series_code, series_name, doc_type_code, doc_type_name, module_name,
    target_comp_id, target_branch_id, target_fyear_id,
    prefix_template, suffix_template, separator_char, padding_digits,
    starting_no, current_next_no, reset_frequency, allow_manual_override, is_default, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'AHM-PO-2627',  'Ahmedabad Plant Purchase Order Series',       'PO',               'Purchase Order',              'PROCUREMENT',    1001, 1001, 1001, 'KSMFG/AHM/PO',  '26-27', '/', 4, 1, 14, 'FYEAR', FALSE, TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1002, 'AHM-GRN-2627', 'Ahmedabad Plant Goods Receipt Note Series',   'GRN',              'Goods Receipt Note (GRN)',    'INVENTORY_WMS',  1001, 1001, 1001, 'KSMFG/AHM/GRN', '26-27', '/', 4, 1, 28, 'FYEAR', FALSE, TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1003, 'AHM-QCI-2627', 'Ahmedabad Plant Inward QC Inspection Series', 'QC_INSP',          'Quality Inspection Lot',      'QUALITY',        1001, 1001, 1001, 'KSMFG/AHM/QCI', '26-27', '/', 4, 1, 22, 'FYEAR', FALSE, TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1004, 'AHM-WO-2627',  'Ahmedabad Plant Shopfloor Work Order Series', 'WORK_ORDER',       'Manufacturing Work Order',    'PRODUCTION',     1001, 1001, 1001, 'KSMFG/AHM/WO',  '26-27', '/', 4, 1, 19, 'FYEAR', FALSE, TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1005, 'AHM-MIS-2627', 'Ahmedabad Plant Shopfloor Material Issue',    'MAT_ISSUE',        'Material Issue Slip (MIS)',   'INVENTORY_WMS',  1001, 1001, 1001, 'KSMFG/AHM/MIS', '26-27', '/', 4, 1, 35, 'FYEAR', FALSE, TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1006, 'AHM-PRN-2627', 'Ahmedabad Plant Production Receipt Series',   'PROD_RECEIPT',     'Production Receipt Note',     'PRODUCTION',     1001, 1001, 1001, 'KSMFG/AHM/PRN', '26-27', '/', 4, 1, 16, 'FYEAR', FALSE, TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1007, 'AHM-SO-2627',  'Ahmedabad Plant Customer Sales Order Series', 'SALES_ORDER',      'Customer Sales Order',        'SALES_DISPATCH', 1001, 1001, 1001, 'KSMFG/AHM/SO',  '26-27', '/', 4, 1, 42, 'FYEAR', FALSE, TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1008, 'AHM-INV-2627', 'Ahmedabad Plant GST Tax Invoice Series',      'SALES_INVOICE',    'GST Tax Invoice',             'SALES_DISPATCH', 1001, 1001, 1001, 'KSMFG/AHM/INV', '26-27', '/', 4, 1, 31, 'FYEAR', FALSE, TRUE, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (series_id) DO NOTHING;

SELECT setval('seq_doc_series_id', GREATEST((SELECT COALESCE(MAX(series_id), 1008) FROM tbl_sys_doc_number_series), 1008));

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 3.1 - Multi-Level Warehouse & Storage Bin Hierarchy Action Seeds
-- ============================================================================
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1023, 1011, 'EXPORT', 'Export Warehouses & Storage Bin Hierarchy', TRUE, 1001, 1001, 1001, 1001),
    (1024, 1011, 'PRINT',  'Print Warehouse & Bin Topology Register',   TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1024) FROM tbl_sec_action), 1024));

INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1011, 1023, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1011, 1024, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1011, 1023, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1011, 1023, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 3.2 - UOM Master & Item Categories Action Seeds (screen_id = 1012)
-- ============================================================================
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1025, 1012, 'EXPORT', 'Export UOMs & Item Categories',           TRUE, 1001, 1001, 1001, 1001),
    (1026, 1012, 'PRINT',  'Print UOM & Item Category Directory',     TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1026) FROM tbl_sec_action), 1026));

INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1012, 1025, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1012, 1026, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1012, 1025, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1012, 1025, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1012, 1025, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- Standard Baseline Units of Measurement (tbl_inv_uom)
INSERT INTO tbl_inv_uom (
    uom_id, uom_code, uom_name, uom_type, decimal_precision,
    gst_uqc_code, is_base_uom, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'KG',   'Kilogram',                    'WEIGHT', 3, 'KGS', TRUE,  TRUE, 1001, 1001, 1001, 1001),
    (1002, 'TON',  'Metric Tonne (1,000 kg)',     'WEIGHT', 3, 'TON', FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1003, 'NOS',  'Numbers / Individual Pieces', 'COUNT',  0, 'NOS', TRUE,  TRUE, 1001, 1001, 1001, 1001),
    (1004, 'BOX',  'Box / Outer Carton',          'COUNT',  0, 'BOX', FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1005, 'MTR',  'Linear Meter',                'LENGTH', 2, 'MTR', TRUE,  TRUE, 1001, 1001, 1001, 1001),
    (1006, 'MM',   'Millimeter',                  'LENGTH', 2, 'MTR', FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1007, 'LTR',  'Litre (Liquid Volume)',       'VOLUME', 3, 'LTR', TRUE,  TRUE, 1001, 1001, 1001, 1001),
    (1008, 'ROLL', 'Roll / Continuous Coil',      'COUNT',  0, 'ROL', FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1009, 'SET',  'Assembly Kit / Set',          'COUNT',  0, 'SET', FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1010, 'SQM',  'Square Meter (Sheet Area)',   'AREA',   2, 'SQM', TRUE,  TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (uom_id) DO NOTHING;

SELECT setval('seq_uom_id', GREATEST((SELECT COALESCE(MAX(uom_id), 1010) FROM tbl_inv_uom), 1010));

-- Standard Baseline UOM Conversion Matrix (tbl_inv_uom_conversion)
INSERT INTO tbl_inv_uom_conversion (
    conversion_id, from_uom_id, to_uom_id,
    conversion_factor, inverse_factor, conversion_type, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1002, 1001, 1000.000000, 0.001000, 'STANDARD', '1 Metric Tonne = 1000 Kilograms', TRUE, 1001, 1001, 1001, 1001),
    (1002, 1001, 1002, 0.001000, 1000.000000, 'STANDARD', '1 Kilogram = 0.001 Metric Tonnes', TRUE, 1001, 1001, 1001, 1001),
    (1003, 1005, 1006, 1000.000000, 0.001000, 'STANDARD', '1 Meter = 1000 Millimeters',       TRUE, 1001, 1001, 1001, 1001),
    (1004, 1006, 1005, 0.001000, 1000.000000, 'STANDARD', '1 Millimeter = 0.001 Meters',       TRUE, 1001, 1001, 1001, 1001),
    (1005, 1004, 1003, 50.000000,   0.020000, 'PACKAGING','Standard Secondary Box = 50 Pieces',TRUE, 1001, 1001, 1001, 1001),
    (1006, 1008, 1005, 250.000000,  0.004000, 'STANDARD', 'Standard Raw Coil Roll = 250 Meters',TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (conversion_id) DO NOTHING;

SELECT setval('seq_uom_conversion_id', GREATEST((SELECT COALESCE(MAX(conversion_id), 1006) FROM tbl_inv_uom_conversion), 1006));

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 3.3 - Item & Material Master Screen Action Seeds
-- ============================================================================
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1027, 1013, 'PRINT', 'Print Item Specification / Datasheet', TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1027) FROM tbl_sec_action), 1027));

INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1013, 1005, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1013, 1027, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1013, 1005, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1013, 1027, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1013, 1005, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1013, 1027, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1013, 1005, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1013, 1027, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1013, 1005, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1013, 1027, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 4.1 - Unified Party Master Screen & Action Permissions
-- ============================================================================
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1002, 1014, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1014, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1014, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1014, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, screen_id) DO NOTHING;

INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1014, 1006, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1014, 1007, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1014, 1006, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1014, 1007, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1014, 1006, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1014, 1007, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1014, 1006, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1014, 1007, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1014, 1006, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1014, 1007, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;







-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 4.2 - Tiered Price Lists & Vendor Rate Contracts Screen & Action Permissions
-- ============================================================================
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1028, 1015, 'EXPORT', 'Export Price Lists & Rate Cards', TRUE, 1001, 1001, 1001, 1001),
    (1029, 1015, 'PRINT',  'Print Price List Rate Card',      TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1029) FROM tbl_sec_action), 1029));

INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1002, 1015, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1015, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1015, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1015, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, screen_id) DO NOTHING;

INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1015, 1028, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1015, 1029, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1015, 1028, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1015, 1029, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1015, 1028, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1015, 1029, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1015, 1028, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1015, 1029, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1015, 1028, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1015, 1029, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;


-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 5.1 - Material Purchase Requisition (MR) Screen & Actions
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1016, 'PURCHASE_REQ', 'Purchase Requisitions', 'PROCUREMENT', '/procurement/requisitions', 'ClipboardList', 16, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1016) FROM tbl_sec_screen), 1016));

INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1030, 1016, 'EXPORT',    'Export Purchase Requisitions',     TRUE, 1001, 1001, 1001, 1001),
    (1031, 1016, 'PRINT',     'Print Requisition Voucher',        TRUE, 1001, 1001, 1001, 1001),
    (1032, 1016, 'SUBMIT',    'Submit Requisition for Approval',  TRUE, 1001, 1001, 1001, 1001),
    (1033, 1016, 'AUTHORIZE', 'Approve or Reject Requisitions',   TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1033) FROM tbl_sec_action), 1033));

-- Grant screen permissions to roles
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1016, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1016, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1016, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER
    (1004, 1016, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PURCHASE_EXEC
    (1005, 1016, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001) -- SALES_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN
    (1001, 1016, 1030, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1016, 1031, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1016, 1032, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1016, 1033, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (can Authorize)
    (1002, 1016, 1030, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1016, 1031, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1016, 1032, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1016, 1033, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (can Submit)
    (1003, 1016, 1030, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1016, 1031, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1016, 1032, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1016, 1033, FALSE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (can Submit & Authorize)
    (1004, 1016, 1030, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1016, 1031, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1016, 1032, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1016, 1033, TRUE, 1001, 1001, 1001, 1001),
    -- SALES_EXEC (view only)
    (1005, 1016, 1030, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1016, 1031, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1016, 1032, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1016, 1033, FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 5.2 - Supplier Request for Quotation (RFQ) & CS Screen & Actions
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1017, 'PROCUREMENT_RFQ', 'Requests for Quotation (RFQ)', 'PROCUREMENT', '/procurement/rfqs', 'FileSpreadsheet', 17, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1017) FROM tbl_sec_screen), 1017));

INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1034, 1017, 'EXPORT',   'Export RFQs & Quotations',                TRUE, 1001, 1001, 1001, 1001),
    (1035, 1017, 'PRINT',    'Print RFQ Inquiries & Comparative Sheets', TRUE, 1001, 1001, 1001, 1001),
    (1036, 1017, 'SEND',     'Send RFQ Inquiries to Vendors',           TRUE, 1001, 1001, 1001, 1001),
    (1037, 1017, 'FINALIZE', 'Award & Finalize Comparative Statement',  TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1037) FROM tbl_sec_action), 1037));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1017, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1017, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1017, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER
    (1004, 1017, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PURCHASE_EXEC
    (1005, 1017, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001) -- SALES_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN
    (1001, 1017, 1034, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1017, 1035, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1017, 1036, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1017, 1037, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (can Send & Finalize/Award)
    (1002, 1017, 1034, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1017, 1035, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1017, 1036, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1017, 1037, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER
    (1003, 1017, 1034, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1017, 1035, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1017, 1036, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1017, 1037, FALSE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (can Send & Finalize/Award)
    (1004, 1017, 1034, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1017, 1035, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1017, 1036, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1017, 1037, TRUE, 1001, 1001, 1001, 1001),
    -- SALES_EXEC (view only)
    (1005, 1017, 1034, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1017, 1035, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1017, 1036, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1017, 1037, FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 5.3 - Purchase Order (PO) Management & Release Screen & Actions
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1018, 'PURCHASE_ORDER', 'Purchase Orders', 'PROCUREMENT', '/procurement/purchase-orders', 'Receipt', 18, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1018) FROM tbl_sec_screen), 1018));

INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1038, 1018, 'EXPORT',  'Export Purchase Orders',            TRUE, 1001, 1001, 1001, 1001),
    (1039, 1018, 'PRINT',   'Print Purchase Order Vouchers',     TRUE, 1001, 1001, 1001, 1001),
    (1040, 1018, 'SUBMIT',  'Submit PO for Release / Approval',  TRUE, 1001, 1001, 1001, 1001),
    (1041, 1018, 'RELEASE', 'Release & Authorize Purchase Order',TRUE, 1001, 1001, 1001, 1001),
    (1042, 1018, 'CANCEL',  'Cancel / Close Purchase Order',     TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1042) FROM tbl_sec_action), 1042));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1018, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1018, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1018, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER
    (1004, 1018, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PURCHASE_EXEC
    (1005, 1018, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001) -- SALES_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN
    (1001, 1018, 1038, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1018, 1039, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1018, 1040, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1018, 1041, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1018, 1042, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (can Submit, Release, Cancel)
    (1002, 1018, 1038, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1018, 1039, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1018, 1040, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1018, 1041, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1018, 1042, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (can Submit)
    (1003, 1018, 1038, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1018, 1039, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1018, 1040, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1018, 1041, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1018, 1042, FALSE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (can Submit, Release)
    (1004, 1018, 1038, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1018, 1039, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1018, 1040, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1018, 1041, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1018, 1042, TRUE, 1001, 1001, 1001, 1001),
    -- SALES_EXEC (view only)
    (1005, 1018, 1038, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1018, 1039, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1018, 1040, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1018, 1041, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1018, 1042, FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;


-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 5.4 - Gate Entry & Security Inward Register (GATE_INWARD)
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1019, 'GATE_INWARD', 'Gate Inward & Security Register', 'PROCUREMENT', '/procurement/gate-inward', 'Truck', 19, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1019) FROM tbl_sec_screen), 1019));

-- Screen custom actions for GATE_INWARD
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1043, 1019, 'EXPORT', 'Export Gate Inward Register',  TRUE, 1001, 1001, 1001, 1001),
    (1044, 1019, 'PRINT',  'Print Gate Inward Pass',        TRUE, 1001, 1001, 1001, 1001),
    (1045, 1019, 'UNLOAD', 'Mark Consignment Unloaded',    TRUE, 1001, 1001, 1001, 1001),
    (1046, 1019, 'EXIT',   'Authorize Vehicle Gate Exit',   TRUE, 1001, 1001, 1001, 1001),
    (1047, 1019, 'CANCEL', 'Cancel / Void Gate Entry',      TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1047) FROM tbl_sec_action), 1047));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1019, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1019, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1019, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- STORE_OFFICER (Primary operator)
    (1004, 1019, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001), -- PURCHASE_EXEC
    (1005, 1019, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001) -- SALES_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN
    (1001, 1019, 1043, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1019, 1044, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1019, 1045, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1019, 1046, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1019, 1047, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (All actions)
    (1002, 1019, 1043, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1019, 1044, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1019, 1045, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1019, 1046, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1019, 1047, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (Can print, unload, record exit)
    (1003, 1019, 1043, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1019, 1044, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1019, 1045, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1019, 1046, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1019, 1047, FALSE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (Can view, print, export)
    (1004, 1019, 1043, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1019, 1044, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1019, 1045, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1019, 1046, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1019, 1047, FALSE, 1001, 1001, 1001, 1001),
    -- SALES_EXEC (View only)
    (1005, 1019, 1043, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1019, 1044, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1019, 1045, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1019, 1046, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1019, 1047, FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;


-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 5.5 - Goods Receipt Note & Quarantine Put-Away (PURCHASE_GRN)
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1020, 'PURCHASE_GRN', 'Goods Receipt Note & Quarantine Put-Away', 'PROCUREMENT', '/procurement/grn', 'FileCheck2', 20, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1020) FROM tbl_sec_screen), 1020));

-- Screen custom actions for PURCHASE_GRN
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1048, 1020, 'EXPORT',  'Export Goods Receipt Register',  TRUE, 1001, 1001, 1001, 1001),
    (1049, 1020, 'PRINT',   'Print Goods Receipt Voucher',   TRUE, 1001, 1001, 1001, 1001),
    (1050, 1020, 'SUBMIT',  'Submit GRN for Inspection',     TRUE, 1001, 1001, 1001, 1001),
    (1051, 1020, 'APPROVE', 'Approve Store Goods Receipt',   TRUE, 1001, 1001, 1001, 1001),
    (1052, 1020, 'CANCEL',  'Void / Cancel Goods Receipt',   TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1052) FROM tbl_sec_action), 1052));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1020, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1020, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1020, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- STORE_OFFICER (Primary operator)
    (1004, 1020, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- PURCHASE_EXEC
    (1005, 1020, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001) -- SALES_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN
    (1001, 1020, 1048, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1020, 1049, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1020, 1050, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1020, 1051, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1020, 1052, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (All actions)
    (1002, 1020, 1048, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1020, 1049, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1020, 1050, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1020, 1051, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1020, 1052, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (Can export, print, submit, approve)
    (1003, 1020, 1048, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1020, 1049, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1020, 1050, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1020, 1051, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1020, 1052, FALSE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (View, export, print)
    (1004, 1020, 1048, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1020, 1049, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1020, 1050, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1020, 1051, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1020, 1052, FALSE, 1001, 1001, 1001, 1001),
    -- SALES_EXEC (View only)
    (1005, 1020, 1048, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1020, 1049, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1020, 1050, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1020, 1051, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1020, 1052, FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;


-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 5.6 - Inward Material QC Inspection, Heat/Batch Allocation & Quarantine Clearance (INWARD_QC)
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1021, 'INWARD_QC', 'Inward Material QC Inspection & Quarantine Clearance', 'QUALITY', '/quality/inward-qc', 'ShieldCheck', 21, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1021) FROM tbl_sec_screen), 1021));

-- Screen custom actions for INWARD_QC
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1053, 1021, 'EXPORT',  'Export Inward QC Register',        TRUE, 1001, 1001, 1001, 1001),
    (1054, 1021, 'PRINT',   'Print QC Inspection Certificate',  TRUE, 1001, 1001, 1001, 1001),
    (1055, 1021, 'SUBMIT',  'Submit QC Inspection for Review',  TRUE, 1001, 1001, 1001, 1001),
    (1056, 1021, 'APPROVE', 'Approve & Release Quarantine Stock',TRUE, 1001, 1001, 1001, 1001),
    (1057, 1021, 'REJECT',  'Reject & Segregate Consignment',   TRUE, 1001, 1001, 1001, 1001),
    (1058, 1021, 'CANCEL',  'Void / Cancel QC Inspection',      TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1058) FROM tbl_sec_action), 1058));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1021, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1021, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1021, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER (View only)
    (1004, 1021, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- PURCHASE_EXEC (View only)
    (1005, 1021, FALSE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001) -- SALES_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN
    (1001, 1021, 1053, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1021, 1054, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1021, 1055, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1021, 1056, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1021, 1057, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1021, 1058, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (All actions)
    (1002, 1021, 1053, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1021, 1054, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1021, 1055, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1021, 1056, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1021, 1057, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1021, 1058, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (Export & Print only)
    (1003, 1021, 1053, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1021, 1054, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1021, 1055, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1021, 1056, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1021, 1057, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1021, 1058, FALSE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (Export & Print only)
    (1004, 1021, 1053, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1021, 1054, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1021, 1055, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1021, 1056, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1021, 1057, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1021, 1058, FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;
