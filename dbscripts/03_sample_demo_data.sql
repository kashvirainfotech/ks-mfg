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
    work_email, mobile_no, emergency_contact_name, emergency_contact_phone,
    pan_no, aadhaar_masked, pf_uan_no, esi_no,
    bank_name, bank_account_no, bank_ifsc_code,
    address_line1, city, state_name, pincode, is_active,
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

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.6 - Sample Company/Plant Configuration Overrides & Multi-Plant
--          Document Numbering Series (tbl_sys_config, tbl_sys_doc_number_series)
-- ============================================================================
INSERT INTO tbl_sys_config (
    config_id, config_key, config_name, config_group, data_type,
    config_value, default_value, allowed_values, scope_level,
    target_comp_id, target_branch_id, description, is_system_locked, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1010, 'PROD_BACKFLUSH_RAW_MATERIAL',  'Auto-Backflush Child BOM Items on PRN (Rajkot Foundry Override)', 'PRODUCTION_SHOPFLOOR', 'BOOLEAN', 'TRUE',          'FALSE',         NULL,                              'BRANCH',  1001, 1002, 'Rajkot Foundry & CNC Unit uses continuous furnace backflushing upon PRN completion', FALSE, TRUE, 1001, 1002, 1001, 1001),
    (1011, 'INV_VALUATION_METHOD',         'Inventory Valuation Method (Kashvira Auto Components Override)',  'INVENTORY_VALUATION',  'ENUM',    'WEIGHTED_AVG',  'FIFO',          'FIFO,WEIGHTED_AVG,STANDARD_COST', 'COMPANY', 1002, NULL, 'Automotive OEM division values high-volume fasteners and stampings on Weighted Average', FALSE, TRUE, 1002, 1005, 1003, 1001),
    (1012, 'PROD_MAX_SCRAP_TOLERANCE_PCT', 'Shopfloor Scrap Variance Alert Threshold (Rajkot Casting)',       'PRODUCTION_SHOPFLOOR', 'NUMBER',  '4.5',           '5.0',           NULL,                              'BRANCH',  1001, 1002, 'Sand-casting runner/riser fettling loss allowance for Rajkot Foundry unit',              FALSE, TRUE, 1001, 1002, 1001, 1001)
ON CONFLICT (config_id) DO NOTHING;

SELECT setval('seq_config_id', GREATEST((SELECT COALESCE(MAX(config_id), 1012) FROM tbl_sys_config), 1012));

INSERT INTO tbl_sys_doc_number_series (
    series_id, series_code, series_name, doc_type_code, doc_type_name, module_name,
    target_comp_id, target_branch_id, target_fyear_id,
    prefix_template, suffix_template, separator_char, padding_digits,
    starting_no, current_next_no, reset_frequency, allow_manual_override, is_default, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1009, 'RJK-PO-2627',  'Rajkot Foundry Purchase Order Series',      'PO',               'Purchase Order',           'PROCUREMENT',    1001, 1002, 1001, 'KSMFG/RJK/PO',  '26-27', '/', 4, 1, 9,  'FYEAR', FALSE, TRUE, TRUE, 1001, 1002, 1001, 1001),
    (1010, 'RJK-WO-2627',  'Rajkot Foundry Work Order Series',          'WORK_ORDER',       'Manufacturing Work Order', 'PRODUCTION',     1001, 1002, 1001, 'KSMFG/RJK/WO',  '26-27', '/', 4, 1, 12, 'FYEAR', FALSE, TRUE, TRUE, 1001, 1002, 1001, 1001),
    (1011, 'AHM-JW-2627',  'Ahmedabad Subcontracting Job-Work Challan', 'JOB_WORK_OUT',     'Outward Job-Work Challan', 'PROCUREMENT',    1001, 1001, 1001, 'KSMFG/AHM/JWO', '26-27', '/', 4, 1, 7,  'FYEAR', FALSE, TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1012, 'PNQ-WO-2627',  'Pune Auto Powertrain Work Order Series',    'WORK_ORDER',       'Manufacturing Work Order', 'PRODUCTION',     1002, 1005, 1003, 'KSAUTO/PNQ/WO', '26-27', '/', 5, 1, 25, 'FYEAR', FALSE, TRUE, TRUE, 1002, 1005, 1003, 1001)
