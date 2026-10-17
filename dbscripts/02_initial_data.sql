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

