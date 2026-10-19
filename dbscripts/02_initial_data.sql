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

-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 5.7 - Warehouse Bin Put-Away & Stock Allocation (BIN_PUTAWAY)
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1022, 'BIN_PUTAWAY', 'Warehouse Bin Put-Away & Stock Allocation', 'INVENTORY', '/inventory/put-away', 'Layers', 22, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1022) FROM tbl_sec_screen), 1022));

-- Screen custom actions for BIN_PUTAWAY
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1059, 1022, 'EXPORT',  'Export Put-Away Register',             TRUE, 1001, 1001, 1001, 1001),
    (1060, 1022, 'PRINT',   'Print Put-Away Task Sheet / Transfer', TRUE, 1001, 1001, 1001, 1001),
    (1061, 1022, 'ASSIGN',  'Assign Put-Away Task to Operator',     TRUE, 1001, 1001, 1001, 1001),
    (1062, 1022, 'CONFIRM', 'Confirm Bin Put-Away & Post Stock',    TRUE, 1001, 1001, 1001, 1001),
    (1063, 1022, 'CANCEL',  'Void / Cancel Put-Away Task',          TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1063) FROM tbl_sec_action), 1063));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1022, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1022, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1022, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- STORE_OFFICER
    (1004, 1022, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- PURCHASE_EXEC (View only)
    (1005, 1022, FALSE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001) -- SALES_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN
    (1001, 1022, 1059, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1022, 1060, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1022, 1061, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1022, 1062, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1022, 1063, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (All actions)
    (1002, 1022, 1059, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1022, 1060, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1022, 1061, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1022, 1062, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1022, 1063, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (All actions)
    (1003, 1022, 1059, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1022, 1060, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1022, 1061, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1022, 1062, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1022, 1063, TRUE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (Export & Print only)
    (1004, 1022, 1059, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1022, 1060, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1022, 1061, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1022, 1062, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1022, 1063, FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 5.8 - Purchase Invoices & 3-Way Matching (PURCHASE_INVOICE)
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1023, 'PURCHASE_INVOICE', 'Purchase Invoices & 3-Way Matching', 'PROCUREMENT', '/procurement/invoices', 'ReceiptText', 23, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1023) FROM tbl_sec_screen), 1023));

-- Screen custom actions for PURCHASE_INVOICE
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1064, 1023, 'EXPORT',  'Export Purchase Invoices Register',    TRUE, 1001, 1001, 1001, 1001),
    (1065, 1023, 'PRINT',   'Print AP Purchase Invoice Voucher',    TRUE, 1001, 1001, 1001, 1001),
    (1066, 1023, 'SUBMIT',  'Submit Invoice for AP Verification',   TRUE, 1001, 1001, 1001, 1001),
    (1067, 1023, 'APPROVE', 'Authorize Invoice for AP Disbursement',TRUE, 1001, 1001, 1001, 1001),
    (1068, 1023, 'CANCEL',  'Void / Cancel Purchase Invoice',       TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1068) FROM tbl_sec_action), 1068));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1023, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1023, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1023, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER (View only)
    (1004, 1023, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PURCHASE_EXEC
    (1005, 1023, FALSE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001) -- SALES_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN
    (1001, 1023, 1064, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1023, 1065, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1023, 1066, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1023, 1067, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1023, 1068, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (All actions)
    (1002, 1023, 1064, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1023, 1065, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1023, 1066, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1023, 1067, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1023, 1068, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (Export & Print only)
    (1003, 1023, 1064, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1023, 1065, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1023, 1066, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1023, 1067, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1023, 1068, FALSE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (All actions)
    (1004, 1023, 1064, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1023, 1065, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1023, 1066, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1023, 1067, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1023, 1068, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 6.1 - Manufacturing Bill of Materials (BOM) Screen & Actions
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1024, 'MFG_BOM', 'Bill of Materials (BOM) & Engineering Assembly', 'MANUFACTURING', '/manufacturing/boms', 'Layers', 24, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1024) FROM tbl_sec_screen), 1024));

INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1069, 1024, 'EXPORT',   'Export BOM Register & Multi-Level Lists',    TRUE, 1001, 1001, 1001, 1001),
    (1070, 1024, 'PRINT',    'Print Engineering Costed BOM Datasheet',     TRUE, 1001, 1001, 1001, 1001),
    (1071, 1024, 'APPROVE',  'Release & Activate Engineering BOM',         TRUE, 1001, 1001, 1001, 1001),
    (1072, 1024, 'CLONE',    'Clone BOM to New Revision / Version',        TRUE, 1001, 1001, 1001, 1001),
    (1073, 1024, 'EXPLODE',  'Explode Indented Multi-Level Tree Hierarchy',TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1073) FROM tbl_sec_action), 1073));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1024, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1024, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1024, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- QA_HEAD
    (1004, 1024, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER
    (1005, 1024, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001) -- PURCHASE_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN
    (1001, 1024, 1069, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1024, 1070, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1024, 1071, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1024, 1072, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1024, 1073, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (All actions)
    (1002, 1024, 1069, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1024, 1070, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1024, 1071, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1024, 1072, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1024, 1073, TRUE, 1001, 1001, 1001, 1001),
    -- QA_HEAD (View, Print, Explode)
    (1003, 1024, 1069, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1024, 1070, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1024, 1071, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1024, 1072, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1024, 1073, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (View, Print, Explode)
    (1004, 1024, 1069, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1024, 1070, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1024, 1071, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1024, 1072, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1024, 1073, TRUE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (View, Print, Clone, Explode)
    (1005, 1024, 1069, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1024, 1070, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1024, 1071, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1024, 1072, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1024, 1073, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 6.2 - Manufacturing Work Centers, Capacity & Shifts
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1025, 'MFG_WORK_CENTER', 'Work Centers, Capacity & Machine Assets', 'MANUFACTURING', '/manufacturing/work-centers', 'Cpu', 25, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1025) FROM tbl_sec_screen), 1025));

INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1074, 1025, 'EXPORT',      'Export Work Centers & Machinery Register',   TRUE, 1001, 1001, 1001, 1001),
    (1075, 1025, 'PRINT',       'Print Work Center Capacity & Equipment Sheet', TRUE, 1001, 1001, 1001, 1001),
    (1076, 1025, 'MAINTENANCE', 'Update Machinery Maintenance / Status Log',   TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1076) FROM tbl_sec_action), 1076));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1025, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1025, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1025, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- QA_HEAD
    (1004, 1025, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER
    (1005, 1025, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001) -- PURCHASE_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN
    (1001, 1025, 1074, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1025, 1075, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1025, 1076, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER
    (1002, 1025, 1074, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1025, 1075, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1025, 1076, TRUE, 1001, 1001, 1001, 1001),
    -- QA_HEAD (View, Print)
    (1003, 1025, 1074, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1025, 1075, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1025, 1076, FALSE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (View, Print, Maintenance)
    (1004, 1025, 1074, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1025, 1075, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1025, 1076, TRUE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (View, Print)
    (1005, 1025, 1074, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1025, 1075, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1025, 1076, FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 6.3 - Production Routings, Operation Sequences & Standard Cycle Times
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1026, 'MFG_ROUTING', 'Production Routings & Operations', 'MANUFACTURING', '/manufacturing/routings', 'Workflow', 26, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1026) FROM tbl_sec_screen), 1026));

INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1077, 1026, 'EXPORT',  'Export Production Routings & Operations Sheet', TRUE, 1001, 1001, 1001, 1001),
    (1078, 1026, 'PRINT',   'Print Routing Traveler & Shopfloor Route Card', TRUE, 1001, 1001, 1001, 1001),
    (1079, 1026, 'APPROVE', 'Approve & Release Routing Version',            TRUE, 1001, 1001, 1001, 1001),
    (1080, 1026, 'CLONE',   'Duplicate / Revise Production Routing',         TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1080) FROM tbl_sec_action), 1080));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1026, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1026, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1026, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- QA_HEAD
    (1004, 1026, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER
    (1005, 1026, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001) -- PURCHASE_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN
    (1001, 1026, 1077, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1026, 1078, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1026, 1079, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1026, 1080, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER
    (1002, 1026, 1077, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1026, 1078, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1026, 1079, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1026, 1080, TRUE, 1001, 1001, 1001, 1001),
    -- QA_HEAD (View, Print)
    (1003, 1026, 1077, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1026, 1078, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1026, 1079, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1026, 1080, FALSE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (View, Print)
    (1004, 1026, 1077, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1026, 1078, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1026, 1079, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1026, 1080, FALSE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (View, Print)
    (1005, 1026, 1077, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1026, 1078, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1026, 1079, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1026, 1080, FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 6.4 - Material Requirements Planning (MRP Engine) & Planned Orders
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1027, 'MFG_MRP', 'Material Requirements Planning (MRP)', 'MANUFACTURING', '/manufacturing/mrp', 'Calculator', 27, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1027) FROM tbl_sec_screen), 1027));

INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1081, 1027, 'RUN_MRP', 'Execute Gross-to-Net MRP Planning Run',                 TRUE, 1001, 1001, 1001, 1001),
    (1082, 1027, 'EXPORT',  'Export Planned Orders Schedule & Deficit Register',     TRUE, 1001, 1001, 1001, 1001),
    (1083, 1027, 'PRINT',   'Print MRP Executive Summary & Procurement Plan',        TRUE, 1001, 1001, 1001, 1001),
    (1084, 1027, 'CONVERT', 'Convert Planned Orders to Purchase Requisitions (PR)',  TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1084) FROM tbl_sec_action), 1084));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1027, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1027, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1027, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- QA_HEAD
    (1004, 1027, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER
    (1005, 1027, TRUE, TRUE, FALSE, FALSE, 1001, 1001, 1001, 1001) -- PURCHASE_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN
    (1001, 1027, 1081, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1027, 1082, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1027, 1083, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1027, 1084, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER
    (1002, 1027, 1081, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1027, 1082, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1027, 1083, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1027, 1084, TRUE, 1001, 1001, 1001, 1001),
    -- QA_HEAD (View, Print, Export)
    (1003, 1027, 1081, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1027, 1082, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1027, 1083, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1027, 1084, FALSE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (Run, View, Print, Export, Convert)
    (1004, 1027, 1081, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1027, 1082, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1027, 1083, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1027, 1084, TRUE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (View, Print, Export, Convert to PR)
    (1005, 1027, 1081, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1027, 1082, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1027, 1083, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1027, 1084, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 6.5 - Production Work Orders (WO), Scheduling & Shopfloor Release
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1028, 'MFG_WORK_ORDER', 'Production Work Orders & Release', 'MANUFACTURING', '/manufacturing/work-orders', 'Factory', 28, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1028) FROM tbl_sec_screen), 1028));

INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1085, 1028, 'EXPORT',  'Export Production Work Orders Register',        TRUE, 1001, 1001, 1001, 1001),
    (1086, 1028, 'PRINT',   'Print Shopfloor Job Card & Route Traveler',     TRUE, 1001, 1001, 1001, 1001),
    (1087, 1028, 'RELEASE', 'Release Work Order to Shopfloor Execution',     TRUE, 1001, 1001, 1001, 1001),
    (1088, 1028, 'CLOSE',   'Complete & Close Production Work Order',        TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1088) FROM tbl_sec_action), 1088));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1028, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1028, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1028, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- QA_HEAD
    (1004, 1028, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER
    (1005, 1028, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001) -- PURCHASE_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN
    (1001, 1028, 1085, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1028, 1086, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1028, 1087, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1028, 1088, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER
    (1002, 1028, 1085, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1028, 1086, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1028, 1087, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1028, 1088, TRUE, 1001, 1001, 1001, 1001),
    -- QA_HEAD (View, Print, Export)
    (1003, 1028, 1085, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1028, 1086, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1028, 1087, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1028, 1088, FALSE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (View, Print, Export)
    (1004, 1028, 1085, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1028, 1086, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1028, 1087, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1028, 1088, FALSE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (View, Print, Export)
    (1005, 1028, 1085, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1028, 1086, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1028, 1087, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1028, 1088, FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;


-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 6.6 - Shopfloor Material Issue, Lineside Staging & Backflushing
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1029, 'MFG_MATERIAL_ISSUE', 'Shopfloor Material Issue & Backflush', 'MANUFACTURING', '/manufacturing/material-issues', 'Boxes', 29, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1029) FROM tbl_sec_screen), 1029));

INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1089, 1029, 'EXPORT', 'Export Material Issues Register',         TRUE, 1001, 1001, 1001, 1001),
    (1090, 1029, 'PRINT',  'Print Material Issue Slip Voucher',       TRUE, 1001, 1001, 1001, 1001),
    (1091, 1029, 'SUBMIT', 'Submit & Post Material Issue to Stores',  TRUE, 1001, 1001, 1001, 1001),
    (1092, 1029, 'RETURN', 'Return Unconsumed Material to Stores',    TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1092) FROM tbl_sec_action), 1092));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1029, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1029, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1029, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- QA_HEAD
    (1004, 1029, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- STORE_OFFICER
    (1005, 1029, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001) -- PURCHASE_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN
    (1001, 1029, 1089, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1029, 1090, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1029, 1091, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1029, 1092, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER
    (1002, 1029, 1089, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1029, 1090, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1029, 1091, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1029, 1092, TRUE, 1001, 1001, 1001, 1001),
    -- QA_HEAD (View, Print, Export)
    (1003, 1029, 1089, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1029, 1090, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1029, 1091, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1029, 1092, FALSE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (View, Add, Edit, Print, Export, Submit, Return)
    (1004, 1029, 1089, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1029, 1090, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1029, 1091, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1029, 1092, TRUE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (View, Print, Export)
    (1005, 1029, 1089, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1029, 1090, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1029, 1091, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1029, 1092, FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;



-- ============================================================================
-- DATE: 2026-10-19
-- FEATURE: Step 6.7 - Production Job Cards & Operation Execution (MFG_JOB_CARD)
-- ============================================================================

INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name,
    route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1030,
    'MFG_JOB_CARD',
    'Production Job Cards & Operation Execution',
    'MANUFACTURING',
    '/manufacturing/job-cards',
    'CheckSquare',
    30,
    TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1030) FROM tbl_sec_screen), 1030));

-- Action Definitions
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name,
    is_active, comp_id, branch_id, fyear_id, created_by
) VALUES
    (1093, 1030, 'EXPORT',   'Export Job Cards Register',            TRUE, 1001, 1001, 1001, 1001),
    (1094, 1030, 'PRINT',    'Print Shopfloor Job Card Traveler',    TRUE, 1001, 1001, 1001, 1001),
    (1095, 1030, 'START',    'Start Job Card & Track Time',          TRUE, 1001, 1001, 1001, 1001),
    (1096, 1030, 'COMPLETE', 'Log Output & Complete Operation',      TRUE, 1001, 1001, 1001, 1001),
    (1097, 1030, 'APPROVE',  'In-Process QC Inspection Clearance',   TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1097) FROM tbl_sec_action), 1097));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1030, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1030, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1030, TRUE, FALSE, TRUE, FALSE, 1001, 1001, 1001, 1001), -- QA_HEAD (view, edit for QC)
    (1004, 1030, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER (view, start, complete)
    (1005, 1030, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001) -- PURCHASE_EXEC (view only)
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN (All Allowed)
    (1001, 1030, 1093, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1030, 1094, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1030, 1095, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1030, 1096, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1030, 1097, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (All Allowed)
    (1002, 1030, 1093, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1030, 1094, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1030, 1095, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1030, 1096, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1030, 1097, TRUE, 1001, 1001, 1001, 1001),
    -- QA_HEAD (View, Print, Export, In-Process QC Approve)
    (1003, 1030, 1093, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1030, 1094, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1030, 1095, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1030, 1096, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1030, 1097, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (View, Print, Export, Start, Complete)
    (1004, 1030, 1093, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1030, 1094, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1030, 1095, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1030, 1096, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1030, 1097, FALSE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (View, Print, Export)
    (1005, 1030, 1093, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1030, 1094, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1030, 1095, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1030, 1096, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1030, 1097, FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- ============================================================================
-- DATE: 2026-10-19
-- FEATURE: Step 6.8 - Subcontractor Job-Work & Material Reconciliation Screen & Action Seeds
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1031, 'MFG_JOB_WORK', 'Subcontractor Job-Work & Reconciliation', 'MANUFACTURING', '/manufacturing/job-work', 'Truck', 31, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1031) FROM tbl_sec_screen), 1031));

-- Screen custom actions
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1098, 1031, 'EXPORT',   'Export Job-Work Register',                      TRUE, 1001, 1001, 1001, 1001),
    (1099, 1031, 'PRINT',    'Print GST Section 143 Job-Work Challan/Receipt', TRUE, 1001, 1001, 1001, 1001),
    (1100, 1031, 'DISPATCH', 'Dispatch Job-Work Outward Challan',              TRUE, 1001, 1001, 1001, 1001),
    (1101, 1031, 'RECEIVE',  'Receive Subcontracted Goods & QC Inward',        TRUE, 1001, 1001, 1001, 1001),
    (1102, 1031, 'RECONCILE','Reconcile Sent vs Received & Close Challan',     TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1102) FROM tbl_sec_action), 1102));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1031, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1031, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1031, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER (stores handles inward/outward)
    (1004, 1031, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001), -- PURCHASE_EXEC (procurement manages subcontractor POs & challans)
    (1005, 1031, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001) -- SALES_EXEC (view only)
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN (All Allowed)
    (1001, 1031, 1098, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1031, 1099, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1031, 1100, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1031, 1101, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1031, 1102, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (All Allowed)
    (1002, 1031, 1098, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1031, 1099, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1031, 1100, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1031, 1101, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1031, 1102, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (View, Print, Export, Dispatch, Receive, Reconcile)
    (1003, 1031, 1098, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1031, 1099, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1031, 1100, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1031, 1101, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1031, 1102, TRUE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (View, Print, Export, Dispatch)
    (1004, 1031, 1098, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1031, 1099, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1031, 1100, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1031, 1101, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1031, 1102, FALSE, 1001, 1001, 1001, 1001),
    -- SALES_EXEC (View, Print, Export)
    (1005, 1031, 1098, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1031, 1099, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1031, 1100, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1031, 1101, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1031, 1102, FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;


-- ============================================================================
-- DATE: 2026-10-19
-- FEATURE: Step 6.9 - Finished Goods (FG) Production Receipt, Scrap/By-Product
--          Accounting & Absorption Cost Rollup (Screen 1032, Actions 1103-1105)
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1032, 'MFG_FG_RECEIPT', 'Finished Goods Receipt & Absorption Costing', 'MANUFACTURING', '/manufacturing/fg-receipts', 'PackageCheck', 32, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1032) FROM tbl_sec_screen), 1032));