ON CONFLICT (series_id) DO NOTHING;

SELECT setval('seq_doc_series_id', GREATEST((SELECT COALESCE(MAX(series_id), 1012) FROM tbl_sys_doc_number_series), 1012));

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 3.1 - Sample Multi-Plant Warehouses & Multi-Level Storage Bins
--          (tbl_inv_warehouse, tbl_inv_storage_bin)
-- ============================================================================
INSERT INTO tbl_inv_warehouse (
    warehouse_id, warehouse_code, warehouse_name, warehouse_type,
    target_comp_id, target_branch_id, incharge_employee_id,
    allow_negative_stock, is_qc_hold_store, is_shopfloor_wip,
    storage_temp_min_c, storage_temp_max_c, address_location,
    is_default, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'WH-AHM-RM01',  'Ahmedabad Central Alloy & Bar Raw Material Store', 'RAW_MATERIAL',    1001, 1001, 1004, FALSE, FALSE, FALSE, 18.00, 35.00, 'Bay A1-A4, Sanand Main Plant West Wing',       TRUE,  TRUE, 1001, 1001, 1001, 1001),
    (1002, 'WH-AHM-QC01',  'Ahmedabad Inward GRN Quarantine & QC Hold Bay',    'QUARANTINE_QC',   1001, 1001, 1003, FALSE, TRUE,  FALSE, 20.00, 28.00, 'Receiving Dock 2, Metallurgy QC Annex',       FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1003, 'WH-AHM-WIP01', 'Ahmedabad CNC Machining & Valve Assembly WIP Floor','WIP_SHOPFLOOR',  1001, 1001, 1002, FALSE, FALSE, TRUE,  20.00, 32.00, 'Shopfloor Hall B — CNC Turning & VMC Cells',  FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1004, 'WH-AHM-FG01',  'Ahmedabad Bonded Finished Goods & Dispatch Hub',   'FINISHED_GOODS',  1001, 1001, 1004, FALSE, FALSE, FALSE, 15.00, 30.00, 'Dispatch Terminal East, High-Bay Pallet Racks',FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1005, 'WH-AHM-SCR01', 'Ahmedabad Turning Chips & QC Rejection Scrap Yard','SCRAP_REJECTION', 1001, 1001, 1004, FALSE, FALSE, FALSE, NULL,  NULL,  'Rear Yard Compound C, Segregated Metal Bins', FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1006, 'WH-RJK-RM01',  'Rajkot Foundry Pig Iron, Scrap & Sand Store',      'RAW_MATERIAL',    1001, 1002, 1005, FALSE, FALSE, FALSE, NULL,  NULL,  'Metoda GIDC Plot 18, Foundry Raw Material Shed',TRUE, TRUE, 1001, 1002, 1001, 1001),
    (1007, 'WH-PNQ-RM01',  'Pune Auto Powertrain Forging & Fastener Store',    'RAW_MATERIAL',    1002, 1005, 1001, FALSE, FALSE, FALSE, 18.00, 30.00, 'Chakan Phase II, Block D Automated Racking',  TRUE,  TRUE, 1002, 1005, 1003, 1001)
ON CONFLICT (warehouse_id) DO NOTHING;

SELECT setval('seq_warehouse_id', GREATEST((SELECT COALESCE(MAX(warehouse_id), 1007) FROM tbl_inv_warehouse), 1007));

