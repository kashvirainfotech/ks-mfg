-- ============================================================================
-- KS-MFG ERP: Screen/Feature-Wise Sample & Demo Data
-- Description: Single SQL file containing sample and demo data for testing
--              and demonstrating each screen and feature.
-- Rule:
--   1. For each screen/feature implemented, update this file by appending
--      realistic sample demo records at the END of this file.
--   2. Precede each section with proper date and feature information comments.
-- ============================================================================

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 0.1 - Core Foundation Demo Data (Multi-Company, Multi-Branch,
--          Multi-Financial Year & Role Mappings for Context Switcher Demo)
-- ============================================================================

-- 1. Demo Secondary Company (comp_id = 1002)
INSERT INTO tbl_org_company (
    comp_id, comp_code, comp_name, legal_name, gstin, pan_no, cin_no,
    base_currency_code, registered_address, city, state_name, state_code,
    pincode, country, phone, email, website, is_active,
    branch_id, fyear_id, created_by
) VALUES (
    1002, 'KSAUTO', 'Kashvira Auto Components', 'Kashvira Auto Components Pvt. Ltd.',
    '27AABCK9999K1Z2', 'AABCK9999K', 'U34300MH2022PTC223344',
    'INR', 'Plot B-19, Chakan MIDC Phase II', 'Pune', 'Maharashtra', '27',
    '410501', 'India', '+91-20-67891234', 'auto@ksmfg.com', 'https://auto.ksmfg.com', TRUE,
    1001, 1001, 1001
) ON CONFLICT (comp_id) DO NOTHING;

SELECT setval('seq_comp_id', GREATEST((SELECT COALESCE(MAX(comp_id), 1002) FROM tbl_org_company), 1002));

-- 2. Demo Additional Branches (branch_id = 1002 under KSMFG, branch_id = 1003 under KSAUTO)
INSERT INTO tbl_org_branch (
    branch_id, branch_code, branch_name, branch_type, gstin,
    address, city, state_name, state_code, pincode, country,
    phone, email, is_head_office, is_active,
    comp_id, fyear_id, created_by
) VALUES
    (1002, 'PLT-RAJ-02', 'Rajkot CNC & Foundry Unit', 'PLANT', '24AABCK1234F1Z5',
     'Survey 88, Metoda GIDC, Kalawad Road', 'Rajkot', 'Gujarat', '24', '360021', 'India',
     '+91-281-2876543', 'rajkot.plant@ksmfg.com', FALSE, TRUE,
     1001, 1001, 1001),
    (1003, 'PLT-PNQ-01', 'Pune Chakan Assembly Plant', 'PLANT', '27AABCK9999K1Z2',
     'Plot B-19, Chakan MIDC Phase II', 'Pune', 'Maharashtra', '27', '410501', 'India',
     '+91-20-67891234', 'pune.plant@ksmfg.com', TRUE, TRUE,
     1002, 1001, 1001)
ON CONFLICT (branch_id) DO NOTHING;

SELECT setval('seq_branch_id', GREATEST((SELECT COALESCE(MAX(branch_id), 1003) FROM tbl_org_branch), 1003));

-- 3. Demo Additional Financial Years (fyear_id = 1002 for FY 2025-26 under KSMFG, fyear_id = 1003 for FY 2026-27 under KSAUTO)
INSERT INTO tbl_org_financial_year (
    fyear_id, fyear_code, fyear_name, start_date, end_date,
    is_current, is_closed, is_active,
    comp_id, branch_id, created_by
) VALUES
    (1002, '2025-26', 'FY 2025-2026', '2025-04-01', '2026-03-31', FALSE, FALSE, TRUE, 1001, 1001, 1001),
    (1003, '2026-27', 'FY 2026-2027', '2026-04-01', '2027-03-31', TRUE,  FALSE, TRUE, 1002, 1003, 1001)
ON CONFLICT (fyear_id) DO NOTHING;

SELECT setval('seq_fyear_id', GREATEST((SELECT COALESCE(MAX(fyear_id), 1003) FROM tbl_org_financial_year), 1003));