-- Screen-specific Actions
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1103, 1032, 'EXPORT', 'Export FG Production Receipts Register',           TRUE, 1001, 1001, 1001, 1001),
    (1104, 1032, 'PRINT',  'Print FG Production Inward Slip / Transfer Voucher',TRUE, 1001, 1001, 1001, 1001),
    (1105, 1032, 'POST',   'Post FG Receipt, Stock Ledger & Update WO',         TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1105) FROM tbl_sec_action), 1105));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1032, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1032, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1032, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER
    (1004, 1032, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- PURCHASE_EXEC
    (1005, 1032, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001)  -- SALES_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN (All Allowed)
    (1001, 1032, 1103, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1032, 1104, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1032, 1105, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (All Allowed)
    (1002, 1032, 1103, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1032, 1104, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1032, 1105, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (View, Print, Export, Post)
    (1003, 1032, 1103, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1032, 1104, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1032, 1105, TRUE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (View, Print, Export)
    (1004, 1032, 1103, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1032, 1104, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1032, 1105, FALSE, 1001, 1001, 1001, 1001),
    -- SALES_EXEC (View, Print, Export)
    (1005, 1032, 1103, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1032, 1104, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1032, 1105, FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;


-- ============================================================================
-- DATE: 2026-10-19
-- FEATURE: Step 7.1 - Customer Inquiry & Quotation / Proforma Invoice
--          (Screen 1033, Actions 1106-1109)
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1033, 'SALES_QUOTATION', 'Customer Inquiry & Quotation / Proforma Invoice', 'SALES', '/sales/quotations', 'FileText', 33, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1033) FROM tbl_sec_screen), 1033));

-- Screen-specific Actions
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1106, 1033, 'EXPORT',        'Export Sales Quotations Register',               TRUE, 1001, 1001, 1001, 1001),
    (1107, 1033, 'PRINT',         'Print Commercial Quotation / Proforma Invoice',   TRUE, 1001, 1001, 1001, 1001),
    (1108, 1033, 'SEND',          'Send Commercial Quotation to Customer',          TRUE, 1001, 1001, 1001, 1001),
    (1109, 1033, 'CONVERT_TO_SO', 'Convert Accepted Quotation to Sales Order',       TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1109) FROM tbl_sec_action), 1109));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1033, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1033, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1033, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER
    (1004, 1033, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- PURCHASE_EXEC
    (1005, 1033, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001)  -- SALES_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN (All Allowed)
    (1001, 1033, 1106, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1033, 1107, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1033, 1108, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1033, 1109, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (All Allowed)
    (1002, 1033, 1106, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1033, 1107, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1033, 1108, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1033, 1109, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (View, Print, Export)
    (1003, 1033, 1106, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1033, 1107, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1033, 1108, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1033, 1109, FALSE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (View, Print, Export)
    (1004, 1033, 1106, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1033, 1107, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1033, 1108, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1033, 1109, FALSE, 1001, 1001, 1001, 1001),
    -- SALES_EXEC (View, Print, Export, Send, Convert)
    (1005, 1033, 1106, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1033, 1107, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1033, 1108, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1033, 1109, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;


-- ============================================================================
-- DATE: 2026-10-19
-- FEATURE: Step 7.2 - Sales Order (SO), Commercial Credit Check & Available-to-Promise (ATP)
--          Stock Reservation (Screen 1034, Actions 1110-1114)
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1034, 'SALES_ORDER', 'Sales Orders, Credit Check & ATP Reservation', 'SALES', '/sales/orders', 'ShoppingCart', 34, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1034) FROM tbl_sec_screen), 1034));

-- Screen-specific Actions
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1110, 1034, 'EXPORT',    'Export Sales Orders Register',                         TRUE, 1001, 1001, 1001, 1001),
    (1111, 1034, 'PRINT',     'Print Official Sales Order Acknowledgement / Contract', TRUE, 1001, 1001, 1001, 1001),
    (1112, 1034, 'CONFIRM',   'Confirm Sales Order & Reserve ATP Stock',              TRUE, 1001, 1001, 1001, 1001),
    (1113, 1034, 'CREATE_WO', 'Generate Production Work Order for Unfulfilled Units', TRUE, 1001, 1001, 1001, 1001),
    (1114, 1034, 'HOLD',      'Put Sales Order On Hold / Release Hold',                TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1114) FROM tbl_sec_action), 1114));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1034, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1034, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1034, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER (View dispatch orders)
    (1004, 1034, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- PURCHASE_EXEC
    (1005, 1034, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001)  -- SALES_EXEC
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN (All Allowed)
    (1001, 1034, 1110, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1034, 1111, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1034, 1112, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1034, 1113, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1034, 1114, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (All Allowed)
    (1002, 1034, 1110, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1034, 1111, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1034, 1112, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1034, 1113, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1034, 1114, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (View, Print, Export)
    (1003, 1034, 1110, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1034, 1111, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1034, 1112, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1034, 1113, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1034, 1114, FALSE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (View, Print, Export)
    (1004, 1034, 1110, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1034, 1111, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1034, 1112, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1034, 1113, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1034, 1114, FALSE, 1001, 1001, 1001, 1001),
    -- SALES_EXEC (View, Print, Export, Confirm, Create WO, Hold)
    (1005, 1034, 1110, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1034, 1111, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1034, 1112, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1034, 1113, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1034, 1114, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;




-- ============================================================================
-- Phase 7: Step 7.3 — Outward Warehouse Pick/Pack Slip & Dispatch Delivery Challan (Screen 1035, Actions 1115-1119)
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1035, 'DELIVERY_CHALLAN', 'Outward Delivery Challan & Dispatch', 'SALES', '/sales/delivery-challans', 'Truck', 35, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1035) FROM tbl_sec_screen), 1035));

-- Screen-specific Actions
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1115, 1035, 'EXPORT',   'Export Delivery Challans Register',                  TRUE, 1001, 1001, 1001, 1001),
    (1116, 1035, 'PRINT',    'Print Statutory Delivery Challan & Packing Slip',     TRUE, 1001, 1001, 1001, 1001),
    (1117, 1035, 'PICK',     'Generate / Confirm Warehouse Pick Slip',              TRUE, 1001, 1001, 1001, 1001),
    (1118, 1035, 'PACK',     'Confirm Packing List & Package Verification',         TRUE, 1001, 1001, 1001, 1001),
    (1119, 1035, 'DISPATCH', 'Physical Gate Outward Dispatch & Stock Deduction',    TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1119) FROM tbl_sec_action), 1119));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1035, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1035, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1035, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER (Store manages outward dispatch)
    (1004, 1035, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- PURCHASE_EXEC (View only)
    (1005, 1035, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001)  -- SALES_EXEC (Sales coordinate delivery challans)
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN (All Allowed)
    (1001, 1035, 1115, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1035, 1116, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1035, 1117, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1035, 1118, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1035, 1119, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (All Allowed)
    (1002, 1035, 1115, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1035, 1116, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1035, 1117, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1035, 1118, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1035, 1119, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (All Allowed - Store Officer executes pick, pack, dispatch, print, export)
    (1003, 1035, 1115, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1035, 1116, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1035, 1117, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1035, 1118, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1035, 1119, TRUE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (View, Print, Export)
    (1004, 1035, 1115, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1035, 1116, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1035, 1117, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1035, 1118, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1035, 1119, FALSE, 1001, 1001, 1001, 1001),
    -- SALES_EXEC (View, Print, Export, Pick, Pack, Dispatch)
    (1005, 1035, 1115, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1035, 1116, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1035, 1117, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1035, 1118, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1035, 1119, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;


-- ============================================================================
-- Phase 7: Step 7.4 — Sales Tax Invoices & Customer Accounts Receivable (Screen 1036, Actions 1120-1124)
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1036, 'SALES_INVOICE', 'Sales Tax Invoices & Receivables', 'SALES', '/sales/invoices', 'Receipt', 36, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1036) FROM tbl_sec_screen), 1036));

-- Screen-specific Actions
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1120, 1036, 'EXPORT',         'Export Sales Invoices Register',                      TRUE, 1001, 1001, 1001, 1001),
    (1121, 1036, 'PRINT',          'Print Statutory GST Tax Invoice (Rule 46)',           TRUE, 1001, 1001, 1001, 1001),
    (1122, 1036, 'POST',           'Post & Finalize Invoice / Post AR Ledger',            TRUE, 1001, 1001, 1001, 1001),
    (1123, 1036, 'GENERATE_IRN',   'Generate Statutory E-Invoice IRN & Signed QR Code',   TRUE, 1001, 1001, 1001, 1001),
    (1124, 1036, 'RECORD_PAYMENT', 'Record Customer Payment Receipt / AR Clearance',      TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1124) FROM tbl_sec_action), 1124));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1036, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1036, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1036, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER (Store view only)
    (1004, 1036, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- PURCHASE_EXEC (Purchase view only)
    (1005, 1036, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001)  -- SALES_EXEC (Sales manage invoices)
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN (All Allowed)
    (1001, 1036, 1120, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1036, 1121, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1036, 1122, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1036, 1123, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1036, 1124, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (All Allowed)
    (1002, 1036, 1120, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1036, 1121, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1036, 1122, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1036, 1123, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1036, 1124, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (View, Print, Export)
    (1003, 1036, 1120, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1036, 1121, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1036, 1122, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1036, 1123, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1036, 1124, FALSE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (View, Print, Export)
    (1004, 1036, 1120, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1036, 1121, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1036, 1122, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1036, 1123, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1036, 1124, FALSE, 1001, 1001, 1001, 1001),
    -- SALES_EXEC (All Allowed)
    (1005, 1036, 1120, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1036, 1121, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1036, 1122, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1036, 1123, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1036, 1124, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;

-- ============================================================================
-- Phase 7: Step 7.5 — Sales Return, Inward RMA & Credit Note (Screen 1037, Actions 1125-1129)
-- ============================================================================
INSERT INTO tbl_sec_screen (
    screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES (
    1037, 'SALES_RETURN', 'Sales Returns, RMA & Credit Notes', 'SALES', '/sales/returns', 'RotateCcw', 37, TRUE,
    1001, 1001, 1001, 1001
) ON CONFLICT (screen_id) DO NOTHING;

SELECT setval('seq_screen_id', GREATEST((SELECT COALESCE(MAX(screen_id), 1037) FROM tbl_sec_screen), 1037));

-- Screen-specific Actions
INSERT INTO tbl_sec_action (
    action_id, screen_id, action_code, action_name, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1125, 1037, 'EXPORT',           'Export Sales Return & RMA Register',                  TRUE, 1001, 1001, 1001, 1001),
    (1126, 1037, 'PRINT',            'Print Statutory GST Credit Note (Sec 34 / Rule 53)',  TRUE, 1001, 1001, 1001, 1001),
    (1127, 1037, 'INSPECT',          'Inspect Inward RMA Quarantine Goods',                 TRUE, 1001, 1001, 1001, 1001),
    (1128, 1037, 'POST_CREDIT_NOTE', 'Post Credit Note / Reconcile Customer AR Ledger',    TRUE, 1001, 1001, 1001, 1001),
    (1129, 1037, 'RESTOCK',          'Restock Accepted Goods to Warehouse Bins',            TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (screen_id, action_code) DO NOTHING;

SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1129) FROM tbl_sec_action), 1129));

-- Grant screen permissions
INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1037, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- SUPER_ADMIN
    (1002, 1037, TRUE, TRUE, TRUE, TRUE, 1001, 1001, 1001, 1001), -- PLANT_MANAGER
    (1003, 1037, TRUE, FALSE, TRUE, FALSE, 1001, 1001, 1001, 1001), -- STORE_OFFICER (Inspect & Restock)
    (1004, 1037, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001), -- PURCHASE_EXEC (View only)
    (1005, 1037, TRUE, TRUE, TRUE, FALSE, 1001, 1001, 1001, 1001)  -- SALES_EXEC (Sales manage returns & credit notes)
ON CONFLICT (role_id, screen_id) DO NOTHING;

-- Grant action permissions
INSERT INTO tbl_sec_role_action_permission (
    role_id, screen_id, action_id, is_allowed,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- SUPER_ADMIN (All Allowed)
    (1001, 1037, 1125, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1037, 1126, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1037, 1127, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1037, 1128, TRUE, 1001, 1001, 1001, 1001),
    (1001, 1037, 1129, TRUE, 1001, 1001, 1001, 1001),
    -- PLANT_MANAGER (All Allowed)
    (1002, 1037, 1125, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1037, 1126, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1037, 1127, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1037, 1128, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1037, 1129, TRUE, 1001, 1001, 1001, 1001),
    -- STORE_OFFICER (View, Print, Export, Inspect, Restock)
    (1003, 1037, 1125, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1037, 1126, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1037, 1127, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1037, 1128, FALSE, 1001, 1001, 1001, 1001),
    (1003, 1037, 1129, TRUE, 1001, 1001, 1001, 1001),
    -- PURCHASE_EXEC (View, Print, Export)
    (1004, 1037, 1125, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1037, 1126, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1037, 1127, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1037, 1128, FALSE, 1001, 1001, 1001, 1001),
    (1004, 1037, 1129, FALSE, 1001, 1001, 1001, 1001),
    -- SALES_EXEC (View, Print, Export, Post Credit Note)
    (1005, 1037, 1125, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1037, 1126, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1037, 1127, FALSE, 1001, 1001, 1001, 1001),
    (1005, 1037, 1128, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1037, 1129, FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, action_id) DO NOTHING;