INSERT INTO tbl_inv_storage_bin (
    bin_id, warehouse_id, bin_code, bin_name,
    zone_code, rack_code, shelf_level, bin_position, bin_type,
    max_weight_kg, max_volume_cbm,
    allow_mixed_items, allow_mixed_batches, is_pick_face, is_receiving_staging, is_blocked_for_putaway, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 'RM-Z1-R01-S01-B01', 'SS-316 Bar Stock Cantilever Cradle 01',      'Z1-BAR',     'R01', 'S01', 'B01', 'CANTILEVER_BAR',   2500.00, 4.500, FALSE, FALSE, TRUE,  FALSE, FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1002, 1001, 'RM-Z1-R01-S01-B02', 'SS-304 Bar Stock Cantilever Cradle 02',      'Z1-BAR',     'R01', 'S01', 'B02', 'CANTILEVER_BAR',   2500.00, 4.500, FALSE, FALSE, TRUE,  FALSE, FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1003, 1001, 'RM-Z2-R04-S02-B01', 'Forged Valve Body Casting Pallet Bin A',     'Z2-CASTING', 'R04', 'S02', 'B01', 'PALLET_RACK',      1500.00, 2.400, TRUE,  FALSE, TRUE,  FALSE, FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1004, 1001, 'RM-Z3-R02-S03-B04', 'PTFE Seals, O-Rings & Fasteners Tote Bin',   'Z3-SPARES',  'R02', 'S03', 'B04', 'SMALL_PARTS_TOTE',  150.00, 0.350, TRUE,  TRUE,  TRUE,  FALSE, FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1005, 1002, 'QC-Z1-R01-S01-B01', 'Inward GRN Pending Metallurgy Test Cage 01',  'Z1-INWARD',  'R01', 'S01', 'B01', 'QUARANTINE_CAGE',  2000.00, 3.600, TRUE,  TRUE,  FALSE, TRUE,  FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1006, 1003, 'WIP-CNC-L01-S01-B01','CNC Turning Cell #1 Lineside Kanban Buffer', 'Z1-CNC',     'L01', 'S01', 'B01', 'LINESIDE_KANBAN',   800.00, 1.200, TRUE,  FALSE, TRUE,  FALSE, FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1007, 1004, 'FG-Z1-R01-S01-B01', 'Export Valve Pallet Export Dispatch Rack 01', 'Z1-EXPORT',  'R01', 'S01', 'B01', 'PALLET_RACK',      1800.00, 2.880, FALSE, FALSE, TRUE,  FALSE, FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1008, 1006, 'RJK-Z1-FLR-S01-B01','Foundry Induction Furnace Charge Floor Bunker','Z1-MELT',   'FLR', 'S01', 'B01', 'FLOOR_BULK',       5000.00, 8.000, TRUE,  TRUE,  TRUE,  FALSE, FALSE, TRUE, 1001, 1002, 1001, 1001)
ON CONFLICT (bin_id) DO NOTHING;