-- 4. Demo Branch-Financial Year Activation Mappings
INSERT INTO tbl_org_branch_fyear (
    branch_fyear_id, is_locked, books_begin_from, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1002, FALSE, '2026-04-01', TRUE, 1001, 1002, 1001, 1001),
    (1003, TRUE,  '2025-04-01', TRUE, 1001, 1001, 1002, 1001),
    (1004, FALSE, '2026-04-01', TRUE, 1002, 1003, 1003, 1001)
ON CONFLICT (branch_fyear_id) DO NOTHING;

SELECT setval('seq_branch_fyear_id', GREATEST((SELECT COALESCE(MAX(branch_fyear_id), 1004) FROM tbl_org_branch_fyear), 1004));

-- 5. Demo Super Admin Access Mappings for Demo Company & Branches
INSERT INTO tbl_sec_user_company_role (
    user_company_role_id, user_id, mapped_comp_id, role_id, is_default, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1002, 1001, 1002, 1001, FALSE, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (user_id, mapped_comp_id, role_id) DO NOTHING;

SELECT setval('seq_user_company_role_id', GREATEST((SELECT COALESCE(MAX(user_company_role_id), 1002) FROM tbl_sec_user_company_role), 1002));

INSERT INTO tbl_sec_user_branch_role (
    user_branch_role_id, user_id, mapped_comp_id, mapped_branch_id, role_id, is_default, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1002, 1001, 1001, 1002, 1001, FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1001, 1002, 1003, 1001, FALSE, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (user_id, mapped_branch_id, role_id) DO NOTHING;

SELECT setval('seq_user_branch_role_id', GREATEST((SELECT COALESCE(MAX(user_branch_role_id), 1003) FROM tbl_sec_user_branch_role), 1003));


-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 1.1 - Company Master Sample Demo Data
-- ============================================================================
INSERT INTO tbl_org_company (
    comp_id, comp_code, comp_name, legal_name, gstin, pan_no, cin_no,
    iec_code, msme_reg_no, base_currency_code, registered_address,
    city, state_name, state_code, pincode, country,
    phone, email, website, is_active,
    branch_id, fyear_id, created_by
) VALUES
    (1003, 'KSVALVE', 'Kashvira Industrial Valves', 'Kashvira Industrial Valves & Process Controls Ltd.',
     '24AABCK7788V1Z9', 'AABCK7788V', 'U29120GJ2021PLC334455',
     '0821009988', 'UDYAM-GJ-01-0099887', 'INR', 'Plot 118, Phase IV, Vatva GIDC',
     'Ahmedabad', 'Gujarat', '24', '382445', 'India',
     '+91-79-25894400', 'valves@ksmfg.com', 'https://valves.ksmfg.com', TRUE,
     1001, 1001, 1001),
    (1004, 'KSCAST', 'Kashvira Alloy Castings (Subsidiary)', 'Kashvira Precision Alloy Castings Pvt. Ltd.',
     '24AABCK5544C1Z3', 'AABCK5544C', 'U27100GJ2023PTC445566',
     '0823005544', 'UDYAM-GJ-20-0055443', 'INR', 'Survey 212, Shapar-Veraval Industrial Area',
     'Rajkot', 'Gujarat', '24', '360024', 'India',
     '+91-2827-252100', 'castings@ksmfg.com', 'https://castings.ksmfg.com', TRUE,
     1001, 1001, 1001)
ON CONFLICT (comp_id) DO NOTHING;

SELECT setval('seq_comp_id', GREATEST((SELECT COALESCE(MAX(comp_id), 1004) FROM tbl_org_company), 1004));


-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 1.2 - Branch & Plant Master Sample Demo Data
-- ============================================================================
INSERT INTO tbl_org_branch (
    branch_id, branch_code, branch_name, branch_type, gstin,
    address, city, state_name, state_code, pincode, country,
    phone, email, is_head_office, is_active,
    comp_id, fyear_id, created_by
) VALUES
    (1004, 'WH-SRT-03', 'Surat Regional Distribution Hub', 'WAREHOUSE', '24AABCK1234F1Z5',
     'Block C-14, Hazira Industrial Logistics Park', 'Surat', 'Gujarat', '24', '394270', 'India',
     '+91-261-2864500', 'surat.wh@ksmfg.com', FALSE, TRUE,
     1001, 1001, 1001),
    (1005, 'PLT-VTV-01', 'Vatva High-Pressure Valve Unit', 'PLANT', '24AABCK7788V1Z9',
     'Plot 118, Phase IV, Vatva GIDC', 'Ahmedabad', 'Gujarat', '24', '382445', 'India',
     '+91-79-25894400', 'vatva.plant@ksmfg.com', TRUE, TRUE,
     1003, 1001, 1001),
    (1006, 'SO-MUM-01', 'Mumbai Western Region Sales Office', 'SALES_OFFICE', '27AABCK1234F2Z4',
     'Unit 604, Marathon Futurex, Lower Parel', 'Mumbai', 'Maharashtra', '27', '400013', 'India',
     '+91-22-49876500', 'mumbai.sales@ksmfg.com', FALSE, TRUE,
     1001, 1001, 1001)
ON CONFLICT (branch_id) DO NOTHING;

SELECT setval('seq_branch_id', GREATEST((SELECT COALESCE(MAX(branch_id), 1006) FROM tbl_org_branch), 1006));


-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 1.3 - Financial Year Master & Branch-FY Activation/Locking Demo Data
-- ============================================================================
INSERT INTO tbl_org_financial_year (
    fyear_id, fyear_code, fyear_name, start_date, end_date,
    is_current, is_closed, is_active,
    comp_id, branch_id, created_by
) VALUES
    (1004, '2024-25', 'FY 2024-2025 (Audited & Closed)', '2024-04-01', '2025-03-31', FALSE, TRUE,  TRUE, 1001, 1001, 1001),
    (1005, '2026-27', 'FY 2026-2027',                     '2026-04-01', '2027-03-31', TRUE,  FALSE, TRUE, 1003, 1005, 1001)
ON CONFLICT (fyear_id) DO NOTHING;

SELECT setval('seq_fyear_id', GREATEST((SELECT COALESCE(MAX(fyear_id), 1005) FROM tbl_org_financial_year), 1005));

INSERT INTO tbl_org_branch_fyear (
    branch_fyear_id, is_locked, books_begin_from, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1005, FALSE, '2026-04-01', TRUE, 1001, 1004, 1001, 1001),
    (1006, FALSE, '2026-04-01', TRUE, 1001, 1006, 1001, 1001),
    (1007, TRUE,  '2025-04-01', TRUE, 1001, 1002, 1002, 1001),
    (1008, TRUE,  '2024-04-01', TRUE, 1001, 1001, 1004, 1001),
    (1009, FALSE, '2026-04-01', TRUE, 1003, 1005, 1005, 1001)
ON CONFLICT (comp_id, branch_id, fyear_id) DO NOTHING;

SELECT setval('seq_branch_fyear_id', GREATEST((SELECT COALESCE(MAX(branch_fyear_id), 1009) FROM tbl_org_branch_fyear), 1009));




-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.1 - Department & Designation Master Sample Demo Data
-- ============================================================================
INSERT INTO tbl_hr_department (
    dept_id, dept_code, dept_name, dept_category, parent_dept_id,
    cost_center_code, description, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'PROD-CNC',  'CNC Machining & Assembly Shopfloor', 'PRODUCTION',   NULL, 'CC-PROD-101', 'Precision CNC turning, VMC milling, and valve assembly lines', TRUE, 1001, 1001, 1001, 1001),
    (1002, 'QC-LAB',    'Quality Assurance & Metallurgy Lab', 'QUALITY',      NULL, 'CC-QA-102',   'Inward material inspection, in-process patrol QC, and hydro-testing', TRUE, 1001, 1001, 1001, 1001),
    (1003, 'SCM-WH',    'Central Stores & Bin Warehouse',     'SUPPLY_CHAIN', NULL, 'CC-WH-103',   'Raw material receiving (GRN), multi-level bin put-away, and kitting', TRUE, 1001, 1001, 1001, 1001),
    (1004, 'PROC-PUR',  'Strategic Sourcing & Subcontracting','SUPPLY_CHAIN', 1003, 'CC-PUR-104',  'Vendor PO management, 3rd-party job-work challans, and rate contracts', TRUE, 1001, 1001, 1001, 1001),
    (1005, 'MAINT-ENG', 'Plant Maintenance & Tool Room',      'MAINTENANCE',  1001, 'CC-MNT-105',  'Preventive machine maintenance, jigs/fixtures, and calibration', TRUE, 1001, 1001, 1001, 1001),
    (1006, 'FIN-HR',    'Finance, Costing & Human Resources', 'FINANCE_HR',   NULL, 'CC-FIN-106',  'Plant accounting, GST compliance, payroll, and statutory audits', TRUE, 1001, 1001, 1001, 1001),
    (1007, 'AUTO-ASSY', 'Pune Powertrain Assembly Line',      'PRODUCTION',   NULL, 'CC-PNQ-201',  'Automotive OEM component assembly and dispatch line', TRUE, 1002, 1003, 1003, 1001)
ON CONFLICT (dept_id) DO NOTHING;

SELECT setval('seq_dept_id', GREATEST((SELECT COALESCE(MAX(dept_id), 1007) FROM tbl_hr_department), 1007));

INSERT INTO tbl_hr_designation (
    desig_id, desig_code, desig_name, dept_id, grade_code, hierarchy_level,
    description, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'VP-OPS',     'VP — Manufacturing Operations',   1001, 'E1', 1, 'Executive head of plant operations and multi-branch production', TRUE, 1001, 1001, 1001, 1001),
    (1002, 'PLANT-MGR',  'Plant Operations Manager',        1001, 'M1', 2, 'Heads shopfloor production planning, work orders, and OEE targets', TRUE, 1001, 1001, 1001, 1001),
    (1003, 'QA-HEAD',    'Quality Assurance Manager',       1002, 'M2', 3, 'Approves incoming QC clearances, quarantine disposition, and test certificates', TRUE, 1001, 1001, 1001, 1001),
    (1004, 'STORE-MGR',  'Warehouse & Stores In-Charge',    1003, 'M2', 3, 'Manages multi-level bin topology, GRN put-away, and stock audits', TRUE, 1001, 1001, 1001, 1001),
    (1005, 'PUR-EXEC',   'Senior Procurement Engineer',     1004, 'L3', 4, 'Executes vendor RFQs, Purchase Orders, and Job-Work challans', TRUE, 1001, 1001, 1001, 1001),
    (1006, 'QC-INSP',    'Senior Quality Inspector',        1002, 'L4', 5, 'Performs batch/serial dimensional inspection and hydro-test logging', TRUE, 1001, 1001, 1001, 1001),
    (1007, 'CNC-SUP',    'Shopfloor Shift Supervisor',      1001, 'L4', 5, 'Supervises shift-wise machine loading, BOM material issue, and PRN output', TRUE, 1001, 1001, 1001, 1001),
    (1008, 'CNC-OPR',    'CNC Machine Setter & Operator',   1001, 'L5', 6, 'Operates 5-axis CNC turning/milling centers and logs batch output', TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (desig_id) DO NOTHING;

SELECT setval('seq_desig_id', GREATEST((SELECT COALESCE(MAX(desig_id), 1008) FROM tbl_hr_designation), 1008));

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.2 - Employee Master Sample Demo Data
-- ============================================================================
INSERT INTO tbl_hr_employee (
    employee_id, emp_code, first_name, last_name, full_name, gender,
    date_of_birth, date_of_joining, dept_id, desig_id, primary_branch_id,
    reporting_manager_id, employment_type, employment_status,
    official_email, mobile_no, emergency_contact_name, emergency_contact_phone,
    pan_no, aadhaar_no, pf_uan_no, esi_no,
    bank_name, bank_account_no, bank_ifsc_code,
    current_address, city, state_name, pincode, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'EMP-1001', 'Mahesh',   'Desai',    'Mahesh Desai',    'MALE',
     '1979-05-14', '2020-04-01', 1001, 1001, 1001,
     NULL, 'PERMANENT', 'ACTIVE',
     'mahesh.desai@ksmfg.com', '+91-9825011101', 'Kavita Desai', '+91-9825011102',
     'ABCDD1234E', '4512-8890-1122', '100987654321', NULL,
     'HDFC Bank', '50100234987611', 'HDFC0000123',
     'B-402, Shivalik Highstreet, SG Highway', 'Ahmedabad', 'Gujarat', '380015', TRUE,
     1001, 1001, 1001, 1001),
    (1002, 'EMP-1002', 'Kiran',    'Prajapati','Kiran Prajapati', 'MALE',
     '1985-11-22', '2020-06-15', 1001, 1002, 1001,
     1001, 'PERMANENT', 'ACTIVE',
     'kiran.p@ksmfg.com', '+91-9825022201', 'Meena Prajapati', '+91-9825022202',
     'EFGHP5678K', '6711-2233-4455', '100987654322', NULL,
     'ICICI Bank', '002401556677', 'ICIC0000024',
     'Plot 19, Bopal Green City', 'Ahmedabad', 'Gujarat', '380058', TRUE,
     1001, 1001, 1001, 1001),
    (1003, 'EMP-1003', 'Neha',     'Trivedi',  'Neha Trivedi',    'FEMALE',
     '1988-08-09', '2021-01-10', 1002, 1003, 1001,
     1001, 'PERMANENT', 'ACTIVE',
     'neha.trivedi@ksmfg.com', '+91-9825033301', 'Rohan Trivedi', '+91-9825033302',
     'JKLMT9012N', '7822-3344-5566', '100987654323', NULL,
     'State Bank of India', '30998877665', 'SBIN0004321',
     'A-104, Prahladnagar Corporate Park', 'Ahmedabad', 'Gujarat', '380051', TRUE,
     1001, 1001, 1001, 1001),
    (1004, 'EMP-1004', 'chirag',   'Zala',     'Chirag Zala',     'MALE',
     '1990-02-18', '2021-07-01', 1003, 1004, 1001,
     1002, 'PERMANENT', 'ACTIVE',
     'chirag.zala@ksmfg.com', '+91-9825044401', 'Pravin Zala', '+91-9825044402',
     'MNOPZ3456Q', '8933-4455-6677', '100987654324', '3710998877',
     'Axis Bank', '9180100445566', 'UTIB0000102',
     'Sector 4, Sanand Township', 'Ahmedabad', 'Gujarat', '382110', TRUE,
     1001, 1001, 1001, 1001),
    (1005, 'EMP-1005', 'Sanjay',   'Rathod',   'Sanjay Rathod',   'MALE',
     '1993-07-30', '2022-03-15', 1001, 1007, 1002,
     1002, 'PERMANENT', 'ACTIVE',
     'sanjay.rathod@ksmfg.com', '+91-9825055501', 'Bhavna Rathod', '+91-9825055502',
     'QRSTU7890V', '9044-5566-7788', '100987654325', '3710998878',
     'Bank of Baroda', '03880100019283', 'BARB0RAJKOT',
     'Kalawad Road, Metoda GIDC Quarters', 'Rajkot', 'Gujarat', '360021', TRUE,
     1001, 1002, 1001, 1001),
    (1006, 'EMP-1006', 'Deepak',   'Gohil',    'Deepak Gohil',    'MALE',
     '1996-12-05', '2025-11-01', 1001, 1008, 1001,
     1005, 'PERMANENT', 'PROBATION',
     'deepak.gohil@ksmfg.com', '+91-9825066601', 'Naran Gohil', '+91-9825066602',
     'VWXYZ1122A', '5566-7788-9900', '100987654326', '3710998879',
     'HDFC Bank', '50100998877665', 'HDFC0000123',
     'Sanand GIDC Housing Colony', 'Ahmedabad', 'Gujarat', '382110', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (employee_id) DO NOTHING;

SELECT setval('seq_employee_id', GREATEST((SELECT COALESCE(MAX(employee_id), 1006) FROM tbl_hr_employee), 1006));

-- Link HODs on sample departments
UPDATE tbl_hr_department SET hod_employee_id = 1002 WHERE dept_id = 1001 AND hod_employee_id IS NULL;
UPDATE tbl_hr_department SET hod_employee_id = 1003 WHERE dept_id = 1002 AND hod_employee_id IS NULL;
UPDATE tbl_hr_department SET hod_employee_id = 1004 WHERE dept_id = 1003 AND hod_employee_id IS NULL;

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.3 - Sample Custom Global Role & Permission Matrix Seeds
-- ============================================================================
INSERT INTO tbl_sec_role (
    role_id, role_code, role_name, role_description, is_system_role, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1006, 'QA_MANAGER',   'Quality Assurance & Lab Manager', 'Oversees incoming GRN quality inspection, in-process QC clearance, and lab test certificates', FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1007, 'HR_EXECUTIVE', 'HR & Workforce Executive',        'Manages plant departments, designations, and employee master records across facilities', FALSE, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id) DO NOTHING;

SELECT setval('seq_role_id', GREATEST((SELECT COALESCE(MAX(role_id), 1007) FROM tbl_sec_role), 1007));

INSERT INTO tbl_sec_role_permission (
    role_id, screen_id, can_view, can_add, can_edit, can_delete,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1006, 1001, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001),
    (1006, 1011, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001),
    (1006, 1013, TRUE, FALSE, TRUE,  FALSE, 1001, 1001, 1001, 1001),
    (1007, 1001, TRUE, FALSE, FALSE, FALSE, 1001, 1001, 1001, 1001),
    (1007, 1005, TRUE, TRUE,  TRUE,  FALSE, 1001, 1001, 1001, 1001),
    (1007, 1006, TRUE, TRUE,  TRUE,  FALSE, 1001, 1001, 1001, 1001)
ON CONFLICT (role_id, screen_id) DO NOTHING;

SELECT setval('seq_role_permission_id', GREATEST((SELECT COALESCE(MAX(role_permission_id), 1001) FROM tbl_sec_role_permission), 1001));

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.4 - Sample Employee-Linked ERP User Accounts & Multi-Company /
--          Multi-Branch Role Assignments
-- ============================================================================
-- Password hash below is for 'Admin@123' (12 rounds bcrypt)
INSERT INTO tbl_sec_user (
    user_id, username, email, mobile, password_hash, full_name,
    user_category, linked_entity_id, is_super_admin, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1002, 'arjun.mehta', 'arjun.mehta@ksmfg.com', '+91-9825010001',
     '$2b$12$BmHc8w3xeoS0Jai/3btss.XgwSnwCX6QjMc2lMCuw0qnGiR44HAbS',
     'Arjun Mehta', 'EMPLOYEE', 1001, FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1003, 'kiran.desai', 'kiran.desai@ksmfg.com', '+91-9825010002',
     '$2b$12$BmHc8w3xeoS0Jai/3btss.XgwSnwCX6QjMc2lMCuw0qnGiR44HAbS',
     'Kiran Desai', 'EMPLOYEE', 1002, FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1004, 'priya.nair',  'priya.nair@ksmfg.com',  '+91-9825010003',
     '$2b$12$BmHc8w3xeoS0Jai/3btss.XgwSnwCX6QjMc2lMCuw0qnGiR44HAbS',
     'Priya Nair',  'EMPLOYEE', 1003, FALSE, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (user_id) DO NOTHING;

SELECT setval('seq_user_id', GREATEST((SELECT COALESCE(MAX(user_id), 1004) FROM tbl_sec_user), 1004));

-- Company-Level Role Mappings
INSERT INTO tbl_sec_user_company_role (
    user_id, mapped_comp_id, role_id, is_default, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1002, 1001, 1002, TRUE,  TRUE, 1001, 1001, 1001, 1001),
    (1002, 1002, 1002, FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1001, 1002, TRUE,  TRUE, 1001, 1001, 1001, 1001),
    (1004, 1001, 1006, TRUE,  TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (user_id, mapped_comp_id, role_id) DO NOTHING;

SELECT setval('seq_user_company_role_id', GREATEST((SELECT COALESCE(MAX(user_company_role_id), 1001) FROM tbl_sec_user_company_role), 1001));

-- Branch/Plant-Level Role Mappings
INSERT INTO tbl_sec_user_branch_role (
    user_id, mapped_comp_id, mapped_branch_id, role_id, is_default, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1002, 1001, 1001, 1002, TRUE,  TRUE, 1001, 1001, 1001, 1001),
    (1002, 1001, 1002, 1002, FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1002, 1005, 1002, FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1001, 1001, 1002, TRUE,  TRUE, 1001, 1001, 1001, 1001),
    (1003, 1001, 1002, 1003, FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1001, 1001, 1006, TRUE,  TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (user_id, mapped_branch_id, role_id) DO NOTHING;

SELECT setval('seq_user_branch_role_id', GREATEST((SELECT COALESCE(MAX(user_branch_role_id), 1001) FROM tbl_sec_user_branch_role), 1001));

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.5 - Sample Immutable Field-Delta Audit Trail Entries
-- ============================================================================
INSERT INTO tbl_sys_audit_log (
    audit_id, user_id, username, screen_code, action_type, entity_table, record_id,
    old_value, new_value, changed_fields, ip_address, user_agent, correlation_id,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 'admin', 'AUTH', 'LOGIN', 'tbl_sec_user', 1001,
     NULL,
     '{"username": "admin", "compId": 1001, "branchId": 1001, "fyearId": 1001}'::jsonb,
     NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'corr-seed-1001',
     1001, 1001, 1001, 1001),
    (1002, 1001, 'admin', 'COMPANY_MASTER', 'EDIT', 'tbl_org_company', 1001,
     '{"compCode": "KSMFG", "compName": "Kashvira Manufacturing", "phone": "+91-79-26540000"}'::jsonb,
     '{"compCode": "KSMFG", "compName": "Kashvira Manufacturing ERP", "phone": "+91-79-26543210"}'::jsonb,
     '{"compName": {"old": "Kashvira Manufacturing", "new": "Kashvira Manufacturing ERP"}, "phone": {"old": "+91-79-26540000", "new": "+91-79-26543210"}}'::jsonb,
     '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'corr-seed-1002',
     1001, 1001, 1001, 1001),
    (1003, 1001, 'admin', 'EMPLOYEE_MASTER', 'ADD', 'tbl_hr_employee', 1001,
     NULL,
     '{"empCode": "EMP-1001", "fullName": "Arjun Mehta", "deptCode": "PROD-CNC", "desigCode": "PLT-HEAD", "employmentStatus": "ACTIVE"}'::jsonb,
     NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'corr-seed-1003',
     1001, 1001, 1001, 1001),
    (1004, 1001, 'admin', 'ROLE_MASTER', 'EDIT', 'tbl_sec_role_permission', 1002,
     '{"roleCode": "PLANT_MANAGER", "grantedScreenCount": 6, "grantedActionCount": 2}'::jsonb,
     '{"roleCode": "PLANT_MANAGER", "grantedScreenCount": 8, "grantedActionCount": 4}'::jsonb,
     '{"grantedScreenCount": {"old": 6, "new": 8}, "grantedActionCount": {"old": 2, "new": 4}}'::jsonb,
     '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'corr-seed-1004',
     1001, 1001, 1001, 1001)
ON CONFLICT (audit_id) DO NOTHING;

SELECT setval('seq_audit_id', GREATEST((SELECT COALESCE(MAX(audit_id), 1004) FROM tbl_sys_audit_log), 1004));