SELECT setval('seq_storage_bin_id', GREATEST((SELECT COALESCE(MAX(bin_id), 1008) FROM tbl_inv_storage_bin), 1008));

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 3.2 - Sample Multi-Level Item Category & Grouping Tree (tbl_inv_item_category)
-- ============================================================================
INSERT INTO tbl_inv_item_category (
    category_id, category_code, category_name, parent_category_id,
    category_type, hsn_sac_code, default_tax_rate, default_valuation_method,
    level_depth, hierarchy_path, is_leaf, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- Level 1: Root Categories
    (1001, 'RAW_MATERIAL',      'Raw Materials & Primary Stock',              NULL, 'RAW_MATERIAL',     '7200', 18.00, 'FIFO', 1, 'RAW_MATERIAL',                    FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1009, 'WIP_SUB_ASSEMBLY',  'Work-In-Progress & Sub-Assemblies',          NULL, 'WIP_SUB_ASSEMBLY', '8708', 18.00, 'FIFO', 1, 'WIP_SUB_ASSEMBLY',                FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1012, 'FINISHED_GOODS',    'Finished Goods (Saleable)',                  NULL, 'FINISHED_GOODS',   '8708', 28.00, 'FIFO', 1, 'FINISHED_GOODS',                  FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1015, 'CONSUMABLES_MRO',   'MRO, Oils & Plant Consumables',              NULL, 'CONSUMABLES_MRO',  '2710', 18.00, 'FIFO', 1, 'CONSUMABLES_MRO',                 FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1017, 'TOOLS_DIES',        'Press Tooling, CNC Cutters & Fixtures',      NULL, 'TOOLS_DIES',       '8207', 18.00, 'FIFO', 1, 'TOOLS_DIES',                      FALSE, TRUE, 1001, 1001, 1001, 1001),

    -- Level 2: Sub-Categories under RAW_MATERIAL
    (1002, 'RM_FERROUS',        'Ferrous Metals & Steel Alloys',              1001, 'RAW_MATERIAL',     '7208', 18.00, 'FIFO', 2, 'RAW_MATERIAL / RM_FERROUS',        FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1005, 'RM_NON_FERROUS',    'Non-Ferrous Metals (Al, Brass, Cu)',         1001, 'RAW_MATERIAL',     '7601', 18.00, 'FIFO', 2, 'RAW_MATERIAL / RM_NON_FERROUS',    FALSE, TRUE, 1001, 1001, 1001, 1001),
    (1007, 'RM_POLYMERS',       'Engineering Polymers & Thermoplastics',      1001, 'RAW_MATERIAL',     '3902', 18.00, 'FIFO', 2, 'RAW_MATERIAL / RM_POLYMERS',       FALSE, TRUE, 1001, 1001, 1001, 1001),

    -- Level 3: Leaf Categories under RM_FERROUS
    (1003, 'RM_HR_SHEET',       'Hot Rolled Steel Sheets & Coils',            1002, 'RAW_MATERIAL',     '7208', 18.00, 'FIFO', 3, 'RAW_MATERIAL / RM_FERROUS / RM_HR_SHEET', TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1004, 'RM_CR_COIL',        'Cold Rolled Precision Steel Coils',          1002, 'RAW_MATERIAL',     '7209', 18.00, 'FIFO', 3, 'RAW_MATERIAL / RM_FERROUS / RM_CR_COIL',  TRUE, TRUE, 1001, 1001, 1001, 1001),

    -- Level 3: Leaf Categories under RM_NON_FERROUS & RM_POLYMERS
    (1006, 'RM_ALUM_INGOT',     'Aluminum Alloy Ingots (LM24/ADC12)',         1005, 'RAW_MATERIAL',     '7601', 18.00, 'FIFO', 3, 'RAW_MATERIAL / RM_NON_FERROUS / RM_ALUM_INGOT', TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1008, 'RM_PP_GRANULES',    'Polypropylene Copolymer (PP-CP)',            1007, 'RAW_MATERIAL',     '3902', 18.00, 'FIFO', 3, 'RAW_MATERIAL / RM_POLYMERS / RM_PP_GRANULES',  TRUE, TRUE, 1001, 1001, 1001, 1001),

    -- Level 2: Leaf Categories under WIP_SUB_ASSEMBLY
    (1010, 'WIP_PRESSED_PARTS', 'Stamped & Pressed Body Shells',              1009, 'WIP_SUB_ASSEMBLY', '8708', 28.00, 'FIFO', 2, 'WIP_SUB_ASSEMBLY / WIP_PRESSED_PARTS',  TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1011, 'WIP_WELDED_FRAME',  'Robotic Welded Tubular Frames',              1009, 'WIP_SUB_ASSEMBLY', '8708', 28.00, 'FIFO', 2, 'WIP_SUB_ASSEMBLY / WIP_WELDED_FRAME',   TRUE, TRUE, 1001, 1001, 1001, 1001),

    -- Level 2: Leaf Categories under FINISHED_GOODS
    (1013, 'FG_AUTO_COMPONENTS','Automotive Drivetrain & Engine Mounts',      1012, 'FINISHED_GOODS',   '8708', 28.00, 'FIFO', 2, 'FINISHED_GOODS / FG_AUTO_COMPONENTS',    TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1014, 'FG_FABRICATED_UNITS','Heavy Fabricated Industrial Machine Bases', 1012, 'FINISHED_GOODS',   '8479', 18.00, 'FIFO', 2, 'FINISHED_GOODS / FG_FABRICATED_UNITS',    TRUE, TRUE, 1001, 1001, 1001, 1001),

    -- Level 2: Leaf Categories under CONSUMABLES & TOOLS
    (1016, 'MRO_LUBRICANTS',    'Hydraulic Oils, Soluble Coolants & Greases', 1015, 'CONSUMABLES_MRO',  '2710', 18.00, 'FIFO', 2, 'CONSUMABLES_MRO / MRO_LUBRICANTS',        TRUE, TRUE, 1001, 1001, 1001, 1001),
    (1018, 'MRO_TOOLING',       'Carbide Cutting Inserts & End Mills',        1017, 'TOOLS_DIES',       '8207', 18.00, 'FIFO', 2, 'TOOLS_DIES / MRO_TOOLING',               TRUE, TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (category_id) DO NOTHING;

SELECT setval('seq_item_category_id', GREATEST((SELECT COALESCE(MAX(category_id), 1018) FROM tbl_inv_item_category), 1018));

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 3.3 - Sample Manufacturing & Engineering Items (tbl_inv_item)
-- ============================================================================
INSERT INTO tbl_inv_item (
    item_id, item_code, item_name, category_id, item_type, description,
    base_uom_id, purchase_uom_id, sales_uom_id, hsn_sac_code, tax_rate,
    standard_cost, purchase_rate, sales_rate,
    min_stock_level, max_stock_level, reorder_point, safety_stock,
    lead_time_days, valuation_method,
    is_batch_managed, is_serial_managed, is_qc_inspection_required, shelf_life_days,
    default_warehouse_id, default_bin_id,
    drawing_no, revision_no, weight_per_unit_kg, is_bom_allowed, yield_percentage, inspection_lead_time_days,
    is_active, comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'RM-SS316-ROUND-50', 'Stainless Steel 316 Round Bar Dia 50mm', 1002, 'RAW_MATERIAL',
     'High corrosion-resistant SS316 round solid bar for valve trim and shaft machining',
     1001, 1001, 1001, '7222', 18.00,
     385.0000, 380.0000, 0.0000,
     500.000, 5000.000, 1200.000, 300.000,
     10, 'FIFO',
     TRUE, FALSE, TRUE, NULL,
     1001, 1001,
     'SPEC-BAR-50-SS', 'Rev.1', 15.4200, FALSE, 100.00, 2,
     TRUE, 1001, 1001, 1001, 1001),

    (1002, 'RM-CR-COIL-1.2MM', 'Cold Rolled Precision Steel Coil 1.2mm x 1250mm', 1004, 'RAW_MATERIAL',
     'Deep drawing automotive grade CR steel coils for precision sheet metal stamping',
     1001, 1002, 1001, '7209', 18.00,
     72.0000, 70.0000, 0.0000,
     3000.000, 25000.000, 6000.000, 1500.000,
     14, 'WEIGHTED_AVG',
     TRUE, FALSE, TRUE, NULL,
     1001, 1002,
     'SPEC-CR-COIL-12', 'Rev.0', NULL, FALSE, 100.00, 2,
     TRUE, 1001, 1001, 1001, 1001),

    (1003, 'RM-ALUM-LM24-ING', 'HPDC Aluminum Alloy Ingot LM24', 1006, 'RAW_MATERIAL',
     'Aluminum foundry ingots for high pressure die-cast powertrain components',
     1001, 1001, 1001, '7601', 18.00,
     215.0000, 210.0000, 0.0000,
     1500.000, 10000.000, 3500.000, 800.000,
     7, 'FIFO',
     TRUE, FALSE, TRUE, NULL,
     1001, 1003,
     NULL, NULL, 6.0000, FALSE, 100.00, 1,
     TRUE, 1001, 1001, 1001, 1001),

    (1004, 'RM-PP-CP-MFI12', 'Polypropylene Copolymer Granules Injection Grade', 1008, 'RAW_MATERIAL',
     'High-impact copolymer pellets for technical injection molded automotive enclosures',
     1001, 1001, 1001, '3902', 18.00,
     105.0000, 102.5000, 0.0000,
     800.000, 8000.000, 2500.000, 500.000,
     5, 'FIFO',
     TRUE, FALSE, TRUE, NULL,
     1001, 1004,
     NULL, NULL, NULL, FALSE, 100.00, 1,
     TRUE, 1001, 1001, 1001, 1001),

    (1005, 'WIP-VLV-BODY-MACH', 'Machined SS-316 Gate Valve Body Casting 2" 150#', 1009, 'WIP_SEMI_FINISHED',
     'Precision CNC turned and bored gate valve casting with raised face flanged ends',
     1003, 1003, 1003, '8481', 18.00,
     1850.0000, 0.0000, 0.0000,
     50.000, 400.000, 100.000, 25.000,
     4, 'STANDARD_COST',
     TRUE, FALSE, TRUE, NULL,
     1003, 1006,
     'DWG-VB-2026-01', 'Rev.B', 12.8000, TRUE, 98.00, 1,
     TRUE, 1001, 1001, 1001, 1001),

    (1006, 'WIP-PUMP-IMPELLER', 'Dynamically Balanced Bronze Impeller Ø180mm', 1009, 'WIP_SEMI_FINISHED',
     'Sub-assembly bronze impeller for multi-stage centrifugal pump assembly line',
     1003, 1003, 1003, '8413', 18.00,
     950.0000, 0.0000, 0.0000,
     30.000, 250.000, 80.000, 15.000,
     3, 'STANDARD_COST',
     TRUE, FALSE, TRUE, NULL,
     1003, 1006,
     'DWG-IMP-180-C', 'Rev.0', 4.2500, TRUE, 99.00, 1,
     TRUE, 1001, 1001, 1001, 1001),

    (1007, 'WIP-AUTO-STAMP-SHL', 'Stamped Sheet Metal Outer Door Panel Shell', 1010, 'WIP_SEMI_FINISHED',
     'Single-draw stamped 1.2mm CR outer door shell with punched hinge mounting recesses',
     1003, 1003, 1003, '8708', 28.00,
     420.0000, 0.0000, 0.0000,
     200.000, 1500.000, 500.000, 100.000,
     2, 'FIFO',
     TRUE, FALSE, TRUE, NULL,
     1003, 1006,
     'DWG-DP-2024-X', 'Rev.2', 8.6000, TRUE, 97.50, 1,
     TRUE, 1001, 1001, 1001, 1001),

    (1008, 'FG-GATE-VALVE-50', 'Industrial SS-316 Flanged Gate Valve 2" Class 150', 1014, 'FINISHED_GOODS',
     'API 600 compliant stainless steel gate valve with handwheel actuator and hydrostatic test certificate',
     1003, 1003, 1003, '8481', 18.00,
     4800.0000, 0.0000, 7200.0000,
     20.000, 200.000, 50.000, 10.000,
     5, 'FIFO',
     TRUE, TRUE, TRUE, NULL,
     1004, 1007,
     'DWG-GV50-ASSY', 'Rev.D', 18.5000, TRUE, 100.00, 1,
     TRUE, 1001, 1001, 1001, 1001),

    (1009, 'FG-AUTO-MNT-DRV', 'Automotive Hydromount Powertrain Assembly', 1013, 'FINISHED_GOODS',
     'OEM-spec liquid-filled vibration damping powertrain engine mount assembly',
     1003, 1003, 1004, '8708', 28.00,
     1250.0000, 0.0000, 1950.0000,
     100.000, 1000.000, 300.000, 50.000,
     3, 'FIFO',
     TRUE, FALSE, TRUE, NULL,
     1004, 1007,
     'DWG-HMP-900', 'Rev.4', 3.1000, TRUE, 100.00, 1,
     TRUE, 1001, 1001, 1001, 1001),

    (1010, 'MRO-COOL-SYN-200L', 'Fully Synthetic High-Pressure CNC Cutting Fluid', 1016, 'CONSUMABLE_MRO',
     'Chlorine-free water-miscible biostable coolant concentrate for multi-axis CNC machines',
     1007, 1007, 1007, '2710', 18.00,
     180.0000, 175.0000, 0.0000,
     200.000, 1200.000, 600.000, 100.000,
     3, 'FIFO',
     TRUE, FALSE, FALSE, 730,
     1001, 1004,
     NULL, NULL, 1.0200, FALSE, 100.00, 1,
     TRUE, 1001, 1001, 1001, 1001),

    (1011, 'MRO-CNMG-120408', 'Tungsten Carbide Turning Insert CNMG 120408-PM', 1018, 'TOOLING_DIE',
     'Multi-layer CVD coated carbide insert for general turning of stainless steel and superalloys',
     1003, 1004, 1003, '8207', 18.00,
     240.0000, 230.0000, 0.0000,
     50.000, 500.000, 150.000, 20.000,
     5, 'FIFO',
     FALSE, FALSE, FALSE, NULL,
     1001, 1004,
     NULL, NULL, 0.0150, FALSE, 100.00, 1,
     TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (item_id) DO NOTHING;

SELECT setval('seq_item_id', GREATEST((SELECT COALESCE(MAX(item_id), 1011) FROM tbl_inv_item), 1011));




