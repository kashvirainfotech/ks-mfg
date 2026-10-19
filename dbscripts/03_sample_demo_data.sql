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

-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 4.1 - Sample Unified Parties & Multi-Locations (tbl_crm_party)
-- ============================================================================
INSERT INTO tbl_crm_party (
    party_id, party_code, party_name, trade_name,
    is_customer, is_supplier, is_job_worker, is_transporter,
    party_group, pan_no, msme_reg_no,
    primary_contact_name, primary_email, primary_phone, website,
    credit_limit, credit_days, payment_terms, currency_code, gst_treatment_type,
    is_active, remarks,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'CUST-MARUTI-01', 'Maruti Suzuki India Limited', 'Maruti Suzuki - Powertrain Division',
     TRUE, FALSE, FALSE, FALSE,
     'OEM_AUTOMOTIVE', 'AAACM1234F', NULL,
     'Rakesh Sharma (Head of SCM)', 'rakesh.sharma@maruti.co.in', '+91-9811012345', 'https://www.marutisuzuki.com',
     5000000.00, 45, 'NET_45', 'INR', 'REGISTERED_REGULAR',
     TRUE, 'Tier-1 OEM Automotive Engine Mount and Sub-Assembly Contract',
     1001, 1001, 1001, 1001),

    (1002, 'CUST-LNT-VALVE-01', 'Larsen & Toubro Limited - Heavy Engineering Division', 'L&T Valves Hazira Works',
     TRUE, FALSE, FALSE, FALSE,
     'HEAVY_ENGINEERING', 'AAACL5678G', NULL,
     'Suresh Narayanan (VP Procurement)', 'suresh.n@lntvalves.com', '+91-9820054321', 'https://www.larsentoubro.com',
     3500000.00, 30, 'NET_30', 'INR', 'REGISTERED_REGULAR',
     TRUE, 'Class 150/300 Stainless Steel Flanged Gate Valves Supply Agreement',
     1001, 1001, 1001, 1001),

    (1003, 'SUPP-JSW-STEEL-01', 'JSW Steel Coated Products Limited', 'JSW Steel',
     FALSE, TRUE, FALSE, FALSE,
     'RAW_MATERIAL_VENDOR', 'AAACJ9012H', NULL,
     'Anand Verma (Key Account Manager)', 'anand.verma@jsw.in', '+91-9822067890', 'https://www.jsw.in',
     0.00, 30, 'NET_30', 'INR', 'REGISTERED_REGULAR',
     TRUE, 'Prime Supplier for Cold Rolled (CR) Precision Steel Coils & Sheets',
     1001, 1001, 1001, 1001),

    (1004, 'SUPP-SANDVIK-01', 'Sandvik Coromant India Private Limited', 'Sandvik Tooling Systems',
     FALSE, TRUE, FALSE, FALSE,
     'CONSUMABLE_VENDOR', 'AAACS3456K', NULL,
     'Priya Kulkarni (Technical Sales Engineer)', 'priya.kulkarni@sandvik.com', '+91-9823011223', 'https://www.sandvik.coromant.com',
     500000.00, 15, 'NET_15', 'INR', 'REGISTERED_REGULAR',
     TRUE, 'Carbide Cutting Inserts, End Mills & Toolholders Rate Contract',
     1001, 1001, 1001, 1001),

    (1005, 'JW-MICRO-PRECISION', 'Micro Precision Job-Works & Heat Treatment', 'Micro Precision Works',
     FALSE, TRUE, TRUE, FALSE,
     'JOB_WORK_CONTRACTOR', 'ABCFM7890L', 'UDYAM-GJ-01-0012345',
     'Bhavesh Panchal (Managing Partner)', 'bhavesh@microprecision.co.in', '+91-9824099887', NULL,
     300000.00, 15, 'NET_15', 'INR', 'REGISTERED_REGULAR',
     TRUE, 'Outsourced induction hardening, CNC turning and precision cylindrical grinding',
     1001, 1001, 1001, 1001),

    (1006, 'TRANS-VRL-LOGISTICS', 'VRL Logistics Limited', 'VRL Surface Cargo',
     FALSE, TRUE, FALSE, TRUE,
     'LOGISTICS_PARTNER', 'AAACV1234M', NULL,
     'Manoj Hegde (Regional Logistics Manager)', 'manoj.hegde@vrllogistics.com', '+91-9845012345', 'https://www.vrllogistics.com',
     200000.00, 15, 'NET_15', 'INR', 'REGISTERED_REGULAR',
     TRUE, 'Dedicated surface fleet for multi-plant raw material pickup and finished dispatch',
     1001, 1001, 1001, 1001)
ON CONFLICT (party_id) DO NOTHING;

SELECT setval('seq_party_id', GREATEST((SELECT COALESCE(MAX(party_id), 1006) FROM tbl_crm_party), 1006));

-- Multi-Location Billing & Shipping Addresses (tbl_crm_party_address)
INSERT INTO tbl_crm_party_address (
    address_id, party_id, address_label, address_type,
    gstin, state_code, state_name,
    address_line1, address_line2, city, pincode,
    contact_person, phone, email,
    is_default_billing, is_default_shipping, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 'Maruti Corporate Headquarters', 'BILLING',
     '07AAACM1234F1Z1', '07', 'Delhi',
     '1, Nelson Mandela Road, Vasant Kunj', 'Phase II', 'New Delhi', '110070',
     'Finance & Accounts Dept', '+91-11-46781000', 'accounts@maruti.co.in',
     TRUE, FALSE, TRUE,
     1001, 1001, 1001, 1001),

    (1002, 1001, 'Gurugram Powertrain Plant Dock 4', 'SHIPPING',
     '06AAACM1234F1Z3', '06', 'Haryana',
     'Palam Gurgaon Road, Sector 18', 'Automotive Manufacturing Zone', 'Gurugram', '122015',
     'Inward Receiving Dock #4', '+91-124-2346700', 'receiving.dock4@maruti.co.in',
     FALSE, TRUE, TRUE,
     1001, 1001, 1001, 1001),

    (1003, 1002, 'L&T Hazira Manufacturing Complex', 'BOTH',
     '24AAACL5678G1Z5', '24', 'Gujarat',
     'Surat-Hazira Road, Post Bhatha', 'Heavy Engineering Division', 'Surat', '394510',
     'Suresh Narayanan', '+91-9820054321', 'suresh.n@lntvalves.com',
     TRUE, TRUE, TRUE,
     1001, 1001, 1001, 1001),

    (1004, 1003, 'JSW Bandra Kurla Corporate Office', 'BILLING',
     '27AAACJ9012H1ZD', '27', 'Maharashtra',
     'JSW Centre, Bandra Kurla Complex', 'Bandra East', 'Mumbai', '400051',
     'Commercial Billing Desk', '+91-22-42861000', 'commercial.steel@jsw.in',
     TRUE, FALSE, TRUE,
     1001, 1001, 1001, 1001),

    (1005, 1003, 'JSW Dolvi Steel Works Plant Gate', 'SHIPPING',
     '27AAACJ9012H1ZD', '27', 'Maharashtra',
     'Geetapuram, Dolvi, Pen Tehsil', 'Coated Steel Dispatch Bay', 'Raigad', '402107',
     'Dispatch Yard Incharge', '+91-2143-277500', 'dolvi.dispatch@jsw.in',
     FALSE, TRUE, TRUE,
     1001, 1001, 1001, 1001),

    (1006, 1004, 'Sandvik Dapodi Tech Center', 'BOTH',
     '27AAACS3456K1ZV', '27', 'Maharashtra',
     'Mumbai-Pune Road, Dapodi', 'Tooling Application Center', 'Pune', '411012',
     'Priya Kulkarni', '+91-9823011223', 'priya.kulkarni@sandvik.com',
     TRUE, TRUE, TRUE,
     1001, 1001, 1001, 1001),

    (1007, 1005, 'Micro Precision Changodar Workshop', 'BOTH',
     '24ABCFM7890L1ZQ', '24', 'Gujarat',
     'Plot 45, GIDC Phase II, Changodar', 'Near Sanand Highway Junction', 'Ahmedabad', '382213',
     'Bhavesh Panchal', '+91-9824099887', 'bhavesh@microprecision.co.in',
     TRUE, TRUE, TRUE,
     1001, 1001, 1001, 1001),

    (1008, 1006, 'VRL Logistics Ahmedabad Hub', 'BOTH',
     '24AAACV1234M1Z2', '24', 'Gujarat',
     'Transport Nagar, Aslali Ring Road', 'Survey 112/A, National Highway 48', 'Ahmedabad', '382427',
     'Manoj Hegde', '+91-9845012345', 'manoj.hegde@vrllogistics.com',
     TRUE, TRUE, TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (address_id) DO NOTHING;

SELECT setval('seq_party_address_id', GREATEST((SELECT COALESCE(MAX(address_id), 1008) FROM tbl_crm_party_address), 1008));







-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 4.2 - Sample Tiered Price Lists, Rate Cards & Volume Tiers
--          (tbl_crm_price_list, tbl_crm_price_list_item, tbl_crm_party_price_list)
-- ============================================================================
INSERT INTO tbl_crm_price_list (
    price_list_id, price_list_code, price_list_name, price_list_type,
    currency_code, effective_from, effective_to, is_default, description, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'PL-OEM-MARUTI-2026', 'Maruti Suzuki OEM Tier-1 Powertrain Rate Card', 'SALES',
     'INR', '2026-04-01', '2027-03-31', FALSE,
     'Dedicated Tier-1 automotive rate contract for engine hydromounts with volume-based brackets', TRUE,
     1001, 1001, 1001, 1001),

    (1002, 'PL-VALVES-STD-2026', 'Standard Industrial Process Valves Wholesale Price List', 'SALES',
     'INR', '2026-04-01', '2027-03-31', TRUE,
     'Default benchmark price list for gate, globe, and check valves distributed pan-India', TRUE,
     1001, 1001, 1001, 1001),

    (1003, 'VRC-JSW-STEEL-2026', 'JSW Steel Annual Prime CR Coil Procurement Contract', 'PURCHASE',
     'INR', '2026-04-01', '2027-03-31', FALSE,
     'Long-term steel supply agreement for Cold Rolled 2.00mm sheet coils with tonnage rebate', TRUE,
     1001, 1001, 1001, 1001),

    (1004, 'VRC-SANDVIK-TOOL-2026', 'Sandvik Coromant CNC Tooling & Inserts Rate Contract', 'PURCHASE',
     'INR', '2026-04-01', '2027-03-31', FALSE,
     'Fixed pricing on carbide turning and milling inserts with volume discount tiers', TRUE,
     1001, 1001, 1001, 1001),

    (1005, 'JWC-PREC-HEAT-2026', 'Micro Precision Machining & Induction Hardening Job-Work Card', 'JOB_WORK',
     'INR', '2026-04-01', '2027-03-31', FALSE,
     'Subcontracting machining rates per piece for valve body castings and spindle shafts', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (price_list_id) DO NOTHING;

SELECT setval('seq_price_list_id', GREATEST((SELECT COALESCE(MAX(price_list_id), 1005) FROM tbl_crm_price_list), 1005));

-- Price List Line Items with Volume Brackets (tbl_crm_price_list_item)
INSERT INTO tbl_crm_price_list_item (
    price_list_item_id, price_list_id, item_id, uom_id,
    min_qty, max_qty, base_rate, discount_pct, effective_rate,
    lead_time_days, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- PL-OEM-MARUTI-2026: FG-AUTO-MNT-DRV (Item 1009, NOS 1003)
    (1001, 1001, 1009, 1003, 1.000, 99.000, 1950.0000, 0.00, 1950.0000, 2, 'Tier 1 Standard Batch (< 100 pcs)', TRUE, 1001, 1001, 1001, 1001),
    (1002, 1001, 1009, 1003, 100.000, 499.000, 1950.0000, 5.00, 1852.5000, 2, 'Tier 2 Production Run (100 - 499 pcs)', TRUE, 1001, 1001, 1001, 1001),
    (1003, 1001, 1009, 1003, 500.000, NULL, 1950.0000, 10.00, 1755.0000, 3, 'Tier 3 Monthly Bulk Commitment (>= 500 pcs)', TRUE, 1001, 1001, 1001, 1001),

    -- PL-VALVES-STD-2026: FG-GATE-VALVE-50 (Item 1008, NOS 1003)
    (1004, 1002, 1008, 1003, 1.000, 9.000, 8500.0000, 0.00, 8500.0000, 5, 'Spot / Retail Valve Orders', TRUE, 1001, 1001, 1001, 1001),
    (1005, 1002, 1008, 1003, 10.000, NULL, 8500.0000, 8.00, 7820.0000, 7, 'Commercial Project Wholesale Lot (>= 10 valves)', TRUE, 1001, 1001, 1001, 1001),

    -- VRC-JSW-STEEL-2026: RM-CR-COIL-2MM (Item 1002, TON 1002)
    (1006, 1003, 1002, 1002, 1.000, 19.999, 64000.0000, 0.00, 64000.0000, 10, 'Single Coil Procurement (< 20 Tons)', TRUE, 1001, 1001, 1001, 1001),
    (1007, 1003, 1002, 1002, 20.000, NULL, 64000.0000, 3.50, 61760.0000, 12, 'Truckload / Rail Rake Lot (>= 20 Tons)', TRUE, 1001, 1001, 1001, 1001),

    -- VRC-SANDVIK-TOOL-2026: MRO-CNMG-120408 (Item 1011, NOS 1003)
    (1008, 1004, 1011, 1003, 10.000, 49.000, 240.0000, 0.00, 240.0000, 2, 'Standard Pack of 10 Inserts', TRUE, 1001, 1001, 1001, 1001),
    (1009, 1004, 1011, 1003, 50.000, 199.000, 240.0000, 7.50, 222.0000, 3, 'Quarterly Replenishment Pack (50 - 199 inserts)', TRUE, 1001, 1001, 1001, 1001),
    (1010, 1004, 1011, 1003, 200.000, NULL, 240.0000, 12.00, 211.2000, 5, 'Annual Plant Blanket Pack (>= 200 inserts)', TRUE, 1001, 1001, 1001, 1001),

    -- JWC-PREC-HEAT-2026: WIP-VALVE-BODY-MCH (Item 1005, NOS 1003)
    (1011, 1005, 1005, 1003, 1.000, NULL, 450.0000, 0.00, 450.0000, 3, 'Precision CNC Turning + Induction Hardening per casting', TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (price_list_item_id) DO NOTHING;

SELECT setval('seq_price_list_item_id', GREATEST((SELECT COALESCE(MAX(price_list_item_id), 1011) FROM tbl_crm_price_list_item), 1011));

-- Party & Price List Association Mapping (tbl_crm_party_price_list)
INSERT INTO tbl_crm_party_price_list (
    party_price_list_id, party_id, price_list_id, is_primary, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1001, TRUE, TRUE, 1001, 1001, 1001, 1001), -- Maruti -> PL-OEM-MARUTI-2026
    (1002, 1002, 1002, TRUE, TRUE, 1001, 1001, 1001, 1001), -- L&T Valves -> PL-VALVES-STD-2026
    (1003, 1003, 1003, TRUE, TRUE, 1001, 1001, 1001, 1001), -- JSW Steel -> VRC-JSW-STEEL-2026
    (1004, 1004, 1004, TRUE, TRUE, 1001, 1001, 1001, 1001), -- Sandvik Coromant -> VRC-SANDVIK-TOOL-2026
    (1005, 1005, 1005, TRUE, TRUE, 1001, 1001, 1001, 1001)  -- Micro Precision -> JWC-PREC-HEAT-2026
ON CONFLICT (party_id, price_list_id) DO NOTHING;

SELECT setval('seq_party_price_list_id', GREATEST((SELECT COALESCE(MAX(party_price_list_id), 1005) FROM tbl_crm_party_price_list), 1005));


-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 5.1 - Sample Material Purchase Requisitions (MR) & Items
--          (tbl_pr_header, tbl_pr_item)
-- ============================================================================
INSERT INTO tbl_pr_header (
    pr_id, pr_no, pr_date, required_by_date, department_id, requester_user_id,
    warehouse_id, priority, pr_type, status, total_estimated_amount,
    purpose, approval_remarks, approved_by, approved_date, rejected_by, rejected_date, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'PR-AHM-2627-0001', '2026-04-10', '2026-04-20', 1002, 1001,
     1001, 'HIGH', 'RAW_MATERIAL', 'APPROVED', 182500.00,
     'Urgent replenishment of SS-316 round bar stock for API 600 gate valve body machining batch',
     'Approved for full quantity; standard order lead time applies', 1001, '2026-04-11 10:30:00+05:30', NULL, NULL, TRUE,
     1001, 1001, 1001, 1001),

    (1002, 'PR-AHM-2627-0002', '2026-04-15', '2026-04-22', 1002, 1001,
     1001, 'CRITICAL_URGENT', 'TOOLING_SPARE', 'SUBMITTED', 46000.00,
     'Critical line-side CNC turning inserts stock depleted below safety threshold for line #3',
     NULL, NULL, NULL, NULL, NULL, TRUE,
     1001, 1001, 1001, 1001),

    (1003, 'PR-RJK-2627-0003', '2026-04-12', '2026-05-01', 1004, 1001,
     1006, 'MEDIUM', 'RAW_MATERIAL', 'APPROVED', 650000.00,
     'Foundry raw material prime CR steel coil blanket stock for Q1 production run',
     'Verified against JSW annual rate contract', 1001, '2026-04-13 14:15:00+05:30', NULL, NULL, TRUE,
     1001, 1002, 1001, 1001),

    (1004, 'PR-AHM-2627-0004', '2026-04-16', '2026-04-28', 1002, 1001,
     1001, 'LOW', 'CONSUMABLE_MRO', 'DRAFT', 70000.00,
     'Semi-annual coolant concentrate top-up for 5-axis CNC machining bays',
     NULL, NULL, NULL, NULL, NULL, TRUE,
     1001, 1001, 1001, 1001),

    (1005, 'PR-PNQ-2627-0005', '2026-04-05', '2026-04-15', 1003, 1001,
     1007, 'MEDIUM', 'RAW_MATERIAL', 'REJECTED', 132000.00,
     'Polypropylene injection molding polymer stock',
     'Existing stock in WH-PNQ-RM01 is sufficient for next 45 days. Re-requisition next month.', NULL, NULL, 1001, '2026-04-06 09:45:00+05:30', TRUE,
     1002, 1005, 1001, 1001)
ON CONFLICT (pr_id) DO NOTHING;

SELECT setval('seq_pr_id', GREATEST((SELECT COALESCE(MAX(pr_id), 1005) FROM tbl_pr_header), 1005));

-- Purchase Requisition Line Items (tbl_pr_item)
INSERT INTO tbl_pr_item (
    pr_item_id, pr_id, item_id, uom_id, required_qty, approved_qty, ordered_qty,
    estimated_rate, estimated_amount, suggested_vendor_id, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1001, 1001, 500.000, 500.000, 0.000,
     365.0000, 182500.00, 1003, 'SS-316 50mm dia for gate valve stem & bonnet', TRUE,
     1001, 1001, 1001, 1001),

    (1002, 1002, 1011, 1003, 200.000, 0.000, 0.000,
     230.0000, 46000.00, 1004, 'Sandvik CNMG 120408 inserts for tough turning', TRUE,
     1001, 1001, 1001, 1001),

    (1003, 1003, 1002, 1002, 10.000, 10.000, 0.000,
     65000.0000, 650000.00, 1003, '2.00mm CR Prime Coils under annual rate agreement', TRUE,
     1001, 1002, 1001, 1001),

    (1004, 1004, 1010, 1007, 400.000, 0.000, 0.000,
     175.0000, 70000.00, NULL, 'Biostable synthetic cutting fluid concentrate', TRUE,
     1001, 1001, 1001, 1001),

    (1005, 1005, 1004, 1001, 1000.000, 0.000, 0.000,
     132.0000, 132000.00, NULL, 'Injection molding grade PP copolymer granules', TRUE,
     1002, 1005, 1001, 1001)
ON CONFLICT (pr_item_id) DO NOTHING;

SELECT setval('seq_pr_item_id', GREATEST((SELECT COALESCE(MAX(pr_item_id), 1005) FROM tbl_pr_item), 1005));

-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 5.2 - Supplier Request for Quotation (RFQ) & CS Sample Demo Data
-- ============================================================================

-- 1. RFQ Headers
INSERT INTO tbl_rfq_header (
    rfq_id, rfq_no, rfq_date, due_date, warehouse_id, status,
    payment_terms, delivery_terms, remarks,
    awarded_vendor_id, awarded_date, awarded_remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'RFQ-AHM-2627-0001', '2026-04-12', '2026-04-20', 1001, 'AWARDED',
     '30 Days Net from GRN', 'FOR Ahmedabad Plant', 'Inward SS316 Round Bars for Valve Stem batch manufacturing',
     1003, '2026-04-21 14:30:00+05:30', 'Selected L1 bidder with verified mill test certificate and 7-day delivery.', TRUE,
     1001, 1001, 1001, 1001),
    (1002, 'RFQ-AHM-2627-0002', '2026-04-14', '2026-04-25', 1002, 'COMPARISON_DONE',
     'Immediate Against Invoice', 'Ex-Works Supplier Store', 'Precision Tooling & CNC coolant fluid replenishment',
     NULL, NULL, NULL, TRUE,
     1001, 1001, 1001, 1001),
    (1003, 'RFQ-RJK-2627-0003', '2026-04-16', '2026-04-28', 1001, 'QUOTES_RECEIVED',
     '45 Days LC at Sight', 'FOR Rajkot Unit', 'Cold-rolled coil procurement against approved PR-RJK-2627-0003',
     NULL, NULL, NULL, TRUE,
     1001, 1001, 1001, 1001),
    (1004, 'RFQ-AHM-2627-0004', '2026-04-17', '2026-05-02', 1001, 'SENT',
     '30 Days Net', 'Door Delivery', 'HPDC Aluminum Ingot LM24 bulk tender inquiry',
     NULL, NULL, NULL, TRUE,
     1001, 1001, 1001, 1001),
    (1005, 'RFQ-AHM-2627-0005', '2026-04-18', '2026-05-10', 1001, 'DRAFT',
     '30 Days Net', 'FOR Ahmedabad Plant', 'Polypropylene granules buffer stock indents',
     NULL, NULL, NULL, TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (rfq_id) DO NOTHING;

SELECT setval('seq_rfq_id', GREATEST((SELECT COALESCE(MAX(rfq_id), 1005) FROM tbl_rfq_header), 1005));

-- 2. RFQ Line Items
INSERT INTO tbl_rfq_item (
    rfq_item_id, rfq_id, pr_item_id, item_id, uom_id, required_qty, target_rate,
    technical_specs, is_active, comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1001, 1001, 1001, 500.000, 365.0000, 'ASTM A276 Grade 316 Annealed & Cold Drawn Dia 50mm (+0/-0.05mm)', TRUE, 1001, 1001, 1001, 1001),
    (1002, 1002, 1004, 1010, 1007, 400.000, 175.0000, 'Fully synthetic high lubricity fluid for CNC hard metal machining', TRUE, 1001, 1001, 1001, 1001),
    (1003, 1003, 1003, 1002, 1001,  10.000, 65000.0000, 'IS 513 CR2 Deep Drawing Grade Cold Rolled Precision Steel Coil 1.2mm x 1250mm', TRUE, 1001, 1001, 1001, 1001),
    (1004, 1004, NULL, 1003, 1001, 2000.000, 210.0000, 'IS 617 LM24 High Pressure Die Casting Aluminum Ingot with spectro test cert', TRUE, 1001, 1001, 1001, 1001),
    (1005, 1005, NULL, 1004, 1001, 1500.000, 102.5000, 'Injection Molding Grade PP Copolymer Natural Granules MFI 12', TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (rfq_item_id) DO NOTHING;

SELECT setval('seq_rfq_item_id', GREATEST((SELECT COALESCE(MAX(rfq_item_id), 1005) FROM tbl_rfq_item), 1005));

-- 3. RFQ Invited Vendors
INSERT INTO tbl_rfq_vendor (
    rfq_vendor_id, rfq_id, party_id, invitation_date, status,
    vendor_quote_ref, quote_date, total_quote_amount, payment_terms,
    delivery_lead_time_days, vendor_remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- RFQ 1001: JSW Steel (Quoted & Selected) and Sandvik Coromant (Quoted)
    (1001, 1001, 1003, '2026-04-12 10:00:00+05:30', 'SELECTED',
     'JSW-QT-2026-4410', '2026-04-16', 205261.00, '30 Days Net', 7, 'Offered direct from Tarapur stockyard.', TRUE,
     1001, 1001, 1001, 1001),
    (1002, 1001, 1004, '2026-04-12 10:00:00+05:30', 'QUOTED',
     'SVK-INQ-0992', '2026-04-18', 221250.00, '15 Days Net', 14, 'Imported European bar stock.', TRUE,
     1001, 1001, 1001, 1001),
    -- RFQ 1002: Sandvik Coromant (Quoted) and Micro Precision (Quoted)
    (1003, 1002, 1004, '2026-04-14 11:30:00+05:30', 'QUOTED',
     'SVK-FL-8812', '2026-04-18', 77880.00, '30 Days Net', 5, 'Specialized coolant batch for alloy steel.', TRUE,
     1001, 1001, 1001, 1001),
    (1004, 1002, 1005, '2026-04-14 11:30:00+05:30', 'QUOTED',
     'MP-QT-7721', '2026-04-20', 82600.00, 'Immediate', 10, 'Standard hydraulic coolant blend.', TRUE,
     1001, 1001, 1001, 1001),
    -- RFQ 1003: JSW Steel (Quoted) and Sandvik Coromant (Invited)
    (1005, 1003, 1003, '2026-04-16 09:15:00+05:30', 'QUOTED',
     'JSW-CR-9921', '2026-04-22', 743400.00, '45 Days LC', 12, 'Includes mill test certificate.', TRUE,
     1001, 1001, 1001, 1001),
    (1006, 1003, 1004, '2026-04-16 09:15:00+05:30', 'INVITED',
     NULL, NULL, 0.00, NULL, 0, NULL, TRUE,
     1001, 1001, 1001, 1001),
    -- RFQ 1004: JSW Steel and Micro Precision (Invited)
    (1007, 1004, 1003, '2026-04-17 14:00:00+05:30', 'INVITED',
     NULL, NULL, 0.00, NULL, 0, NULL, TRUE,
     1001, 1001, 1001, 1001),
    (1008, 1004, 1005, '2026-04-17 14:00:00+05:30', 'INVITED',
     NULL, NULL, 0.00, NULL, 0, NULL, TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (rfq_vendor_id) DO NOTHING;

SELECT setval('seq_rfq_vendor_id', GREATEST((SELECT COALESCE(MAX(rfq_vendor_id), 1008) FROM tbl_rfq_vendor), 1008));

-- 4. RFQ Vendor Item Quotations (For Comparative Statement)
INSERT INTO tbl_rfq_vendor_item (
    rfq_vendor_item_id, rfq_vendor_id, rfq_item_id, offered_qty, quoted_rate,
    discount_pct, net_rate, tax_pct, total_amount, is_l1, is_awarded,
    remarks, is_active, comp_id, branch_id, fyear_id, created_by
) VALUES
    -- RFQ 1001 / Item 1001: JSW Steel (L1, Awarded) vs Sandvik Coromant (L2)
    (1001, 1001, 1001, 500.000, 355.0000, 2.00, 347.9000, 18.00, 205261.00, TRUE,  TRUE,  'L1 Lowest Quoted Rate with 2% volume cash discount.', TRUE, 1001, 1001, 1001, 1001),
    (1002, 1002, 1001, 500.000, 375.0000, 0.00, 375.0000, 18.00, 221250.00, FALSE, FALSE, 'L2 Quote - Higher base price and longer lead time.',   TRUE, 1001, 1001, 1001, 1001),
    -- RFQ 1002 / Item 1002: Sandvik Coromant (L1) vs Micro Precision (L2)
    (1003, 1003, 1002, 400.000, 165.0000, 0.00, 165.0000, 18.00,  77880.00, TRUE,  FALSE, 'L1 Preferred OEM cutting lubricant.',                TRUE, 1001, 1001, 1001, 1001),
    (1004, 1004, 1002, 400.000, 175.0000, 0.00, 175.0000, 18.00,  82600.00, FALSE, FALSE, 'L2 Standard hydraulic fluid option.',                TRUE, 1001, 1001, 1001, 1001),
    -- RFQ 1003 / Item 1003: JSW Steel (Only quote received so far)
    (1005, 1005, 1003,  10.000, 63000.0000, 0.00, 63000.0000, 18.00, 743400.00, TRUE, FALSE, 'Direct mill quote per metric ton.',                TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (rfq_vendor_item_id) DO NOTHING;

SELECT setval('seq_rfq_vendor_item_id', GREATEST((SELECT COALESCE(MAX(rfq_vendor_item_id), 1005) FROM tbl_rfq_vendor_item), 1005));

-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 5.3 - Purchase Order (PO) Management & Release Sample Demo Data
-- ============================================================================

-- 1. PO Headers
INSERT INTO tbl_po_header (
    po_id, po_no, po_date, delivery_due_date, vendor_id, vendor_address_id, warehouse_id,
    rfq_id, pr_id, po_type, status, payment_terms, delivery_terms, freight_terms,
    subtotal_amount, discount_amount, tax_amount, roundoff_amount, net_total_amount,
    notes, approved_by, approved_date, released_by, released_date, cancellation_reason, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'PO-AHM-2627-0001', '2026-04-22', '2026-04-30', 1003, NULL, 1001,
     1001, 1001, 'STANDARD_PO', 'RELEASED', '30 Days Net from GRN', 'FOR Destination Plant', 'Paid by Vendor',
     177500.00, 3550.00, 31311.00, 0.00, 205261.00,
     'Order issued against awarded RFQ-AHM-2627-0001 and approved indent PR-AHM-2627-0001. Chemical & physical test certificates mandatory.',
     1001, '2026-04-22 09:30:00+05:30', 1001, '2026-04-22 10:15:00+05:30', NULL, TRUE,
     1001, 1001, 1001, 1001),
    (1002, 'PO-AHM-2627-0002', '2026-04-21', '2026-04-28', 1004, NULL, 1002,
     1002, NULL, 'STANDARD_PO', 'APPROVED', 'Immediate Against Invoice', 'Ex-Works Supplier Store', 'Extra at actuals',
     66000.00, 0.00, 11880.00, 0.00, 77880.00,
     'Synthetic cutting fluid replenishment. Batch COA inspection required prior to unloading.',
     1001, '2026-04-21 16:00:00+05:30', NULL, NULL, NULL, TRUE,
     1001, 1001, 1001, 1001),
    (1003, 'PO-RJK-2627-0003', '2026-04-23', '2026-05-05', 1005, NULL, 1001,
     NULL, NULL, 'JOB_WORK_PO', 'SUBMITTED', '15 Days Net from Delivery', 'Door Delivery', 'Included in Job Rate',
     125000.00, 0.00, 22500.00, 0.00, 147500.00,
     'Subcontracting CNC machining and induction hardening of valve body castings.',
     NULL, NULL, NULL, NULL, NULL, TRUE,
     1001, 1001, 1001, 1001),
    (1004, 'PO-AHM-2627-0004', '2026-04-24', '2026-05-15', 1003, NULL, 1001,
     NULL, NULL, 'STANDARD_PO', 'DRAFT', '30 Days Net', 'FOR Ahmedabad Plant', 'Included',
     162500.00, 2437.50, 28811.25, -0.75, 188873.00,
     'Direct contract order under master vendor rate contract VRC-JSW-STEEL-2026.',
     NULL, NULL, NULL, NULL, NULL, TRUE,
     1001, 1001, 1001, 1001),
    (1005, 'PO-PNQ-2627-0005', '2026-04-10', '2026-05-01', 1004, NULL, 1003,
     NULL, NULL, 'BLANKET_PO', 'PARTIALLY_RECEIVED', '45 Days LC at Sight', 'FOR Pune Plant', 'Paid by Vendor',
     270000.00, 0.00, 48600.00, 0.00, 318600.00,
     'Blanket purchase contract for high pressure die casting ingots with scheduled monthly deliveries.',
     1001, '2026-04-10 10:00:00+05:30', 1001, '2026-04-10 11:00:00+05:30', NULL, TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (po_id) DO NOTHING;

SELECT setval('seq_po_id', GREATEST((SELECT COALESCE(MAX(po_id), 1005) FROM tbl_po_header), 1005));

-- 2. PO Line Items
INSERT INTO tbl_po_item (
    po_item_id, po_id, pr_item_id, rfq_item_id, item_id, uom_id,
    order_qty, unit_rate, discount_pct, discount_amount, tax_pct, tax_amount, net_amount,
    received_qty, billed_qty, delivery_date, technical_specs, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1001, 1001, 1001, 1001,
     500.000, 355.0000, 2.00, 3550.00, 18.00, 31311.00, 205261.00,
     0.000, 0.000, '2026-04-30', 'ASTM A276 Grade 316 Annealed & Cold Drawn Dia 50mm (+0/-0.05mm)', TRUE,
     1001, 1001, 1001, 1001),
    (1002, 1002, NULL, 1002, 1010, 1007,
     400.000, 165.0000, 0.00, 0.00, 18.00, 11880.00, 77880.00,
     0.000, 0.000, '2026-04-28', 'Fully synthetic high lubricity fluid for CNC hard metal machining', TRUE,
     1001, 1001, 1001, 1001),
    (1003, 1003, NULL, NULL, 1005, 1003,
     250.000, 500.0000, 0.00, 0.00, 18.00, 22500.00, 147500.00,
     0.000, 0.000, '2026-05-05', 'Machining & induction hardening to 52 HRC per drawing DWG-VLV-50-B', TRUE,
     1001, 1001, 1001, 1001),
    (1004, 1004, NULL, NULL, 1002, 1001,
      2.500, 65000.0000, 1.50, 2437.50, 18.00, 28811.25, 188873.00,
     0.000, 0.000, '2026-05-15', 'IS 513 CR2 Deep Drawing Grade Cold Rolled Precision Steel Coil 1.2mm x 1250mm', TRUE,
     1001, 1001, 1001, 1001),
    (1005, 1005, NULL, NULL, 1003, 1001,
     1200.000, 225.0000, 0.00, 0.00, 18.00, 48600.00, 318600.00,
     600.000, 0.000, '2026-05-01', 'IS 617 LM24 High Pressure Die Casting Aluminum Ingot with spectro test cert', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (po_item_id) DO NOTHING;

SELECT setval('seq_po_item_id', GREATEST((SELECT COALESCE(MAX(po_item_id), 1005) FROM tbl_po_item), 1005));

-- Synchronize ordered_qty on tbl_pr_item for PO 1001
UPDATE tbl_pr_item
SET ordered_qty = 500.000
WHERE pr_item_id = 1001;

-- ============================================================================
-- FEATURE: Step 5.4 - Gate Entry & Security Inward Register Demo Data
-- ============================================================================

-- 1. Gate Inward Headers
INSERT INTO tbl_gate_inward_header (
    gate_inward_id, gate_inward_no, inward_date, inward_time, warehouse_id, vendor_id, po_id,
    challan_no, challan_date, vehicle_no, transporter_name, driver_name, driver_phone,
    eway_bill_no, lr_no, lr_date, gross_weight, tare_weight, net_weight, total_packages,
    status, security_remarks, unloaded_date, unloaded_by, unloading_remarks,
    exit_date, exit_remarks, cancel_reason, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'GIN-AHM-2627-0001', '2026-04-24', '09:45 AM', 1001, 1003, 1001,
     'CH-JSW-2026-0891', '2026-04-23', 'GJ-01-BX-4421', 'Gujarat Roadlines Logistics', 'Rameshwar Yadav', '+91 98250 11223',
     '241829304912', 'LR-GRL-8891', '2026-04-23', 8450.000, 4200.000, 4250.000, 25,
     'INWARDED', 'Vehicle arrived at Gate 1. Initial weighbridge gross weight logged. Mill test cert attached with driver.', NULL, NULL, NULL,
     NULL, NULL, NULL, TRUE,
     1001, 1001, 1001, 1001),
    (1002, 'GIN-AHM-2627-0002', '2026-04-24', '11:15 AM', 1002, 1004, 1002,
     'INV-BPCL-6621', '2026-04-23', 'GJ-06-ZZ-7812', 'Western Express Transport', 'Sukhwinder Singh', '+91 97120 44556',
     '241829304955', 'LR-WET-1022', '2026-04-23', 4500.000, 4100.000, 400.000, 2,
     'UNLOADED', '2 Barrels of 200L cutting fluid. Unloaded at Chemical Store Bay 3.', '2026-04-24 12:30:00+05:30', 1001, 'Barrels placed on spill containment pallets.',
     NULL, NULL, NULL, TRUE,
     1001, 1001, 1001, 1001),
    (1003, 'GIN-AHM-2627-0003', '2026-04-23', '14:20 PM', 1001, 1005, 1003,
     'JW-DC-2026-0112', '2026-04-23', 'GJ-03-TC-5511', 'Saurashtra Freight Carriers', 'Kiritbhai Patel', '+91 99042 33441',
     '241829305101', 'LR-SFC-4491', '2026-04-23', 3800.000, 2550.000, 1250.000, 10,
     'GRN_PENDING', 'Subcontracting job-work inward. Offloaded at receiving inspection hold bay.', '2026-04-23 15:00:00+05:30', 1001, 'Hardness test samples taken by QA.',
     NULL, NULL, NULL, TRUE,
     1001, 1001, 1001, 1001),
    (1004, 'GIN-PNQ-2627-0004', '2026-04-22', '08:30 AM', 1003, 1004, 1005,
     'CH-VED-9921', '2026-04-21', 'MH-12-PQ-9081', 'Maharashtra Express Freight', 'Dnyaneshwar Shinde', '+91 98220 77881',
     '271928301122', 'LR-MEF-9901', '2026-04-21', 12500.000, 11900.000, 600.000, 30,
     'COMPLETED', 'Aluminum ingots consignment completed. GRN issued and truck cleared security exit.', '2026-04-22 10:00:00+05:30', 1001, 'All 30 bundles stacked in Foundry raw material yard.',
     '2026-04-22 17:45:00+05:30', 'Security outward clearance verified with Stores stamp.', NULL, TRUE,
     1001, 1001, 1001, 1001),
    (1005, 'GIN-AHM-2627-0005', '2026-04-21', '16:45 PM', 1001, 1005, NULL,
     'CH-SRT-0441', '2026-04-21', 'GJ-01-KL-9122', 'Direct Supplier Transport', 'Mahesh Solanki', '+91 98790 66551',
     NULL, NULL, NULL, 1200.000, 1200.000, 0.000, 4,
     'CANCELLED', 'Entry voided. Delivery challan addressed to wrong plant unit.', NULL, NULL, NULL,
     NULL, NULL, 'Challan addressed to Plant 2 instead of Plant 1. Vehicle turned back without offloading.', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (gate_inward_id) DO NOTHING;

SELECT setval('seq_gate_inward_id', GREATEST((SELECT COALESCE(MAX(gate_inward_id), 1005) FROM tbl_gate_inward_header), 1005));

-- 2. Gate Inward Consignment Items
INSERT INTO tbl_gate_inward_item (
    gate_inward_item_id, gate_inward_id, po_item_id, item_id, item_description, uom_id,
    challan_qty, package_count, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1001, 1001, 'SS-316 Round Bar Dia 50mm x 6000mm length', 1001,
     500.000, 25, 'Bundle tags verified with delivery challan', TRUE,
     1001, 1001, 1001, 1001),
    (1002, 1002, 1002, 1010, 'Synthetic High Pressure CNC Cutting Fluid 200L Drum', 1007,
     400.000, 2, '2 sealed steel barrels with batch numbers', TRUE,
     1001, 1001, 1001, 1001),
    (1003, 1003, 1003, 1005, 'Cast Steel Flanged Valve Body Class 150 (Hardened)', 1003,
     250.000, 10, '10 wooden crates of 25 pieces each', TRUE,
     1001, 1001, 1001, 1001),
    (1004, 1004, 1005, 1003, 'IS 617 LM24 High Pressure Die Casting Aluminum Ingot', 1001,
     600.000, 30, 'Strapped ingot bundles of 20kg each', TRUE,
     1001, 1001, 1001, 1001),
    (1005, 1005, NULL, 1004, 'Carbide Milling Insert CNMG 120408 Grade TN60', 1003,
     50.000, 4, 'Boxes intact but delivery rejected at gate', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (gate_inward_item_id) DO NOTHING;

SELECT setval('seq_gate_inward_item_id', GREATEST((SELECT COALESCE(MAX(gate_inward_item_id), 1005) FROM tbl_gate_inward_item), 1005));


-- ============================================================================
-- FEATURE: Step 5.5 - Goods Receipt Note (GRN) & Quarantine Put-Away Demo Data
-- ============================================================================

-- 1. GRN Headers
INSERT INTO tbl_inv_grn_header (
    grn_id, grn_no, grn_date, warehouse_id, vendor_id, po_id, gate_inward_id,
    challan_no, challan_date, invoice_no, invoice_date, vehicle_no,
    eway_bill_no, lr_no, lr_date, total_received_amount, status,
    store_remarks, inspected_by, inspection_date, approved_by, approval_date, approval_remarks,
    cancel_reason, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'GRN-AHM-2627-0001', '2026-04-24', 1001, 1003, 1001, 1001,
     'CH-JSW-2026-0891', '2026-04-23', 'INV-JSW-4091', '2026-04-23', 'GJ-01-BX-4421',
     '241829304912', 'LR-GRL-8891', '2026-04-23', 177500.00, 'QC_IN_PROGRESS',
     'SS-316 bars unloaded at Receiving Bay. Awaiting PMI test report and metallurgy sign-off.',
     1001, '2026-04-24 10:30:00+05:30', NULL, NULL, NULL,
     NULL, TRUE,
     1001, 1001, 1001, 1001),
    (1002, 'GRN-AHM-2627-0002', '2026-04-24', 1001, 1004, 1002, 1002,
     'INV-BPCL-6621', '2026-04-23', 'INV-BPCL-6621', '2026-04-23', 'GJ-06-ZZ-7812',
     '241829304955', 'LR-WET-1022', '2026-04-23', 66000.00, 'APPROVED',
     'Synthetic coolant drums received intact with tamper-proof seals.',
     1001, '2026-04-24 13:00:00+05:30', 1001, '2026-04-24 14:15:00+05:30', 'COA verified, viscosity and pH conform to spec.',
     NULL, TRUE,
     1001, 1001, 1001, 1001),
    (1003, 'GRN-AHM-2627-0003', '2026-04-23', 1001, 1005, 1003, 1003,
     'JW-DC-2026-0112', '2026-04-23', 'TI-RJK-2026-091', '2026-04-23', 'GJ-03-TC-5511',
     '241829305101', 'LR-SFC-4491', '2026-04-23', 125000.00, 'SUBMITTED',
     'Job-work valve bodies received from heat treatment and machining vendor.',
     NULL, NULL, NULL, NULL, NULL,
     NULL, TRUE,
     1001, 1001, 1001, 1001),
    (1004, 'GRN-PNQ-2627-0004', '2026-04-22', 1007, 1004, 1005, 1004,
     'CH-VED-9921', '2026-04-21', 'INV-VED-8812', '2026-04-21', 'MH-12-PQ-9081',
     '271928301122', 'LR-MEF-9901', '2026-04-21', 135000.00, 'APPROVED',
     'Consignment of 600 kg aluminum ingots received and cleared.',
     1001, '2026-04-22 11:30:00+05:30', 1001, '2026-04-22 14:00:00+05:30', 'Spectro analysis verified against LM24 spec. Fully cleared for foundry.',
     NULL, TRUE,
     1001, 1001, 1001, 1001),
    (1005, 'GRN-AHM-2627-0005', '2026-04-25', 1001, 1003, 1004, NULL,
     'CH-DRAFT-001', '2026-04-25', NULL, NULL, 'GJ-01-AB-1234',
     NULL, NULL, NULL, 162500.00, 'DRAFT',
     'Draft receipt note for cold rolled steel coil trial batch.',
     NULL, NULL, NULL, NULL, NULL,
     NULL, TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (grn_id) DO NOTHING;

SELECT setval('seq_grn_id', GREATEST((SELECT COALESCE(MAX(grn_id), 1005) FROM tbl_inv_grn_header), 1005));

-- 2. GRN Line Items
INSERT INTO tbl_inv_grn_item (
    grn_item_id, grn_id, po_item_id, gate_inward_item_id, item_id, item_description, uom_id,
    order_qty, challan_qty, received_qty, accepted_qty, rejected_qty, quarantine_qty, shortage_qty, excess_qty,
    unit_rate, received_amount, batch_no, mfg_date, expiry_date,
    quarantine_bin_id, storage_bin_id, is_qc_required, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1001, 1001, 1001, 'SS-316 Round Bar Dia 50mm x 6000mm length', 1001,
     500.000, 500.000, 500.000, 0.000, 0.000, 500.000, 0.000, 0.000,
     355.0000, 177500.00, 'HEAT-JSW-SS316-9812', '2026-04-10', NULL,
     1005, 1001, TRUE, 'Samples drawn for spectro chemical composition check', TRUE,
     1001, 1001, 1001, 1001),
    (1002, 1002, 1002, 1002, 1010, 'Synthetic High Pressure CNC Cutting Fluid 200L Drum', 1007,
     400.000, 400.000, 400.000, 400.000, 0.000, 0.000, 0.000, 0.000,
     165.0000, 66000.00, 'BPCL-SYN-26D-04', '2026-03-25', '2028-03-24',
     NULL, 1004, FALSE, 'Accepted directly based on supplier Certificate of Analysis', TRUE,
     1001, 1001, 1001, 1001),
    (1003, 1003, 1003, 1003, 1005, 'Cast Steel Flanged Valve Body Class 150 (Hardened)', 1003,
     250.000, 250.000, 250.000, 0.000, 0.000, 250.000, 0.000, 0.000,
     500.0000, 125000.00, 'RJK-JW-26-04', '2026-04-22', NULL,
     1005, 1003, TRUE, 'Awaiting CMM dimensional inspection and hardness test', TRUE,
     1001, 1001, 1001, 1001),
    (1004, 1004, 1005, 1004, 1003, 'IS 617 LM24 High Pressure Die Casting Aluminum Ingot', 1001,
     1200.000, 600.000, 600.000, 600.000, 0.000, 0.000, 0.000, 0.000,
     225.0000, 135000.00, 'VED-LM24-B882', '2026-04-18', NULL,
     NULL, 1008, TRUE, 'Lot 1 of blanket PO accepted into foundry charge floor', TRUE,
     1001, 1001, 1001, 1001),
    (1005, 1005, 1004, NULL, 1002, 'IS 513 CR2 Deep Drawing Grade Cold Rolled Precision Steel Coil 1.2mm x 1250mm', 1001,
     2.500, 2.500, 2.500, 0.000, 0.000, 2.500, 0.000, 0.000,
     65000.0000, 162500.00, 'COIL-JSW-26A-01', '2026-04-20', NULL,
     1005, 1002, TRUE, 'Draft entry prepared before weighment slip verification', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (grn_item_id) DO NOTHING;

SELECT setval('seq_grn_item_id', GREATEST((SELECT COALESCE(MAX(grn_item_id), 1005) FROM tbl_inv_grn_item), 1005));

-- Sync Gate Inward status to GRN_PENDING or COMPLETED for inward consignments processed
UPDATE tbl_gate_inward_header
SET status = 'COMPLETED'
WHERE gate_inward_id IN (1002, 1004);


-- ============================================================================
-- FEATURE: Step 5.6 - Inward Material QC Inspection & Quarantine Clearance Demo Data
-- ============================================================================

-- 1. QC Inward Inspection Headers
INSERT INTO tbl_qc_inward_inspection_header (
    qc_id, qc_no, qc_date, grn_id, warehouse_id, vendor_id, po_id, gate_inward_id,
    sample_size, inspection_type, overall_result, inspector_id, inspection_date,
    approver_id, approval_date, remarks, deviation_reason, test_cert_no, test_cert_date,
    status, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'QC-AHM-2627-0001', '2026-04-24', 1001, 1001, 1003, 1001, 1001,
     5.000, 'INCOMING_RAW_MATERIAL', 'ACCEPTED', 1001, '2026-04-24 14:00:00+05:30',
     1001, '2026-04-24 16:30:00+05:30', 'Positive Material Identification (PMI) and optical emission spectrometry passed ASTM A276 standard.',
     NULL, 'MTC-JSW-2026-7789', '2026-04-22',
     'COMPLETED', TRUE,
     1001, 1001, 1001, 1001),
    (1002, 'QC-AHM-2627-0002', '2026-04-24', 1002, 1001, 1004, 1002, 1002,
     2.000, 'CONSUMABLE_CHEMICAL', 'ACCEPTED', 1001, '2026-04-24 13:30:00+05:30',
     1001, '2026-04-24 14:15:00+05:30', 'Emulsion stability test 5% concentration in DM water passed. pH 9.3.',
     NULL, 'COA-BPCL-SYN-911', '2026-03-25',
     'COMPLETED', TRUE,
     1001, 1001, 1001, 1001),
    (1003, 'QC-AHM-2627-0003', '2026-04-23', 1003, 1001, 1005, 1003, 1003,
     15.000, 'SUBCONTRACT_JOBWORK', 'PENDING', 1001, '2026-04-23 16:00:00+05:30',
     NULL, NULL, 'CMM dimensional inspection in progress. Initial 5 pieces show hardness 51-53 HRC.',
     NULL, 'HT-RJK-2026-041', '2026-04-22',
     'IN_PROGRESS', TRUE,
     1001, 1001, 1001, 1001),
    (1004, 'QC-PNQ-2627-0004', '2026-04-22', 1004, 1007, 1004, 1005, 1004,
     10.000, 'INCOMING_RAW_MATERIAL', 'ACCEPTED', 1001, '2026-04-22 12:30:00+05:30',
     1001, '2026-04-22 14:00:00+05:30', 'LM24 alloy composition verified. Silicon 8.6%, Copper 3.4%, Iron 0.85%.',
     NULL, 'VED-CERT-LM24-882', '2026-04-18',
     'COMPLETED', TRUE,
     1001, 1001, 1001, 1001),
    (1005, 'QC-AHM-2627-0005', '2026-04-25', 1005, 1001, 1003, 1004, NULL,
     1.000, 'INCOMING_RAW_MATERIAL', 'PENDING', NULL, NULL,
     NULL, NULL, 'Awaiting thickness gauge micrometer inspection across coil width.',
     NULL, 'MTC-JSW-CR2-441', '2026-04-20',
     'DRAFT', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (qc_id) DO NOTHING;

SELECT setval('seq_qc_inward_id', GREATEST((SELECT COALESCE(MAX(qc_id), 1005) FROM tbl_qc_inward_inspection_header), 1005));

-- 2. QC Inward Inspection Items
INSERT INTO tbl_qc_inward_inspection_item (
    qc_item_id, qc_id, grn_item_id, item_id, uom_id,
    received_qty, sample_qty, accepted_qty, rejected_qty, disposition,
    defect_code, batch_no, heat_no, mfg_date, expiry_date,
    quarantine_bin_id, destination_bin_id,
    visual_check, dimension_check, chemical_test, hardness_test,
    observed_parameters, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1001, 1001, 1001,
     500.000, 5.000, 500.000, 0.000, 'ACCEPTED',
     NULL, 'HEAT-JSW-SS316-9812', 'MELT-9812-C', '2026-04-10', NULL,
     1005, 1001,
     'PASS', 'PASS', 'PASS', 'PASS',
     '{"carbon_pct": 0.045, "chromium_pct": 16.82, "nickel_pct": 10.25, "molybdenum_pct": 2.15, "hardness_hrb": 88.5, "diameter_mm": 50.02}'::jsonb,
     'All 5 samples within dia 50mm (+0/-0.05mm) tolerance and chemistry meets SS316.', TRUE,
     1001, 1001, 1001, 1001),
    (1002, 1002, 1002, 1010, 1007,
     400.000, 2.000, 400.000, 0.000, 'ACCEPTED',
     NULL, 'BPCL-SYN-26D-04', NULL, '2026-03-25', '2028-03-24',
     NULL, 1004,
     'PASS', 'NA', 'PASS', 'NA',
     '{"ph_level": 9.3, "brix_pct": 5.2, "refractometer_factor": 1.05}'::jsonb,
     'Viscosity and concentration conform to CNC hard milling specification.', TRUE,
     1001, 1001, 1001, 1001),
    (1003, 1003, 1003, 1005, 1003,
     250.000, 15.000, 0.000, 0.000, 'ACCEPTED',
     NULL, 'RJK-JW-26-04', 'CAST-LOT-551', '2026-04-22', NULL,
     1005, 1003,
     'PASS', 'PASS', 'NA', 'PASS',
     '{"hardness_hrc": 52.1, "flange_thickness_mm": 18.02, "bore_dia_mm": 50.81}'::jsonb,
     'Initial 5 pieces pass CMM; remaining 10 undergoing ultrasonic porosity scan.', TRUE,
     1001, 1001, 1001, 1001),
    (1004, 1004, 1004, 1003, 1001,
     600.000, 10.000, 600.000, 0.000, 'ACCEPTED',
     NULL, 'VED-LM24-B882', 'HPDC-M901', '2026-04-18', NULL,
     NULL, 1008,
     'PASS', 'PASS', 'PASS', 'PASS',
     '{"silicon_pct": 8.62, "copper_pct": 3.41, "iron_pct": 0.85, "zinc_pct": 0.92, "magnesium_pct": 0.28}'::jsonb,
     'Cleared for foundry charge floor. Low iron content within HPDC limit.', TRUE,
     1001, 1001, 1001, 1001),
    (1005, 1005, 1005, 1002, 1001,
     2.500, 1.000, 0.000, 0.000, 'ACCEPTED',
     NULL, 'COIL-JSW-26A-01', 'CR-MELT-1022', '2026-04-20', NULL,
     1005, 1002,
     'PASS', 'PASS', 'PASS', 'NA',
     '{"thickness_mm": 1.204, "width_mm": 1250.2, "yield_strength_mpa": 245}'::jsonb,
     'Draft inspection record created upon offloading.', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (qc_item_id) DO NOTHING;

SELECT setval('seq_qc_inward_item_id', GREATEST((SELECT COALESCE(MAX(qc_item_id), 1005) FROM tbl_qc_inward_inspection_item), 1005));


-- ============================================================================
-- FEATURE: Step 5.7 - Warehouse Bin Put-Away & Stock Allocation Demo Data
-- ============================================================================
INSERT INTO tbl_inv_putaway_header (
    putaway_id, comp_id, branch_id, fyear_id,
    putaway_no, putaway_date, warehouse_id, grn_id, qc_id,
    assigned_to, putaway_type, status,
    total_items, total_qty, completed_date, completed_by,
    remarks, is_active, created_by
) VALUES
    (1001, 1001, 1001, 1001,
     'PUT-AHM-2627-0001', '2026-04-18', 1001, 1001, 1001,
     1003, 'QC_RELEASE', 'COMPLETED',
     1, 500.000, '2026-04-18 16:30:00+05:30', 1003,
     'Moved from QC quarantine cage to heavy cantilever bar rack RM-Z1-R01-S01-B01.', TRUE, 1001),
    (1002, 1001, 1001, 1001,
     'PUT-AHM-2627-0002', '2026-04-19', 1001, 1002, 1002,
     1003, 'QC_RELEASE', 'COMPLETED',
     1, 4.000, '2026-04-19 14:15:00+05:30', 1003,
     'Cutting oil drums transferred to Chemical Ground Bay CHEM-Z2-R01-S01-B01 on spill containment pallet.', TRUE, 1001),
    (1003, 1001, 1001, 1001,
     'PUT-AHM-2627-0003', '2026-04-20', 1001, 1004, 1004,
     1003, 'QC_RELEASE', 'IN_PROGRESS',
     1, 600.000, NULL, NULL,
     'Forklift operator transferring Aluminum ingots to Foundry charge bay.', TRUE, 1001),
    (1004, 1001, 1001, 1001,
     'PUT-AHM-2627-0004', '2026-04-21', 1001, 1003, 1003,
     1003, 'GRN_INWARD', 'ASSIGNED',
     1, 250.000, NULL, NULL,
     'Subcontracted valve bodies assigned for put-away pending final QC ultrasonic clearance.', TRUE, 1001),
    (1005, 1001, 1001, 1001,
     'PUT-AHM-2627-0005', '2026-04-22', 1001, 1005, 1005,
     1003, 'GRN_INWARD', 'DRAFT',
     1, 2.500, NULL, NULL,
     'CRCA steel coils staged at receiving dock pending crane allocation.', TRUE, 1001)
ON CONFLICT (putaway_id) DO NOTHING;

SELECT setval('seq_putaway_id', GREATEST((SELECT COALESCE(MAX(putaway_id), 1005) FROM tbl_inv_putaway_header), 1005));

INSERT INTO tbl_inv_putaway_item (
    putaway_item_id, putaway_id, grn_item_id, qc_item_id,
    item_id, item_description, uom_id,
    source_bin_id, destination_bin_id,
    allocated_qty, putaway_qty, batch_no, heat_no,
    status, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1001, 1001,
     1001, 'Stainless Steel 316 Round Bar Ø50mm', 1001,
     1003, 1001,
     500.000, 500.000, 'HEAT-JSW-SS316-9812', 'MELT-8821',
     'COMPLETED', 'Put-away completed into cantilever rack A1.', TRUE,
     1001, 1001, 1001, 1001),
    (1002, 1002, 1002, 1002,
     1002, 'Industrial Semi-Synthetic Cutting Coolant 200L Drum', 1002,
     1003, 1004,
     4.000, 4.000, 'CAST-SYN-2026-B04', NULL,
     'COMPLETED', 'Placed on bunded pallet bay.', TRUE,
     1001, 1001, 1001, 1001),
    (1003, 1003, 1004, 1004,
     1004, 'Aluminum Alloy Ingot LM6 (High Silicon Grade)', 1001,
     1003, 1006,
     600.000, 300.000, 'VED-LM24-B882', 'HPDC-M901',
     'PENDING', 'Partial transfer of 300kg completed; balance in progress.', TRUE,
     1001, 1001, 1001, 1001),
    (1004, 1004, 1003, 1003,
     1003, 'Machined Stainless Steel 3-Way Valve Body Castings', 1003,
     1003, 1005,
     250.000, 0.000, 'RJK-JW-26-04', 'CAST-LOT-551',
     'PENDING', 'Staged at bin entrance.', TRUE,
     1001, 1001, 1001, 1001),
    (1005, 1005, 1005, 1005,
     1005, 'Cold Rolled Close Annealed (CRCA) Steel Coil 2.0mm', 1001,
     1003, 1002,
     2.500, 0.000, 'COIL-JSW-26A-01', 'CR-MELT-1022',
     'PENDING', 'Awaiting overhead crane transfer.', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (putaway_item_id) DO NOTHING;

SELECT setval('seq_putaway_item_id', GREATEST((SELECT COALESCE(MAX(putaway_item_id), 1005) FROM tbl_inv_putaway_item), 1005));

-- Initial Active Bin Stock Balances
INSERT INTO tbl_inv_bin_stock (
    bin_stock_id, comp_id, branch_id, fyear_id,
    warehouse_id, bin_id, item_id, uom_id,
    batch_no, heat_no,
    on_hand_qty, reserved_qty, available_qty,
    unit_cost, total_valuation, last_stock_date,
    is_active, created_by
) VALUES
    (1001, 1001, 1001, 1001,
     1001, 1001, 1001, 1001,
     'HEAT-JSW-SS316-9812', 'MELT-8821',
     500.000, 0.000, 500.000,
     320.0000, 160000.00, '2026-04-18 16:30:00+05:30',
     TRUE, 1001),
    (1002, 1001, 1001, 1001,
     1001, 1004, 1002, 1002,
     'CAST-SYN-2026-B04', NULL,
     4.000, 0.000, 4.000,
     45000.0000, 180000.00, '2026-04-19 14:15:00+05:30',
     TRUE, 1001)
ON CONFLICT (bin_stock_id) DO NOTHING;

SELECT setval('seq_bin_stock_id', GREATEST((SELECT COALESCE(MAX(bin_stock_id), 1002) FROM tbl_inv_bin_stock), 1002));

-- Immutable Stock Ledger Transactions
INSERT INTO tbl_inv_stock_ledger (
    ledger_id, comp_id, branch_id, fyear_id,
    transaction_date, transaction_type,
    reference_doc_type, reference_doc_id, reference_doc_no,
    warehouse_id, from_bin_id, to_bin_id,
    item_id, uom_id, batch_no, heat_no,
    qty_in, qty_out, unit_cost, total_cost,
    closing_balance, remarks, is_active, created_by
) VALUES
    (1001, 1001, 1001, 1001,
     '2026-04-18 16:30:00+05:30', 'PUTAWAY_INWARD',
     'PUTAWAY', 1001, 'PUT-AHM-2627-0001',
     1001, 1003, 1001,
     1001, 1001, 'HEAT-JSW-SS316-9812', 'MELT-8821',
     500.000, 0.000, 320.0000, 160000.00,
     500.000, 'Put-away confirmed from quarantine to rack RM-Z1-R01-S01-B01', TRUE, 1001),
    (1002, 1001, 1001, 1001,
     '2026-04-19 14:15:00+05:30', 'PUTAWAY_INWARD',
     'PUTAWAY', 1002, 'PUT-AHM-2627-0002',
     1001, 1003, 1004,
     1002, 1002, 'CAST-SYN-2026-B04', NULL,
     4.000, 0.000, 45000.0000, 180000.00,
     4.000, 'Put-away confirmed for 4 coolant drums into Chemical Ground Bay', TRUE, 1001)
ON CONFLICT (ledger_id) DO NOTHING;

SELECT setval('seq_stock_ledger_id', GREATEST((SELECT COALESCE(MAX(ledger_id), 1002) FROM tbl_inv_stock_ledger), 1002));


-- ============================================================================
-- FEATURE: Step 5.8 - Purchase Invoices & 3-Way Matching Demo Data
-- ============================================================================
INSERT INTO tbl_pur_invoice_header (
    invoice_id, comp_id, branch_id, fyear_id,
    invoice_no, invoice_date, vendor_id, po_id, grn_id, qc_id,
    vendor_invoice_no, vendor_invoice_date, vendor_gstin,
    payment_terms_days, due_date,
    subtotal_amount, discount_amount, taxable_amount,
    cgst_amount, sgst_amount, igst_amount, total_tax_amount,
    freight_charges, insurance_charges, packaging_charges,
    tds_rate, tds_amount, round_off,
    net_payable_amount, paid_amount, balance_amount,
    matching_status, status, payment_status,
    approved_by, approved_date, approval_remarks,
    remarks, is_active, created_by
) VALUES
    (1001, 1001, 1001, 1001,
     'PINV-AHM-2627-0001', '2026-04-18', 1001, 1001, 1001, 1001,
     'INV/JSPL/2026/0892', '2026-04-18', '24AAACJ9812A1Z4',
     30, '2026-05-18',
     160000.00, 0.00, 160000.00,
     14400.00, 14400.00, 0.00, 28800.00,
     1500.00, 0.00, 0.00,
     0.100, 160.00, 0.00,
     190140.00, 0.00, 190140.00,
     'MATCHED', 'APPROVED', 'UNPAID',
     1002, '2026-04-19 11:30:00+05:30', '3-way match verified against PO-0001 and GRN-0001. Cleared for payment.',
     'Standard commercial billing for SS316 round bars.', TRUE, 1001),

    (1002, 1001, 1001, 1001,
     'PINV-AHM-2627-0002', '2026-04-19', 1002, 1002, 1002, 1002,
     'CIL/MH/2627/4401', '2026-04-19', '27AAACC2026B1Z8',
     30, '2026-05-19',
     180000.00, 0.00, 180000.00,
     0.00, 0.00, 32400.00, 32400.00,
     0.00, 0.00, 0.00,
     0.000, 0.00, 0.00,
     212400.00, 0.00, 212400.00,
     'MATCHED', 'APPROVED', 'UNPAID',
     1002, '2026-04-20 10:15:00+05:30', 'IGST 18% interstate match confirmed. Cleared for AP disbursement.',
     'Coolant barrels delivery invoice.', TRUE, 1001),

    (1003, 1001, 1001, 1001,
     'PINV-AHM-2627-0003', '2026-04-20', 1003, 1003, 1003, 1003,
     'RPMW/JW/26-091', '2026-04-20', '24AAACR5512C1Z2',
     15, '2026-05-05',
     287500.00, 0.00, 287500.00,
     25875.00, 25875.00, 0.00, 51750.00,
     0.00, 0.00, 0.00,
     0.000, 0.00, 0.00,
     339250.00, 0.00, 339250.00,
     'MATCHED', 'SUBMITTED', 'UNPAID',
     NULL, NULL, NULL,
     'Machined valve bodies job-work invoice pending final finance review.', TRUE, 1001),

    (1004, 1001, 1001, 1001,
     'PINV-AHM-2627-0004', '2026-04-21', 1004, 1004, 1004, 1004,
     'VED/OD/2627/0119', '2026-04-21', '21AAACV9012D1Z6',
     30, '2026-05-21',
     159000.00, 0.00, 159000.00,
     0.00, 0.00, 28620.00, 28620.00,
     0.00, 0.00, 0.00,
     0.000, 0.00, 0.00,
     187620.00, 0.00, 187620.00,
     'MATCHED', 'APPROVED', 'UNPAID',
     1002, '2026-04-22 09:45:00+05:30', 'Interstate aluminium invoice approved.',
     'Aluminium alloy ingots shipment.', TRUE, 1001),

    (1005, 1001, 1001, 1001,
     'PINV-AHM-2627-0005', '2026-04-22', 1005, 1005, 1005, 1005,
     'JSW/GJ/2026/991', '2026-04-22', '24AAACJ1022E1Z0',
     30, '2026-05-22',
     156250.00, 0.00, 156250.00,
     14062.50, 14062.50, 0.00, 28125.00,
     0.00, 0.00, 0.00,
     0.000, 0.00, 0.00,
     184375.00, 0.00, 184375.00,
     'PRICE_VARIANCE', 'DRAFT', 'UNPAID',
     NULL, NULL, NULL,
     'Vendor invoiced @ 62,500/MT vs PO contracted rate of 62,000/MT. Price variance detected.', TRUE, 1001)
ON CONFLICT (invoice_id) DO NOTHING;

SELECT setval('seq_pur_invoice_id', GREATEST((SELECT COALESCE(MAX(invoice_id), 1005) FROM tbl_pur_invoice_header), 1005));

INSERT INTO tbl_pur_invoice_item (
    invoice_item_id, invoice_id, po_item_id, grn_item_id, qc_item_id,
    item_id, item_description, hsn_code, uom_id,
    po_qty, received_qty, accepted_qty, billed_qty,
    po_rate, invoiced_rate, rate_variance, item_amount,
    discount_percent, discount_amount, taxable_amount,
    gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
    igst_rate, igst_amount, total_item_amount, batch_no,
    remarks, is_active, comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1001, 1001, 1001,
     1001, 'Stainless Steel 316 Round Bar Ø50mm', '7222', 1001,
     500.000, 500.000, 500.000, 500.000,
     320.0000, 320.0000, 0.0000, 160000.00,
     0.00, 0.00, 160000.00,
     18.00, 9.00, 14400.00, 9.00, 14400.00,
     0.00, 0.00, 188800.00, 'HEAT-JSW-SS316-9812',
     'Matched 100% against PO-0001 line 1.', TRUE, 1001, 1001, 1001, 1001),

    (1002, 1002, 1002, 1002, 1002,
     1002, 'Industrial Semi-Synthetic Cutting Coolant 200L Drum', '2710', 1002,
     4.000, 4.000, 4.000, 4.000,
     45000.0000, 45000.0000, 0.0000, 180000.00,
     0.00, 0.00, 180000.00,
     18.00, 0.00, 0.00, 0.00, 0.00,
     18.00, 32400.00, 212400.00, 'CAST-SYN-2026-B04',
     'Matched 100% against PO-0002 line 1.', TRUE, 1001, 1001, 1001, 1001),

    (1003, 1003, 1003, 1003, 1003,
     1003, 'Machined Stainless Steel 3-Way Valve Body Castings', '8481', 1003,
     250.000, 250.000, 250.000, 250.000,
     1150.0000, 1150.0000, 0.0000, 287500.00,
     0.00, 0.00, 287500.00,
     18.00, 9.00, 25875.00, 9.00, 25875.00,
     0.00, 0.00, 339250.00, 'RJK-JW-26-04',
     'Matched 100% against PO-0003 line 1.', TRUE, 1001, 1001, 1001, 1001),

    (1004, 1004, 1004, 1004, 1004,
     1004, 'Aluminum Alloy Ingot LM6 (High Silicon Grade)', '7601', 1001,
     600.000, 600.000, 600.000, 600.000,
     265.0000, 265.0000, 0.0000, 159000.00,
     0.00, 0.00, 159000.00,
     18.00, 0.00, 0.00, 0.00, 0.00,
     18.00, 28620.00, 187620.00, 'VED-LM24-B882',
     'Matched 100% against PO-0004 line 1.', TRUE, 1001, 1001, 1001, 1001),

    (1005, 1005, 1005, 1005, 1005,
     1005, 'Cold Rolled Close Annealed (CRCA) Steel Coil 2.0mm', '7209', 1001,
     2.500, 2.500, 2.500, 2.500,
     62000.0000, 62500.0000, 500.0000, 156250.00,
     0.00, 0.00, 156250.00,
     18.00, 9.00, 14062.50, 9.00, 14062.50,
     0.00, 0.00, 184375.00, 'COIL-JSW-26A-01',
     'Rate variance of +500/MT detected; requires commercial approval.', TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (invoice_item_id) DO NOTHING;

SELECT setval('seq_pur_invoice_item_id', GREATEST((SELECT COALESCE(MAX(invoice_item_id), 1005) FROM tbl_pur_invoice_item), 1005));


-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 6.1 - Sample Multi-Level Bill of Materials (BOM), Scrap & Byproducts
--          (tbl_mfg_bom_header, tbl_mfg_bom_item, tbl_mfg_bom_byproduct)
-- ============================================================================

INSERT INTO tbl_mfg_bom_header (
    bom_id, comp_id, branch_id, fyear_id, bom_code, bom_name,
    item_id, uom_id, output_qty, version_no, bom_type, status,
    is_default, effective_from, effective_to,
    total_material_cost, total_labour_cost, total_overhead_cost,
    total_byproduct_recovery, net_unit_cost, approved_by, approved_date,
    approval_remarks, remarks, is_active, created_by
) VALUES
    -- 1. Sub-Assembly 1: Stamped Outer Shell (Child of 1001 & 1005)
    (1003, 1001, 1001, 1001, 'BOM-SA-STAMP-SHL-01', 'Stamped Outer Shell Sub-Assembly (V1.0)',
     1007, 1003, 20.000, '1.0', 'MANUFACTURING', 'ACTIVE',
     TRUE, '2026-04-01', NULL,
     2289.60, 600.00, 400.00,
     126.00, 158.1800, 1001, CURRENT_TIMESTAMP,
     'Approved for high-speed mechanical press line', 'Sub-assembly for hydromount powertrain', TRUE, 1001),

    -- 2. Sub-Assembly 2: Machined Valve Body (Child of 1002)
    (1004, 1001, 1001, 1001, 'BOM-SA-VLV-BODY-01', 'Machined SS-316 Gate Valve Body 2" (V1.0)',
     1005, 1003, 5.000, '1.0', 'MANUFACTURING', 'ACTIVE',
     TRUE, '2026-04-01', NULL,
     7964.40, 1500.00, 900.00,
     525.00, 1967.8800, 1001, CURRENT_TIMESTAMP,
     'CNC turning & multi-axis milling verified', 'Machined body sub-assembly', TRUE, 1001),

    -- 3. Top-Level Assembly 1: Automotive Hydromount Assembly (V1.0)
    (1001, 1001, 1001, 1001, 'BOM-FG-AUTO-MNT-01', 'Automotive Hydromount Powertrain Assembly (V1.0)',
     1009, 1003, 10.000, '1.0', 'ASSEMBLY', 'ACTIVE',
     TRUE, '2026-04-01', NULL,
     5633.25, 1200.00, 800.00,
     17.50, 761.5750, 1001, CURRENT_TIMESTAMP,
     'Production engineering baseline released', 'Primary OEM production BOM for Maruti supply', TRUE, 1001),

    -- 4. Top-Level Assembly 2: Industrial Flanged Gate Valve (V1.0)
    (1002, 1001, 1001, 1001, 'BOM-FG-VALVE-50-01', 'Industrial SS-316 Flanged Gate Valve 2" Class 150 (V1.0)',
     1008, 1003, 5.000, '1.0', 'ASSEMBLY', 'ACTIVE',
     TRUE, '2026-04-01', NULL,
     11101.00, 2500.00, 1500.00,
     168.00, 2986.6000, 1001, CURRENT_TIMESTAMP,
     'Class 150 pressure testing specifications verified', 'Heavy duty industrial process valve assembly', TRUE, 1001),

    -- 5. Next Revision: Automotive Hydromount Assembly (V2.0 - Light-Weighting)
    (1005, 1001, 1001, 1001, 'BOM-FG-AUTO-MNT-02', 'Automotive Hydromount Powertrain Assembly (V2.0 - Light-Weighting)',
     1009, 1003, 10.000, '2.0', 'ASSEMBLY', 'UNDER_REVIEW',
     FALSE, '2026-05-01', NULL,
     5622.15, 1100.00, 750.00,
     44.00, 742.8150, NULL, NULL,
     NULL, 'Engineering change request (ECR) for aluminum hybrid shell', TRUE, 1001)
ON CONFLICT (bom_id) DO NOTHING;

SELECT setval('seq_bom_id', GREATEST((SELECT COALESCE(MAX(bom_id), 1005) FROM tbl_mfg_bom_header), 1005));

-- BOM Component Line Items (tbl_mfg_bom_item)
INSERT INTO tbl_mfg_bom_item (
    bom_item_id, bom_id, item_id, item_description, uom_id,
    quantity, scrap_factor_percent, gross_quantity, child_bom_id,
    unit_cost, line_cost, source_type, operation_seq, operation_name,
    is_critical, remarks, is_active, comp_id, branch_id, fyear_id, created_by
) VALUES
    -- Items for BOM 1003 (Sub-Assembly Shell)
    (1001, 1003, 1002, 'Cold Rolled Precision Steel Coil 1.2mm x 1250mm', 1001,
     30.0000, 6.00, 31.8000, NULL,
     72.0000, 2289.60, 'PURCHASED', 10, 'Blanking & Deep Draw Stamping',
     TRUE, 'Prime CR coil sheet', TRUE, 1001, 1001, 1001, 1001),

    -- Items for BOM 1004 (Sub-Assembly Valve Body)
    (1002, 1004, 1001, 'Stainless Steel 316 Round Bar Dia 50mm', 1001,
     18.0000, 8.00, 19.4400, NULL,
     385.0000, 7484.40, 'PURCHASED', 10, 'Rough CNC Turning & Boring',
     TRUE, 'Forged bar material', TRUE, 1001, 1001, 1001, 1001),

    (1003, 1004, 1011, 'Tungsten Carbide Turning Insert CNMG 120408-PM', 1003,
     2.0000, 0.00, 2.0000, NULL,
     240.0000, 480.00, 'PURCHASED', 20, 'Precision Finish Turning',
     FALSE, 'Tooling consumable per batch', TRUE, 1001, 1001, 1001, 1001),

    -- Items for BOM 1001 (Hydromount Assembly V1.0)
    (1004, 1001, 1007, 'Stamped Sheet Metal Outer Door Panel Shell', 1003,
     10.0000, 2.00, 10.2000, 1003,
     420.0000, 4284.00, 'MANUFACTURED', 10, 'Sub-Assembly Insertion',
     TRUE, 'Multi-level manufactured sub-assembly', TRUE, 1001, 1001, 1001, 1001),

    (1005, 1001, 1004, 'Polypropylene Copolymer Granules Injection Grade', 1001,
     5.0000, 3.00, 5.1500, NULL,
     105.0000, 540.75, 'PURCHASED', 20, 'Rubber Cushion Injection Molding',
     FALSE, 'Damping elastomer', TRUE, 1001, 1001, 1001, 1001),

    (1006, 1001, 1001, 'Stainless Steel 316 Round Bar Dia 50mm', 1001,
     2.0000, 5.00, 2.1000, NULL,
     385.0000, 808.50, 'PURCHASED', 30, 'Center Pin Machining & Press Fit',
     TRUE, 'High tensile core pin', TRUE, 1001, 1001, 1001, 1001),

    -- Items for BOM 1002 (Gate Valve Assembly V1.0)
    (1007, 1002, 1005, 'Machined SS-316 Gate Valve Body Casting 2" 150#', 1003,
     5.0000, 1.00, 5.0500, 1004,
     1850.0000, 9342.50, 'MANUFACTURED', 10, 'Body & Bonnet Assembly',
     TRUE, 'Multi-level machined valve body', TRUE, 1001, 1001, 1001, 1001),

    (1008, 1002, 1001, 'Stainless Steel 316 Round Bar Dia 50mm', 1001,
     4.0000, 2.50, 4.1000, NULL,
     385.0000, 1578.50, 'PURCHASED', 20, 'Stem & Wedge Machining',
     TRUE, 'Internal trim component', TRUE, 1001, 1001, 1001, 1001),

    (1009, 1002, 1010, 'Fully Synthetic High-Pressure CNC Cutting Fluid', 1007,
     1.0000, 0.00, 1.0000, NULL,
     180.0000, 180.00, 'PURCHASED', 30, 'Hydrostatic Hydro-Testing Medium',
     FALSE, 'Testing & anti-corrosion flush', TRUE, 1001, 1001, 1001, 1001),

    -- Items for BOM 1005 (Hydromount Assembly V2.0)
    (1010, 1005, 1007, 'Stamped Sheet Metal Outer Door Panel Shell', 1003,
     10.0000, 1.50, 10.1500, 1003,
     420.0000, 4263.00, 'MANUFACTURED', 10, 'Sub-Assembly Insertion',
     TRUE, 'Multi-level manufactured sub-assembly', TRUE, 1001, 1001, 1001, 1001),

    (1011, 1005, 1003, 'HPDC Aluminum Alloy Ingot LM24', 1001,
     4.0000, 2.00, 4.0800, NULL,
     215.0000, 877.20, 'PURCHASED', 20, 'Die-Cast Lightweight Housing',
     TRUE, 'Weight reduction substitution', TRUE, 1001, 1001, 1001, 1001),

    (1012, 1005, 1004, 'Polypropylene Copolymer Granules Injection Grade', 1001,
     4.5000, 2.00, 4.5900, NULL,
     105.0000, 481.95, 'PURCHASED', 30, 'Elastomer Molding',
     FALSE, 'Optimized compound', TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (bom_item_id) DO NOTHING;

SELECT setval('seq_bom_item_id', GREATEST((SELECT COALESCE(MAX(bom_item_id), 1012) FROM tbl_mfg_bom_item), 1012));

-- BOM By-Products & Recoverable Scrap (tbl_mfg_bom_byproduct)
INSERT INTO tbl_mfg_bom_byproduct (
    bom_byproduct_id, bom_id, item_id, item_description, uom_id,
    quantity, product_type, cost_allocation_percent,
    estimated_recovery_rate, estimated_recovery_value, remarks,
    is_active, comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1003, 1002, 'Sheet Metal Stamping Skeleton & Offcuts', 1001,
     4.5000, 'RECOVERABLE_SCRAP', 0.00,
     28.0000, 126.00, 'Baled stamping scrap returned to foundry',
     TRUE, 1001, 1001, 1001, 1001),

    (1002, 1004, 1001, 'SS-316 CNC Swarf & Turning Chips', 1001,
     3.5000, 'RECOVERABLE_SCRAP', 0.00,
     150.0000, 525.00, 'Segregated high-grade alloy scrap',
     TRUE, 1001, 1001, 1001, 1001),

    (1003, 1001, 1001, 'Offcut Turning Chips', 1001,
     0.5000, 'RECOVERABLE_SCRAP', 0.00,
     35.0000, 17.50, 'Machine shop scrap',
     TRUE, 1001, 1001, 1001, 1001),

    (1004, 1002, 1001, 'SS-316 Lathe Scrap', 1001,
     1.2000, 'RECOVERABLE_SCRAP', 0.00,
     140.0000, 168.00, 'Valve stem turning scrap',
     TRUE, 1001, 1001, 1001, 1001),

    (1005, 1005, 1003, 'Aluminum Die-Cast Trimming Flash', 1001,
     0.4000, 'RECOVERABLE_SCRAP', 0.00,
     110.0000, 44.00, 'Remeltable aluminum scrap',
     TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (bom_byproduct_id) DO NOTHING;

SELECT setval('seq_bom_byproduct_id', GREATEST((SELECT COALESCE(MAX(bom_byproduct_id), 1005) FROM tbl_mfg_bom_byproduct), 1005));

-- ============================================================================
-- FEATURE: Step 6.2 - Manufacturing Work Centers, Capacity & Shifts Demo Data
-- ============================================================================

-- 1. Factory Shifts (tbl_mfg_shift)
INSERT INTO tbl_mfg_shift (
    shift_id, shift_code, shift_name, start_time, end_time,
    break_duration_mins, effective_working_hours, is_night_shift, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'SHIFT-GEN', 'General Day Shift (Admin & Assembly)', '09:00:00', '17:30:00', 30, 8.00, FALSE, 'Standard office and assembly daytime schedule', TRUE, 1001, 1001, 1001, 1001),
    (1002, 'SHIFT-M1',  'Morning Shift 1 (Production Line)',    '07:00:00', '15:30:00', 30, 8.00, FALSE, 'Shopfloor primary machining shift', TRUE, 1001, 1001, 1001, 1001),
    (1003, 'SHIFT-E1',  'Evening Shift 2 (Production Line)',    '15:30:00', '00:00:00', 30, 8.00, FALSE, 'Shopfloor secondary machining shift', TRUE, 1001, 1001, 1001, 1001),
    (1004, 'SHIFT-N1',  'Night Shift 3 (Furnace Continuous)',   '00:00:00', '07:00:00', 30, 6.50, TRUE,  'Automated heat treatment and continuous curing run', TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (shift_id) DO NOTHING;

SELECT setval('seq_shift_id', GREATEST((SELECT COALESCE(MAX(shift_id), 1004) FROM tbl_mfg_shift), 1004));

-- 2. Manufacturing Work Centers (tbl_mfg_work_center)
INSERT INTO tbl_mfg_work_center (
    work_center_id, work_center_code, work_center_name, work_center_type,
    dept_id, location_desc, capacity_per_day_hours, efficiency_percent, capacity_uom,
    cost_per_hour, labour_cost_per_hour, overhead_cost_per_hour, total_hourly_rate,
    status, remarks, is_active, comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'WC-CNC-01', 'CNC Precision Turning & Milling Cell 1', 'MACHINE',
     1001, 'Bay 1 - Heavy Machining Shopfloor', 16.00, 88.00, 'HOURS',
     400.00, 150.00, 100.00, 650.00,
     'ACTIVE', 'High-speed multi-axis turning and vertical milling center', TRUE, 1001, 1001, 1001, 1001),

    (1002, 'WC-FAB-01', 'Heavy Fabrication & Robotic TIG/MIG Welding Bay', 'MACHINE',
     1001, 'Bay 2 - Structural Fabrication Annex', 16.00, 80.00, 'HOURS',
     200.00, 140.00, 80.00, 420.00,
     'ACTIVE', 'Shielded metal arc and multi-process welding station', TRUE, 1001, 1001, 1001, 1001),

    (1003, 'WC-HT-01', 'Atmosphere Gas Carburizing & Hardening Furnace', 'FURNACE',
     1001, 'Bay 4 - Metallurgy & Heat Treatment Plant', 24.00, 92.00, 'HOURS',
     800.00, 200.00, 250.00, 1250.00,
     'ACTIVE', 'Controlled atmosphere continuous batch quench furnace', TRUE, 1001, 1001, 1001, 1001),

    (1004, 'WC-ASSY-01', 'Valve Assembly, Hydro-Testing & Packaging Line', 'LINE_ASSEMBLY',
     1001, 'Bay 3 - Final Assembly Clean Zone', 8.00, 85.00, 'HOURS',
     120.00, 150.00, 80.00, 350.00,
     'ACTIVE', 'Pneumatic assembly stations and 700-bar hydrostatic testing rig', TRUE, 1001, 1001, 1001, 1001),

    (1005, 'WC-PAINT-01', 'Automated Electrostatic Powder Coating & Curing Tunnel', 'LINE_ASSEMBLY',
     1001, 'Bay 5 - Surface Finishing & Coating Line', 16.00, 82.00, 'HOURS',
     300.00, 160.00, 120.00, 580.00,
     'ACTIVE', 'Continuous conveyorized powder booth and gas-fired IR oven', TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (work_center_id) DO NOTHING;

SELECT setval('seq_work_center_id', GREATEST((SELECT COALESCE(MAX(work_center_id), 1005) FROM tbl_mfg_work_center), 1005));

-- 3. Work Center Machines & Capital Assets (tbl_mfg_work_center_machine)
INSERT INTO tbl_mfg_work_center_machine (
    wc_machine_id, work_center_id, machine_code, machine_name, model_no, serial_no,
    manufacturer, installation_date, warranty_expiry_date, power_rating_kw,
    status, last_maintenance_date, next_maintenance_due, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 'MCH-CNC-501', 'Mazak Quick Turn 250 MSY Multi-Tasking Lathe', 'QT-250MSY', 'MZK-2024-8891',
     'Yamazaki Mazak Corp', '2024-03-15', '2027-03-14', 22.00,
     'OPERATIONAL', '2026-04-01', '2026-07-01', 'Equipped with sub-spindle and live rotary tooling', TRUE, 1001, 1001, 1001, 1001),

    (1002, 1001, 'MCH-VMC-201', 'Haas VF-2SS Super-Speed Vertical Machining Center', 'VF-2SS', 'HAA-2024-4412',
     'Haas Automation USA', '2024-06-20', '2026-06-19', 22.40,
     'OPERATIONAL', '2026-04-05', '2026-07-05', '12000 RPM inline direct-drive spindle', TRUE, 1001, 1001, 1001, 1001),

    (1003, 1001, 'MCH-CNC-301', 'Doosan Lynx 2100 LY Turning Center with Y-Axis', 'Lynx 2100LY', 'DSN-2025-1109',
     'DN Solutions', '2025-01-10', '2027-01-09', 15.00,
     'OPERATIONAL', '2026-03-28', '2026-06-28', 'High rigidity roller LM guideways', TRUE, 1001, 1001, 1001, 1001),

    (1004, 1002, 'MCH-WLD-101', 'ESAB Warrior 500i Multi-Process Inverter Welder', 'Warrior 500i', 'ESB-2023-7711',
     'ESAB Welding Systems', '2023-11-05', '2025-11-04', 25.00,
     'OPERATIONAL', '2026-03-15', '2026-06-15', 'Heavy-duty 500A @ 60% duty cycle for structural welding', TRUE, 1001, 1001, 1001, 1001),

    (1005, 1002, 'MCH-WLD-102', 'Fronius TransSteel 3500 Pulse Automated MIG/MAG', 'TransSteel 3500', 'FRN-2024-3321',
     'Fronius International', '2024-08-12', '2026-08-11', 18.50,
     'OPERATIONAL', '2026-04-10', '2026-07-10', 'Pulse synergic program for stainless steel joint integrity', TRUE, 1001, 1001, 1001, 1001),

    (1006, 1003, 'MCH-FUR-001', 'Ipsen Sealed Quench Atmosphere Carburizing Furnace SQ-400', 'SQ-400', 'IPS-2023-9901',
     'Ipsen USA', '2023-05-18', '2026-05-17', 95.00,
     'OPERATIONAL', '2026-04-02', '2026-05-02', 'Integral oil quench tank with nitrogen atmosphere purge', TRUE, 1001, 1001, 1001, 1001),

    (1007, 1003, 'MCH-FUR-002', 'High-Precision Tempering Pit Furnace TF-200', 'TF-200', 'IND-2023-5510',
     'Inductotherm Group', '2023-07-22', '2025-07-21', 45.00,
     'OPERATIONAL', '2026-04-02', '2026-05-02', 'Forced air circulation up to 650°C', TRUE, 1001, 1001, 1001, 1001),

    (1008, 1004, 'MCH-TST-001', 'Haskel Hydraulic Hydrostatic Test Rig 700 Bar', 'HTR-700B', 'HSK-2024-6612',
     'Haskel International', '2024-09-14', '2026-09-13', 7.50,
     'OPERATIONAL', '2026-04-12', '2026-07-12', 'Dual digital pressure transducers and automated graph recording', TRUE, 1001, 1001, 1001, 1001),

    (1009, 1004, 'MCH-PKG-001', 'Signode Semi-Automatic Rotary Ring Stretch Wrapper', 'RRSW-150', 'SIG-2024-8819',
     'Signode Packaging India', '2024-10-01', '2025-09-30', 3.50,
     'OPERATIONAL', '2026-03-20', '2026-06-20', 'Palletised batch wrapping with prestretch carriage', TRUE, 1001, 1001, 1001, 1001),

    (1010, 1005, 'MCH-PNT-101', 'Gema OptiFlex Pro Automated Powder Application System', 'OptiFlex Pro', 'GMA-2025-4402',
     'Gema Switzerland', '2025-02-15', '2027-02-14', 35.00,
     'OPERATIONAL', '2026-04-08', '2026-07-08', 'OptiSpray dense phase pumps with fast color change booth', TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (wc_machine_id) DO NOTHING;

SELECT setval('seq_wc_machine_id', GREATEST((SELECT COALESCE(MAX(wc_machine_id), 1010) FROM tbl_mfg_work_center_machine), 1010));

-- 4. Work Center Shift Assignments (tbl_mfg_work_center_shift)
INSERT INTO tbl_mfg_work_center_shift (
    wc_shift_id, work_center_id, shift_id, days_of_week, operator_count, remarks,
    is_active, comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1002, 'MON,TUE,WED,THU,FRI,SAT', 3, 'Shift 1: 3 CNC Operators + 1 Inspector', TRUE, 1001, 1001, 1001, 1001),
    (1002, 1001, 1003, 'MON,TUE,WED,THU,FRI,SAT', 3, 'Shift 2: 3 CNC Operators + 1 Inspector', TRUE, 1001, 1001, 1001, 1001),
    (1003, 1002, 1002, 'MON,TUE,WED,THU,FRI,SAT', 2, 'Shift 1: Certified TIG/MIG Welders', TRUE, 1001, 1001, 1001, 1001),
    (1004, 1002, 1003, 'MON,TUE,WED,THU,FRI,SAT', 2, 'Shift 2: Certified TIG/MIG Welders', TRUE, 1001, 1001, 1001, 1001),
    (1005, 1003, 1002, 'MON,TUE,WED,THU,FRI,SAT,SUN', 1, 'Shift 1: Furnace Master Metallurgist', TRUE, 1001, 1001, 1001, 1001),
    (1006, 1003, 1003, 'MON,TUE,WED,THU,FRI,SAT,SUN', 1, 'Shift 2: Furnace Operator & Pyrometry Tech', TRUE, 1001, 1001, 1001, 1001),
    (1007, 1003, 1004, 'MON,TUE,WED,THU,FRI,SAT,SUN', 1, 'Shift 3: Night Furnace Soak Monitor', TRUE, 1001, 1001, 1001, 1001),
    (1008, 1004, 1001, 'MON,TUE,WED,THU,FRI', 4, 'General Shift: Assembly fitters + Hydro test tech', TRUE, 1001, 1001, 1001, 1001),
    (1009, 1005, 1002, 'MON,TUE,WED,THU,FRI,SAT', 2, 'Shift 1: Powder gun operators', TRUE, 1001, 1001, 1001, 1001),
    (1010, 1005, 1003, 'MON,TUE,WED,THU,FRI,SAT', 2, 'Shift 2: Curing line operators', TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (wc_shift_id) DO NOTHING;

SELECT setval('seq_wc_shift_id', GREATEST((SELECT COALESCE(MAX(wc_shift_id), 1010) FROM tbl_mfg_work_center_shift), 1010));

-- ============================================================================
-- FEATURE: Step 6.3 - Production Routings, Operation Sequences & Machine Tooling Demo Data
-- ============================================================================

-- 1. Production Routing Headers (tbl_mfg_routing_header)
INSERT INTO tbl_mfg_routing_header (
    routing_id, routing_code, routing_name, item_id, version_no, status,
    is_default, effective_from, effective_to, batch_size,
    total_setup_time_mins, total_run_time_mins, total_lead_time_days,
    total_machine_cost, total_labor_cost, total_overhead_cost, total_cost_per_unit,
    approved_by, approved_date, approval_remarks, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- Routing 1: Industrial SS-316 Flanged Gate Valve 2" Class 150 (V1.0)
    (1001, 'ROUT-FG-VALVE-50-V1', 'Industrial SS-316 Flanged Gate Valve 2" Class 150 Production Routing',
     1008, '1.0', 'ACTIVE',
     TRUE, '2026-04-01', NULL, 10.000,
     145.00, 140.00, 2.50,
     1339.25, 465.08, 431.08, 2235.41,
     1001, '2026-04-01 10:00:00+05:30', 'Approved for OEM Class 150 valve mass manufacturing',
     'Standard 6-stage routing: CNC rough turning, milling, gas carburizing, grinding, hydro testing, powder coating', TRUE,
     1001, 1001, 1001, 1001),

    -- Routing 2: Automotive Hydromount Powertrain Assembly (V1.0)
    (1002, 'ROUT-AUTO-MNT-V1', 'Automotive Hydromount Powertrain Assembly Production Routing',
     1009, '1.0', 'ACTIVE',
     TRUE, '2026-04-01', NULL, 20.000,
     80.00, 36.00, 1.50,
     242.00, 142.50, 98.50, 483.00,
     1001, '2026-04-01 11:30:00+05:30', 'Production line standard routing validated with tier-1 client',
     'High-speed automotive assembly cell with robotic welding, powder coating, and hydro-damping filling', TRUE,
     1001, 1001, 1001, 1001),

    -- Routing 3: Machined SS-316 Gate Valve Body Casting Sub-Assembly (V1.0)
    (1003, 'ROUT-SUB-BODY-V1', 'Machined SS-316 Gate Valve Body Casting Sub-Assembly Routing',
     1005, '1.0', 'ACTIVE',
     TRUE, '2026-04-01', NULL, 10.000,
     80.00, 81.00, 2.00,
     785.00, 238.00, 242.00, 1265.00,
     1001, '2026-04-01 14:00:00+05:30', 'Critical internal valve component precision machining routing',
     '3-stage sub-assembly machining: CNC rough boring, finish port milling, and atmosphere carburizing', TRUE,
     1001, 1001, 1001, 1001),

    -- Routing 4: Industrial Gate Valve (V2.0 - Optimized Cycle Time Draft)
    (1004, 'ROUT-FG-VALVE-50-V2', 'Industrial SS-316 Flanged Gate Valve 2" Class 150 (V2.0 - High Speed Cell)',
     1008, '2.0', 'DRAFT',
     FALSE, '2026-05-01', NULL, 15.000,
     115.00, 112.00, 2.00,
     1080.00, 380.00, 345.00, 1805.00,
     NULL, NULL, NULL,
     'High-speed multi-axis CNC tooling optimization reducing cycle time by 20%', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (routing_id) DO NOTHING;

SELECT setval('seq_routing_id', GREATEST((SELECT COALESCE(MAX(routing_id), 1004) FROM tbl_mfg_routing_header), 1004));

-- 2. Production Routing Operations (tbl_mfg_routing_operation)
INSERT INTO tbl_mfg_routing_operation (
    routing_op_id, routing_id, op_sequence, op_code, op_name,
    work_center_id, machine_id, setup_time_mins, run_time_mins, overlap_percent,
    machine_hourly_rate, labor_hourly_rate, overhead_hourly_rate, total_hourly_rate,
    machine_cost_per_unit, labor_cost_per_unit, overhead_cost_per_unit, total_cost_per_unit,
    tooling_description, fixture_no, is_inspection_required, qc_checkpoints,
    is_subcontracted, subcontract_vendor_id, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- Routing 1 Operations (Gate Valve V1.0)
    (1001, 1001, 10, 'OP-10', 'Rough CNC Turning & Flange Facing',
     1001, 1001, 30.00, 15.00, 0.00,
     450.00, 180.00, 120.00, 750.00,
     135.0000, 54.0000, 36.0000, 225.0000,
     'CNMG 120408 carbide insert, live tool turning block, 3-jaw hydraulic chuck', 'FIX-CNC-FLANGE-01',
     TRUE, 'Check flange OD 152.4 ± 0.2 mm and face flatness <= 0.05 mm',
     FALSE, NULL, 'Initial roughing and sealing face preparation', TRUE,
     1001, 1001, 1001, 1001),

    (1002, 1001, 20, 'OP-20', 'Bonnet Bolting PCD Drilling & Milling Keyway',
     1001, 1002, 20.00, 12.00, 10.00,
     450.00, 180.00, 120.00, 750.00,
     105.0000, 42.0000, 28.0000, 175.0000,
     'Solid carbide 4-flute end mill Ø16mm, coolant-thru drill Ø18mm', 'JIG-PCD-4HOLE',
     TRUE, 'Verify 4x bolt hole PCD 120.7 mm ± 0.1 mm, through clearance',
     FALSE, NULL, '4-hole bolting pattern and internal wedge guide keyway', TRUE,
     1001, 1001, 1001, 1001),

    (1003, 1001, 30, 'OP-30', 'Atmosphere Gas Carburizing & Case Hardening',
     1003, 1006, 45.00, 60.00, 0.00,
     800.00, 200.00, 250.00, 1250.00,
     860.0000, 215.0000, 268.7500, 1343.7500,
     'Inconel heat-treat basket tray, carbon probe calibration fixture', 'BSK-HT-400',
     TRUE, 'Surface hardness 52-56 HRC; effective case depth 0.8-1.0 mm',
     FALSE, NULL, 'Batch atmosphere heating at 920°C followed by controlled oil quench', TRUE,
     1001, 1001, 1001, 1001),

    (1004, 1001, 40, 'OP-40', 'Precision Finish Grinding of Flange Face & Stem Seat',
     1001, 1003, 15.00, 10.00, 15.00,
     450.00, 180.00, 120.00, 750.00,
     86.2500, 34.5000, 23.0000, 143.7500,
     'CBN precision grinding wheel, magnetic rotary face plate', 'FIX-GRD-SEAT',
     TRUE, 'Surface roughness Ra <= 0.8 µm on sealing face; runout <= 0.02 mm',
     FALSE, NULL, 'Ultra-precision seat grinding for Class 150 bubble-tight shutoff', TRUE,
     1001, 1001, 1001, 1001),

    (1005, 1001, 50, 'OP-50', 'Valve Trim Assembly & 700-Bar Hydrostatic Pressure Testing',
     1004, 1008, 15.00, 25.00, 0.00,
     120.00, 150.00, 80.00, 350.00,
     53.0000, 66.2500, 35.3300, 154.5800,
     'Pneumatic torque wrench 80 Nm, digital pressure transducer 0-700 bar', 'RIG-HYDRO-50',
     TRUE, 'API 598 Shell test at 350 bar for 15 mins; zero leakage allowed',
     FALSE, NULL, 'Insert stem, bonnet gasket, handwheel, and perform hydro certification', TRUE,
     1001, 1001, 1001, 1001),

    (1006, 1001, 60, 'OP-60', 'Electrostatic Epoxy Powder Coating & Oven Curing',
     1005, 1010, 20.00, 18.00, 25.00,
     300.00, 160.00, 120.00, 580.00,
     100.0000, 53.3300, 40.0000, 193.3300,
     'OptiSpray dense phase guns, hanging hook tree, infrared curing temp logger', 'TREE-COAT-01',
     TRUE, 'Dry Film Thickness (DFT) 80-120 µm, cross-hatch adhesion 100%',
     FALSE, NULL, 'Corrosion-resistant marine epoxy blue coating RAL 5005', TRUE,
     1001, 1001, 1001, 1001),

    -- Routing 2 Operations (Automotive Hydromount V1.0)
    (1007, 1002, 10, 'OP-10', 'Core Pin CNC Turning & Retaining Ring Grooving',
     1001, 1001, 25.00, 6.00, 0.00,
     450.00, 180.00, 120.00, 750.00,
     54.3750, 21.7500, 14.5000, 90.6250,
     'DNMG 110404 fine finishing insert, internal circlip grooving tool', 'COLLET-PIN-25',
     TRUE, 'Pin diameter Ø25.00 ± 0.01 mm, groove width 1.30 mm',
     FALSE, NULL, 'High tensile alloy core pin machining', TRUE,
     1001, 1001, 1001, 1001),

    (1008, 1002, 20, 'OP-20', 'Robotic Bracket MIG Welding & Seam Integrity',
     1002, 1005, 20.00, 8.00, 20.00,
     280.00, 220.00, 140.00, 640.00,
     42.0000, 33.0000, 21.0000, 96.0000,
     'Automated MIG torch nozzle, ER70S-6 wire spool 1.2mm, Ar+CO2 shielding gas', 'WELD-JIG-MNT-02',
     TRUE, 'Visual weld throat 4.5 mm min; penetration verification',
     FALSE, NULL, 'Robotic circumferential weld joining inner bracket to stamping shell', TRUE,
     1001, 1001, 1001, 1001),

    (1009, 1002, 30, 'OP-30', 'Automated Powder Coating & Polymer Curing',
     1005, 1010, 15.00, 10.00, 15.00,
     300.00, 160.00, 120.00, 580.00,
     53.7500, 28.6700, 21.5000, 103.9200,
     'OptiFlex electrostatic guns, satin black epoxy powder', 'TREE-MNT-B01',
     TRUE, 'Salt spray resistance grade coating, thickness 60-90 µm',
     FALSE, NULL, 'Protective underbody chassis coating', TRUE,
     1001, 1001, 1001, 1001),

    (1010, 1002, 40, 'OP-40', 'Hydraulic Glycol Filling, Sealing & Dynamic Load Testing',
     1004, 1008, 20.00, 12.00, 0.00,
     120.00, 150.00, 80.00, 350.00,
     26.0000, 32.5000, 17.3300, 75.8300,
     'Vacuum degassing fill nozzle, crimping ring press, dynamic frequency test bench', 'FIXT-VAC-FILL-01',
     TRUE, 'Dynamic damping coefficient 1250 Ns/m ± 5%, zero air bubble inclusion',
     FALSE, NULL, 'Automated glycol metering and vibration isolation test', TRUE,
     1001, 1001, 1001, 1001),

    -- Routing 3 Operations (Gate Valve Body Sub-Assembly V1.0)
    (1011, 1003, 10, 'OP-10', 'CNC Rough Boring & Internal Facing',
     1001, 1001, 30.00, 22.00, 0.00,
     450.00, 180.00, 120.00, 750.00,
     187.5000, 75.0000, 50.0000, 312.5000,
     'Heavy duty rough boring bar Ø45mm, carbide inserts WNMG 080408', 'CHUCK-4JAW-CAST',
     TRUE, 'Internal bore diameter 48.5 ± 0.1 mm, wall thickness check',
     FALSE, NULL, 'Cast body bore rough opening and flange seating face', TRUE,
     1001, 1001, 1001, 1001),

    (1012, 1003, 20, 'OP-20', 'Bonnet Mating Face Milling & Drilled Ports',
     1001, 1002, 20.00, 14.00, 15.00,
     450.00, 180.00, 120.00, 750.00,
     120.0000, 48.0000, 32.0000, 200.0000,
     'Shell face mill Ø63mm, solid carbide tap M16x2.0', 'TOMBSTONE-BODY-01',
     TRUE, 'Thread pitch gauge pass, face flatness 0.03 mm',
     FALSE, NULL, 'Top bonnet attachment face and gland bolt tap holes', TRUE,
     1001, 1001, 1001, 1001),

    (1013, 1003, 30, 'OP-30', 'Carburizing & Quenching Hardening',
     1003, 1006, 30.00, 45.00, 0.00,
     800.00, 200.00, 250.00, 1250.00,
     640.0000, 160.0000, 200.0000, 1000.0000,
     'Furnace stacking grid, thermocouple pyrometer monitor', 'GRID-FURNACE-02',
     TRUE, 'Hardness 50-54 HRC at internal guide ribs',
     FALSE, NULL, 'Wear resistance enhancement of valve body wedge guide ways', TRUE,
     1001, 1001, 1001, 1001),

    -- Routing 4 Operations (Gate Valve V2.0 Draft)
    (1014, 1004, 10, 'OP-10', 'High-Speed Combined CNC Turn-Mill',
     1001, 1001, 25.00, 20.00, 0.00,
     450.00, 180.00, 120.00, 750.00,
     162.5000, 65.0000, 43.3300, 270.8300,
     'Sandvik CoroTurn Prime multi-directional tooling, high-pressure coolant 70 bar', 'FIX-TURNO-FAST',
     TRUE, 'Total tolerance within 0.025 mm, Ra <= 0.6 µm',
     FALSE, NULL, 'Combined turn and mill in single setup on sub-spindle lathe', TRUE,
     1001, 1001, 1001, 1001),

    (1015, 1004, 20, 'OP-20', 'Atmosphere Gas Carburizing Rapid Cycle',
     1003, 1006, 40.00, 48.00, 0.00,
     800.00, 200.00, 250.00, 1250.00,
     675.5600, 168.8900, 211.1100, 1055.5600,
     'Optimized carbon boost-diffuse cycle profile with fast oil quench', 'BSK-HT-FAST',
     TRUE, 'Hardness 52-56 HRC validated',
     FALSE, NULL, 'Advanced vacuum carburizing cycle', TRUE,
     1001, 1001, 1001, 1001),

    (1016, 1004, 30, 'OP-30', 'Automated Test & Powder Coating Cell',
     1004, 1008, 20.00, 22.00, 0.00,
     200.00, 150.00, 100.00, 450.00,
     77.7800, 58.3300, 38.8900, 175.0000,
     'Integrated hydro test station with direct overhead conveyor to paint booth', 'CELL-INT-01',
     TRUE, 'Continuous test and coat verification',
     FALSE, NULL, 'Lean cellular manufacturing layout', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (routing_op_id) DO NOTHING;

SELECT setval('seq_routing_op_id', GREATEST((SELECT COALESCE(MAX(routing_op_id), 1016) FROM tbl_mfg_routing_operation), 1016));

-- Update BOM headers to link with their respective production routings
UPDATE tbl_mfg_bom_header SET routing_id = 1001 WHERE bom_id = 1002 AND (routing_id IS NULL OR routing_id <> 1001);
UPDATE tbl_mfg_bom_header SET routing_id = 1002 WHERE bom_id = 1001 AND (routing_id IS NULL OR routing_id <> 1002);
UPDATE tbl_mfg_bom_header SET routing_id = 1003 WHERE bom_id = 1004 AND (routing_id IS NULL OR routing_id <> 1003);

-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 6.4 - Material Requirements Planning (MRP-I Engine) & Gross-to-Net Planned Orders
--          (tbl_mfg_mrp_run_header, tbl_mfg_mrp_planned_order)
-- ============================================================================
INSERT INTO tbl_mfg_mrp_run_header (
    mrp_run_id, mrp_run_no, run_date, planning_horizon_days, demand_source,
    status, total_items_analyzed, total_planned_orders, total_planned_buy_qty,
    total_planned_make_qty, total_estimated_spend, execution_time_ms, run_by,
    remarks, is_active, comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'MRP-AHM-2627-0001', '2026-04-20 09:30:00+05:30', 30, 'BUFFER_DEFICIT',
     'COMPLETED', 12, 8, 2390.000, 325.000, 442873.00, 420, 1001,
     'Monthly gross-to-net MRP run triggered for Q1 buffer replenishment and multi-level BOM explosion.',
     TRUE, 1001, 1001, 1001, 1001),

    (1002, 'MRP-AHM-2627-0002', '2026-04-22 14:00:00+05:30', 60, 'ALL',
     'RELEASED', 14, 3, 400.000, 60.000, 145000.00, 385, 1001,
     'Mid-month re-planning run for expedited automotive hydromount production & alloy buffer replenishment.',
     TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (comp_id, branch_id, mrp_run_no) DO NOTHING;

SELECT setval('seq_mrp_run_id', GREATEST((SELECT COALESCE(MAX(mrp_run_id), 1002) FROM tbl_mfg_mrp_run_header), 1002));

INSERT INTO tbl_mfg_mrp_planned_order (
    planned_order_id, mrp_run_id, planned_order_no, item_id, bom_id, routing_id,
    order_type, source_demand_type, parent_planned_order_id, bom_level,
    gross_requirement_qty, on_hand_stock_qty, scheduled_receipts_qty, safety_stock_qty,
    net_requirement_qty, planned_order_qty, uom_id, lead_time_days,
    required_by_date, order_release_date, estimated_unit_cost, estimated_total_cost,
    status, converted_pr_id, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- Run 1: Level 0 FG Gate Valve (MAKE)
    (1001, 1001, 'PLN-ORD-0001', 1008, 1002, 1001,
     'MAKE', 'BUFFER_DEFICIT', NULL, 0,
     25.000, 5.000, 0.000, 10.000,
     30.000, 30.000, 1003, 5,
     '2026-05-15', '2026-05-10', 2986.6000, 89598.00,
     'CONFIRMED', NULL, 'Finished Gate Valve safety stock deficit below ROP. Level 0 planned order.', TRUE,
     1001, 1001, 1001, 1001),

    -- Run 1: Level 1 Machined Valve Body Sub-Assembly (MAKE) exploded from #1001
    (1002, 1001, 'PLN-ORD-0002', 1005, 1004, 1003,
     'MAKE', 'PARENT_BOM_EXPLOSION', 1001, 1,
     30.300, 10.000, 0.000, 25.000,
     45.300, 45.000, 1003, 4,
     '2026-05-10', '2026-05-06', 1850.0000, 83250.00,
     'SUGGESTED', NULL, 'Exploded child assembly from Valve PLN-ORD-0001. Requires CNC boring & milling.', TRUE,
     1001, 1001, 1001, 1001),

    -- Run 1: Level 2 SS-316 Round Bar Raw Material (BUY) exploded from #1002
    (1003, 1001, 'PLN-ORD-0003', 1001, NULL, NULL,
     'BUY', 'PARENT_BOM_EXPLOSION', 1002, 2,
     174.960, 80.000, 50.000, 300.000,
     344.960, 350.000, 1001, 12,
     '2026-05-06', '2026-04-24', 380.0000, 133000.00,
     'SUGGESTED', NULL, 'SS-316 round bar raw material for valve body CNC machining. Supplier lead time 10d + QC 2d.', TRUE,
     1001, 1001, 1001, 1001),

    -- Run 1: Level 2 Tungsten Carbide Inserts (BUY) exploded from #1002
    (1004, 1001, 'PLN-ORD-0004', 1011, NULL, NULL,
     'BUY', 'PARENT_BOM_EXPLOSION', 1002, 2,
     18.000, 5.000, 0.000, 10.000,
     23.000, 25.000, 1003, 3,
     '2026-05-06', '2026-05-03', 240.0000, 6000.00,
     'SUGGESTED', NULL, 'Tooling insert consumable for precision turning of valve bodies.', TRUE,
     1001, 1001, 1001, 1001),

    -- Run 1: Level 1 Cutting Fluid (BUY) exploded from #1001
    (1005, 1001, 'PLN-ORD-0005', 1010, NULL, NULL,
     'BUY', 'PARENT_BOM_EXPLOSION', 1001, 1,
     6.000, 2.000, 0.000, 10.000,
     14.000, 15.000, 1007, 4,
     '2026-05-10', '2026-05-06', 175.0000, 2625.00,
     'CONVERTED_TO_PR', 1001, 'Hydro-testing coolant medium converted to Purchase Requisition PR-AHM-2627-0001.', TRUE,
     1001, 1001, 1001, 1001),

    -- Run 1: Level 0 Automotive Hydromount Assembly (MAKE)
    (1006, 1001, 'PLN-ORD-0006', 1009, 1001, 1002,
     'MAKE', 'BUFFER_DEFICIT', NULL, 0,
     50.000, 20.000, 0.000, 50.000,
     80.000, 80.000, 1003, 3,
     '2026-05-02', '2026-04-29', 761.5750, 60926.00,
     'CONFIRMED', NULL, 'Automotive powertrain hydromount assembly safety buffer replenishment order.', TRUE,
     1001, 1001, 1001, 1001),

    -- Run 1: Level 1 Stamped Sheet Metal Outer Shell (MAKE) exploded from #1006
    (1007, 1001, 'PLN-ORD-0007', 1007, 1003, NULL,
     'MAKE', 'PARENT_BOM_EXPLOSION', 1006, 1,
     81.600, 15.000, 0.000, 100.000,
     166.600, 170.000, 1003, 2,
     '2026-04-29', '2026-04-27', 420.0000, 71400.00,
     'SUGGESTED', NULL, 'Stamped outer shell sub-assembly required for hydromount batch assembly.', TRUE,
     1001, 1001, 1001, 1001),

    -- Run 1: Level 2 Cold Rolled Steel Coil (BUY) exploded from #1007
    (1008, 1001, 'PLN-ORD-0008', 1002, NULL, NULL,
     'BUY', 'PARENT_BOM_EXPLOSION', 1007, 2,
     540.600, 200.000, 0.000, 1500.000,
     1840.600, 2000.000, 1001, 16,
     '2026-04-27', '2026-04-11', 70.0000, 140000.00,
     'SUGGESTED', NULL, 'CR coil 1.2mm deep draw grade. [PAST-DUE EXPEDITE WARNING]: Release date precedes run date.', TRUE,
     1001, 1001, 1001, 1001),

    -- Run 2: Level 0 Automotive Hydromount (MAKE)
    (1009, 1002, 'PLN-ORD-0009', 1009, 1001, 1002,
     'MAKE', 'BUFFER_DEFICIT', NULL, 0,
     30.000, 10.000, 0.000, 40.000,
     60.000, 60.000, 1003, 3,
     '2026-05-20', '2026-05-17', 761.5750, 45694.50,
     'SUGGESTED', NULL, 'Mid-month hydromount replenishment.', TRUE,
     1001, 1001, 1001, 1001),

    -- Run 2: Level 1 Aluminum Alloy Ingot (BUY)
    (1010, 1002, 'PLN-ORD-0010', 1003, NULL, NULL,
     'BUY', 'PARENT_BOM_EXPLOSION', 1009, 1,
     120.000, 40.000, 0.000, 200.000,
     280.000, 300.000, 1001, 8,
     '2026-05-17', '2026-05-09', 210.0000, 63000.00,
     'SUGGESTED', NULL, 'HPDC Aluminum Ingot LM24 casting alloy for housing brackets.', TRUE,
     1001, 1001, 1001, 1001),

    -- Run 2: Level 1 Polypropylene Granules (BUY)
    (1011, 1002, 'PLN-ORD-0011', 1004, NULL, NULL,
     'BUY', 'PARENT_BOM_EXPLOSION', 1009, 1,
     45.000, 15.000, 0.000, 70.000,
     100.000, 100.000, 1001, 6,
     '2026-05-17', '2026-05-11', 102.5000, 10250.00,
     'CONFIRMED', NULL, 'Polypropylene granules for elastomer molding cushions.', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (planned_order_id) DO NOTHING;

SELECT setval('seq_mrp_planned_order_id', GREATEST((SELECT COALESCE(MAX(planned_order_id), 1011) FROM tbl_mfg_mrp_planned_order), 1011));

-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 6.5 - Production Work Orders (WO), Scheduling, BOM Snapshot &
--          Operation Routing Release (tbl_mfg_wo_header, tbl_mfg_wo_bom_item, tbl_mfg_wo_routing_op)
-- ============================================================================
INSERT INTO tbl_mfg_wo_header (
    wo_id, wo_no, wo_date, item_id, bom_id, routing_id,
    target_warehouse_id, wip_warehouse_id, planned_qty, completed_qty, scrapped_qty,
    uom_id, scheduled_start_date, scheduled_end_date, actual_start_date, actual_end_date,
    priority, status, sales_order_id, mrp_planned_order_id, batch_no,
    estimated_material_cost, estimated_operation_cost, estimated_total_cost,
    actual_material_cost, actual_operation_cost, actual_total_cost,
    released_by, released_date, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- WO 1: Finished SS-316 Gate Valve 2" (IN_PROGRESS)
    (1001, 'WO-AHM-2627-0001', '2026-04-20', 1008, 1002, 1001,
     1004, 1003, 30.000, 10.000, 0.000,
     1003, '2026-05-10', '2026-05-15', '2026-05-10 08:30:00+05:30', NULL,
     'HIGH', 'IN_PROGRESS', NULL, 1001, 'BAT-2026-VLV-001',
     66606.00, 22992.00, 89598.00,
     22202.00, 7664.00, 29866.00,
     1001, '2026-04-20 10:00:00+05:30', 'Production of Class 150 gate valves for Petrochem dispatch. Priority lot.', TRUE,
     1001, 1001, 1001, 1001),

    -- WO 2: Machined Valve Body Sub-Assembly (RELEASED)
    (1002, 'WO-AHM-2627-0002', '2026-04-20', 1005, 1004, 1003,
     1003, 1003, 45.000, 0.000, 0.000,
     1003, '2026-05-06', '2026-05-10', NULL, NULL,
     'HIGH', 'RELEASED', NULL, 1002, 'BAT-2026-VBD-001',
     69277.50, 13972.50, 83250.00,
     0.00, 0.00, 0.00,
     1001, '2026-04-20 10:15:00+05:30', 'Valve body machining sub-assembly for parent WO-AHM-2627-0001.', TRUE,
     1001, 1001, 1001, 1001),

    -- WO 3: Automotive Hydromount Powertrain Assembly (DRAFT)
    (1003, 'WO-AHM-2627-0003', '2026-04-22', 1009, 1001, 1002,
     1004, 1003, 80.000, 0.000, 0.000,
     1003, '2026-04-29', '2026-05-02', NULL, NULL,
     'CRITICAL_URGENT', 'DRAFT', NULL, 1006, 'BAT-2026-MNT-001',
     45066.00, 15860.00, 60926.00,
     0.00, 0.00, 0.00,
     NULL, NULL, 'OEM monthly call-off order buffer fulfillment.', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (comp_id, branch_id, wo_no) DO NOTHING;

SELECT setval('seq_wo_id', GREATEST((SELECT COALESCE(MAX(wo_id), 1003) FROM tbl_mfg_wo_header), 1003));

-- Update MRP Planned Order status for converted order
UPDATE tbl_mfg_mrp_planned_order
SET status = 'CONVERTED_TO_WO', converted_wo_id = 1001
WHERE planned_order_id = 1001;

UPDATE tbl_mfg_mrp_planned_order
SET status = 'CONVERTED_TO_WO', converted_wo_id = 1002
WHERE planned_order_id = 1002;

-- Work Order BOM Component Snapshots (tbl_mfg_wo_bom_item)
INSERT INTO tbl_mfg_wo_bom_item (
    wo_bom_item_id, wo_id, item_id, item_description, uom_id,
    standard_qty_per_unit, scrap_factor_percent, required_qty,
    issued_qty, consumed_qty, returned_qty, unit_cost, estimated_cost, actual_cost,
    source_type, operation_seq, is_critical, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- Items for WO 1001 (Gate Valve Assembly)
    (1001, 1001, 1005, 'Machined SS-316 Gate Valve Body Casting 2" 150#', 1003,
     1.0100, 1.00, 30.300,
     30.000, 10.000, 0.000, 1850.0000, 56055.00, 18500.00,
     'MANUFACTURED', 10, TRUE, 'Primary pressure boundary casting', TRUE,
     1001, 1001, 1001, 1001),

    (1002, 1001, 1001, 'Stainless Steel 316 Round Bar Dia 50mm', 1001,
     0.8200, 2.50, 24.600,
     24.600, 8.200, 0.000, 385.0000, 9471.00, 3157.00,
     'PURCHASED', 20, TRUE, 'Stem & Wedge machining trim', TRUE,
     1001, 1001, 1001, 1001),

    (1003, 1001, 1010, 'Fully Synthetic High-Pressure CNC Cutting Fluid', 1007,
     0.2000, 0.00, 6.000,
     6.000, 2.000, 0.000, 180.0000, 1080.00, 360.00,
     'PURCHASED', 30, FALSE, 'Hydrostatic test fluid medium', TRUE,
     1001, 1001, 1001, 1001),

    -- Items for WO 1002 (Valve Body Machining Sub-Assembly)
    (1004, 1002, 1001, 'Stainless Steel 316 Round Bar Dia 50mm', 1001,
     3.8880, 8.00, 174.960,
     0.000, 0.000, 0.000, 385.0000, 67359.60, 0.00,
     'PURCHASED', 10, TRUE, 'Solid bar for valve cavity boring', TRUE,
     1001, 1001, 1001, 1001),

    (1005, 1002, 1011, 'Tungsten Carbide Turning Insert CNMG 120408-PM', 1003,
     0.4000, 0.00, 18.000,
     0.000, 0.000, 0.000, 240.0000, 4320.00, 0.00,
     'PURCHASED', 20, FALSE, 'Precision finish turning inserts', TRUE,
     1001, 1001, 1001, 1001),

    -- Items for WO 1003 (Hydromount Assembly)
    (1006, 1003, 1007, 'Stamped Sheet Metal Outer Door Panel Shell', 1003,
     1.0200, 2.00, 81.600,
     0.000, 0.000, 0.000, 420.0000, 34272.00, 0.00,
     'MANUFACTURED', 10, TRUE, 'Deep-drawn stamped outer shell', TRUE,
     1001, 1001, 1001, 1001),

    (1007, 1003, 1004, 'Polypropylene Copolymer Granules Injection Grade', 1001,
     0.5150, 3.00, 41.200,
     0.000, 0.000, 0.000, 105.0000, 4326.00, 0.00,
     'PURCHASED', 20, FALSE, 'Rubber cushion injection elastomer', TRUE,
     1001, 1001, 1001, 1001),

    (1008, 1003, 1001, 'Stainless Steel 316 Round Bar Dia 50mm', 1001,
     0.2100, 5.00, 16.800,
     0.000, 0.000, 0.000, 385.0000, 6468.00, 0.00,
     'PURCHASED', 30, TRUE, 'Center pin machining stock', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (wo_id, item_id) DO NOTHING;

SELECT setval('seq_wo_bom_item_id', GREATEST((SELECT COALESCE(MAX(wo_bom_item_id), 1008) FROM tbl_mfg_wo_bom_item), 1008));

-- Work Order Routing Operations Snapshot (tbl_mfg_wo_routing_op)
INSERT INTO tbl_mfg_wo_routing_op (
    wo_routing_op_id, wo_id, op_sequence, op_code, op_name,
    work_center_id, machine_id, planned_setup_time_mins, planned_run_time_mins,
    actual_setup_time_mins, actual_run_time_mins, planned_cost, actual_cost,
    planned_qty, completed_qty, scrapped_qty, rework_qty, status,
    scheduled_start_date, scheduled_end_date, is_inspection_required,
    is_subcontracted, subcontract_vendor_id, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- Routing for WO 1001 (Gate Valve Assembly)
    (1001, 1001, 10, 'OP-10', 'CNC Rough Turning & Flange Facing',
     1001, 1001, 30.00, 15.00,
     30.00, 450.00, 6000.00, 6000.00,
     30.000, 30.000, 0.000, 0.000, 'COMPLETED',
     '2026-05-10', '2026-05-11', TRUE,
     FALSE, NULL, 'Flange face flatness 0.02mm confirmed', TRUE,
     1001, 1001, 1001, 1001),

    (1002, 1001, 20, 'OP-20', 'Multi-Axis VMC Milling & Drilling',
     1001, 1002, 20.00, 12.00,
     20.00, 120.00, 4800.00, 1600.00,
     30.000, 10.000, 0.000, 0.000, 'IN_PROGRESS',
     '2026-05-11', '2026-05-12', TRUE,
     FALSE, NULL, '10 of 30 valves drilled and tapped', TRUE,
     1001, 1001, 1001, 1001),

    (1003, 1001, 30, 'OP-30', 'Atmosphere Gas Carburizing & Quenching',
     1003, 1006, 45.00, 60.00,
     0.00, 0.00, 6392.00, 0.00,
     30.000, 0.000, 0.000, 0.000, 'PENDING',
     '2026-05-13', '2026-05-14', TRUE,
     FALSE, NULL, 'Hardness 52-56 HRC specification', TRUE,
     1001, 1001, 1001, 1001),

    (1004, 1001, 40, 'OP-40', 'Hydrostatic Pressure Testing (API 598)',
     1004, 1008, 15.00, 20.00,
     0.00, 0.00, 5800.00, 0.00,
     30.000, 0.000, 0.000, 0.000, 'PENDING',
     '2026-05-14', '2026-05-15', TRUE,
     FALSE, NULL, 'Shell test 30 bar, seat test 22 bar', TRUE,
     1001, 1001, 1001, 1001),

    -- Routing for WO 1002 (Valve Body Machining)
    (1005, 1002, 10, 'OP-10', 'CNC Rough Boring & Internal Facing',
     1001, 1001, 30.00, 22.00,
     0.00, 0.00, 6500.00, 0.00,
     45.000, 0.000, 0.000, 0.000, 'PENDING',
     '2026-05-06', '2026-05-07', TRUE,
     FALSE, NULL, 'Internal bore diameter 48.5mm', TRUE,
     1001, 1001, 1001, 1001),

    (1006, 1002, 20, 'OP-20', 'Bonnet Mating Face Milling & Drilled Ports',
     1001, 1002, 20.00, 14.00,
     0.00, 0.00, 4200.00, 0.00,
     45.000, 0.000, 0.000, 0.000, 'PENDING',
     '2026-05-07', '2026-05-08', TRUE,
     FALSE, NULL, 'M16x2.0 tapped holes', TRUE,
     1001, 1001, 1001, 1001),

    (1007, 1002, 30, 'OP-30', 'Carburizing & Quenching Hardening',
     1003, 1006, 30.00, 45.00,
     0.00, 0.00, 3272.50, 0.00,
     45.000, 0.000, 0.000, 0.000, 'PENDING',
     '2026-05-08', '2026-05-10', TRUE,
     FALSE, NULL, 'Hardness 50-54 HRC wear treatment', TRUE,
     1001, 1001, 1001, 1001),

    -- Routing for WO 1003 (Hydromount Assembly)
    (1008, 1003, 10, 'OP-10', 'Core Pin CNC Turning & Grooving',
     1001, 1001, 25.00, 6.00,
     0.00, 0.00, 4200.00, 0.00,
     80.000, 0.000, 0.000, 0.000, 'PENDING',
     '2026-04-29', '2026-04-30', TRUE,
     FALSE, NULL, 'Pin diameter Ø25.00 ± 0.01 mm', TRUE,
     1001, 1001, 1001, 1001),

    (1009, 1003, 20, 'OP-20', 'Robotic Bracket MIG Welding',
     1002, 1005, 20.00, 8.00,
     0.00, 0.00, 4800.00, 0.00,
     80.000, 0.000, 0.000, 0.000, 'PENDING',
     '2026-04-30', '2026-05-01', TRUE,
     FALSE, NULL, 'Weld throat 4.5mm min penetration', TRUE,
     1001, 1001, 1001, 1001),

    (1010, 1003, 30, 'OP-30', 'Automated Powder Coating & Polymer Curing',
     1005, 1010, 15.00, 10.00,
     0.00, 0.00, 4000.00, 0.00,
     80.000, 0.000, 0.000, 0.000, 'PENDING',
     '2026-05-01', '2026-05-01', TRUE,
     FALSE, NULL, 'Epoxy coating thickness 60-90 µm', TRUE,
     1001, 1001, 1001, 1001),

    (1011, 1003, 40, 'OP-40', 'Hydraulic Glycol Filling & Dynamic Testing',
     1004, 1008, 20.00, 12.00,
     0.00, 0.00, 2860.00, 0.00,
     80.000, 0.000, 0.000, 0.000, 'PENDING',
     '2026-05-02', '2026-05-02', TRUE,
     FALSE, NULL, 'Dynamic damping coefficient test', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (wo_id, op_sequence) DO NOTHING;

SELECT setval('seq_wo_routing_op_id', GREATEST((SELECT COALESCE(MAX(wo_routing_op_id), 1011) FROM tbl_mfg_wo_routing_op), 1011));


-- ============================================================================
-- DATE: 2026-10-18
-- FEATURE: Step 6.6 - Sample Shopfloor Material Issue & Staging Records
--          (tbl_mfg_material_issue_header, tbl_mfg_material_issue_item)
-- ============================================================================

INSERT INTO tbl_mfg_material_issue_header (
    issue_id, issue_no, issue_date, wo_id, issue_type,
    from_warehouse_id, to_warehouse_id, status,
    total_items, total_quantity, total_cost,
    issued_by, received_by, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- 1. Full Material Issue for Active Work Order 1001 (Gate Valve Assembly) - POSTED
    (1001, 'MI-AHM-2627-0001', '2026-05-10', 1001, 'STANDARD_ISSUE',
     1001, 1002, 'POSTED',
     3, 70.050, 62419.75,
     1001, 1001, 'Initial full material batch issuance for WO-AHM-2627-0001 shopfloor execution', TRUE,
     1001, 1001, 1001, 1001),

    -- 2. Staging Requisition for Released Work Order 1002 (Valve Body Machining) - DRAFT
    (1002, 'MI-AHM-2627-0002', '2026-05-11', 1002, 'STANDARD_ISSUE',
     1001, 1002, 'DRAFT',
     2, 192.960, 71679.60,
     1001, 1001, 'Draft store staging requisition for valve body CNC machining batch', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (comp_id, branch_id, issue_no) DO NOTHING;

SELECT setval('seq_material_issue_id', GREATEST((SELECT COALESCE(MAX(issue_id), 1002) FROM tbl_mfg_material_issue_header), 1002));

INSERT INTO tbl_mfg_material_issue_item (
    issue_item_id, issue_id, wo_bom_item_id, item_id, uom_id,
    required_qty, previously_issued_qty, issue_qty,
    unit_cost, total_cost, batch_no, heat_no, bin_location, remarks,
    is_active, comp_id, branch_id, fyear_id, created_by
) VALUES
    -- Items for Issue 1001 (WO 1001)
    (1001, 1001, 1001, 1005, 1003,
     30.300, 0.000, 30.300,
     1850.0000, 56055.00, 'BATCH-CST-2026-08', 'HEAT-SS316-441', 'BIN-A1-04', 'Cast body parts staged to Assembly Bay 1',
     TRUE, 1001, 1001, 1001, 1001),

    (1002, 1001, 1002, 1001, 1001,
     15.750, 0.000, 15.750,
     385.0000, 6063.75, 'BATCH-BAR-2026-11', 'HEAT-SS316-109', 'RACK-B-02', 'SS bar stock for stem turning',
     TRUE, 1001, 1001, 1001, 1001),

    (1003, 1001, 1003, 1003, 1003,
     24.000, 0.000, 24.000,
     12.5000, 300.00, 'BATCH-FST-2026-01', NULL, 'BIN-D2-11', 'Fastener sets released from stores',
     TRUE, 1001, 1001, 1001, 1001),

    -- Items for Issue 1002 (WO 1002)
    (1004, 1002, 1004, 1001, 1001,
     174.960, 0.000, 174.960,
     385.0000, 67359.60, 'BATCH-BAR-2026-12', 'HEAT-SS316-110', 'RACK-B-03', 'SS-316 round bar raw materials',
     TRUE, 1001, 1001, 1001, 1001),

    (1005, 1002, 1005, 1011, 1003,
     18.000, 0.000, 18.000,
     240.0000, 4320.00, 'TOOL-CNMG-2026-04', NULL, 'TOOL-CRIB-01', 'Turning inserts from tool crib',
     TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (issue_item_id) DO NOTHING;

SELECT setval('seq_material_issue_item_id', GREATEST((SELECT COALESCE(MAX(issue_item_id), 1005) FROM tbl_mfg_material_issue_item), 1005));




-- ============================================================================
-- DATE: 2026-10-19
-- FEATURE: Step 6.7 - Sample Production Job Cards & Operation Time Logs
--          (tbl_mfg_job_card, tbl_mfg_job_card_time_log)
-- ============================================================================

INSERT INTO tbl_mfg_job_card (
    job_card_id, job_card_no, job_card_date, wo_id, wo_routing_op_id,
    op_sequence, op_code, op_name, work_center_id, machine_id, assigned_operator_id,
    planned_qty, input_qty, completed_qty, scrapped_qty, rework_qty, uom_id,
    status, scheduled_start_date, scheduled_end_date, actual_start_time, actual_end_time,
    planned_setup_mins, planned_run_mins, actual_setup_mins, actual_run_mins,
    downtime_mins, downtime_reason, hourly_rate, actual_cost,
    is_inspection_required, in_process_qc_status, qc_inspector_id, qc_inspected_at,
    qc_sample_size, qc_accepted_qty, qc_rejected_qty, qc_remarks,
    batch_no, heat_no, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- 1. JC-0001: Completed OP-10 CNC Flange Facing for WO-1001
    (1001, 'JC-AHM-2627-0001', '2026-05-10', 1001, 1001,
     10, 'OP-10', 'CNC Flange & Body Facing', 1001, 1001, 1001,
     50.000, 50.000, 48.000, 2.000, 0.000, 1003,
     'COMPLETED', '2026-05-10', '2026-05-10', '2026-05-10 08:30:00+05:30', '2026-05-10 21:00:00+05:30',
     30.00, 750.00, 32.00, 720.00,
     15.00, 'Tool insert index and edge wear replacement', 650.00, 8146.67,
     TRUE, 'ACCEPTED', 1003, '2026-05-10 21:15:00+05:30',
     5, 48.000, 2.000, 'Flange thickness and seal face Ra 0.8 μm verified on CMM. 2 pieces rejected due to casting blowholes.',
     'BATCH-VALVE-26-01', 'HEAT-SS316-441', 'Completed first stage machining. 48 good pieces passed to OP-20.', TRUE,
     1001, 1001, 1001, 1001),

    -- 2. JC-0002: In-Progress OP-20 CNC Milling for WO-1001
    (1002, 'JC-AHM-2627-0002', '2026-05-11', 1001, 1002,
     20, 'OP-20', 'Multi-Axis Port Milling', 1001, 1002, 1001,
     48.000, 48.000, 28.000, 0.000, 0.000, 1003,
     'IN_PROGRESS', '2026-05-11', '2026-05-12', '2026-05-11 09:00:00+05:30', NULL,
     20.00, 576.00, 22.00, 336.00,
     0.00, NULL, 650.00, 3878.33,
     FALSE, 'NA', NULL, NULL,
     0, 0.000, 0.000, NULL,
     'BATCH-VALVE-26-01', 'HEAT-SS316-441', 'Day shift in-progress. 28 pieces milled with zero scrap so far.', TRUE,
     1001, 1001, 1001, 1001),

    -- 3. JC-0003: Pending OP-30 Hydro Testing for WO-1001
    (1003, 'JC-AHM-2627-0003', '2026-05-12', 1001, 1003,
     30, 'OP-30', 'Hydrostatic Pressure & Seat Leakage Testing', 1004, 1007, NULL,
     48.000, 0.000, 0.000, 0.000, 0.000, 1003,
     'PENDING', '2026-05-12', '2026-05-13', NULL, NULL,
     15.00, 384.00, 0.00, 0.00,
     0.00, NULL, 480.00, 0.00,
     TRUE, 'PENDING', NULL, NULL,
     0, 0.000, 0.000, NULL,
     'BATCH-VALVE-26-01', 'HEAT-SS316-441', 'Waiting for OP-20 batch completion to stage hydro testing.', TRUE,
     1001, 1001, 1001, 1001),

    -- 4. JC-0004: Pending OP-40 Final Assembly for WO-1001
    (1004, 'JC-AHM-2627-0004', '2026-05-13', 1001, 1004,
     40, 'OP-40', 'Final Valve Trim Assembly & Torque Tightening', 1003, NULL, NULL,
     48.000, 0.000, 0.000, 0.000, 0.000, 1003,
     'PENDING', '2026-05-13', '2026-05-14', NULL, NULL,
     10.00, 1200.00, 0.00, 0.00,
     0.00, NULL, 350.00, 0.00,
     TRUE, 'PENDING', NULL, NULL,
     0, 0.000, 0.000, NULL,
     'BATCH-VALVE-26-01', 'HEAT-SS316-441', 'Lineside assembly staging scheduled.', TRUE,
     1001, 1001, 1001, 1001),

    -- 5. JC-0005: OP-10 for WO-1002 (Valve Body Machining)
    (1005, 'JC-AHM-2627-0005', '2026-05-11', 1002, 1005,
     10, 'OP-10', 'Rough Turning & Bore Roughing', 1001, 1001, 1001,
     120.000, 120.000, 0.000, 0.000, 0.000, 1003,
     'PENDING', '2026-05-11', '2026-05-12', NULL, NULL,
     25.00, 2160.00, 0.00, 0.00,
     0.00, NULL, 650.00, 0.00,
     FALSE, 'NA', NULL, NULL,
     0, 0.000, 0.000, NULL,
     'BATCH-BODY-26-01', 'HEAT-SS316-110', 'Staged at CNC Cell 1 awaiting operator queue.', TRUE,
     1001, 1001, 1001, 1001),

    -- 6. JC-0006: OP-20 for WO-1002
    (1006, 'JC-AHM-2627-0006', '2026-05-12', 1002, 1006,
     20, 'OP-20', 'Finish Boring & Thread Chasing', 1001, 1001, NULL,
     120.000, 0.000, 0.000, 0.000, 0.000, 1003,
     'PENDING', '2026-05-12', '2026-05-13', NULL, NULL,
     15.00, 1680.00, 0.00, 0.00,
     0.00, NULL, 650.00, 0.00,
     FALSE, 'NA', NULL, NULL,
     0, 0.000, 0.000, NULL,
     'BATCH-BODY-26-01', 'HEAT-SS316-110', 'Scheduled post OP-10 roughing.', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (comp_id, branch_id, job_card_no) DO NOTHING;

SELECT setval('seq_job_card_id', GREATEST((SELECT COALESCE(MAX(job_card_id), 1006) FROM tbl_mfg_job_card), 1006));

-- Sample Operation Time Logs
INSERT INTO tbl_mfg_job_card_time_log (
    log_id, job_card_id, operator_id, machine_id,
    start_time, end_time, setup_mins, run_mins, downtime_mins, downtime_reason,
    completed_qty, scrapped_qty, rework_qty, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- Logs for JC 1001
    (1001, 1001, 1001, 1001,
     '2026-05-10 08:30:00+05:30', '2026-05-10 14:30:00+05:30',
     32.00, 340.00, 0.00, NULL,
     24.000, 1.000, 0.000, 'Shift 1: First half batch turning completed', TRUE,
     1001, 1001, 1001, 1001),

    (1002, 1001, 1001, 1001,
     '2026-05-10 15:00:00+05:30', '2026-05-10 21:00:00+05:30',
     0.00, 380.00, 15.00, 'Tool insert index and edge wear replacement',
     24.000, 1.000, 0.000, 'Shift 2: Remaining batch completed with 1 scrap unit', TRUE,
     1001, 1001, 1001, 1001),

    -- Log for JC 1002 (In Progress)
    (1003, 1002, 1001, 1002,
     '2026-05-11 09:00:00+05:30', '2026-05-11 15:00:00+05:30',
     22.00, 336.00, 0.00, NULL,
     28.000, 0.000, 0.000, 'Shift 1: 28 units completed; machine running smoothly', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (log_id) DO NOTHING;

SELECT setval('seq_job_card_time_log_id', GREATEST((SELECT COALESCE(MAX(log_id), 1003) FROM tbl_mfg_job_card_time_log), 1003));

-- ============================================================================
-- DATE: 2026-10-19
-- FEATURE: Step 6.8 - Sample Subcontractor Job-Work Challans & Inward Receipts
-- ============================================================================
INSERT INTO tbl_mfg_job_work_challan (
    challan_id, challan_no, challan_date, vendor_id, wo_id, wo_routing_op_id, job_card_id,
    nature_of_processing, from_warehouse_id, expected_return_date,
    transporter_name, vehicle_no, eway_bill_no, status,
    total_items, total_sent_qty, total_estimated_value,
    dispatched_by, dispatched_at, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- 1. Dispatched & Partially Received Challan
    (1001, 'JW-OUT-AHM-2627-0001', '2026-05-11', 1005, 1001, 1002, 1002,
     'Subcontract Induction Hardening & Cylindrical Grinding to 58-62 HRC',
     1003, '2026-05-20',
     'VRL Logistics Limited', 'GJ-01-BX-8842', '281099847162', 'PARTIALLY_RECEIVED',
     1, 50.000, 75000.00,
     1001, '2026-05-11 10:30:00+05:30', 'Dispatched under GST Rule 55 Delivery Challan for induction hardening.', TRUE,
     1001, 1001, 1001, 1001),

    -- 2. Fully Dispatched (Awaiting Inward Return)
    (1002, 'JW-OUT-AHM-2627-0002', '2026-05-13', 1005, 1002, 1005, 1005,
     'Internal Bore Chrome Plating & Nitriding',
     1003, '2026-05-25',
     'VRL Logistics Limited', 'GJ-01-CX-4102', '281099859012', 'DISPATCHED',
     1, 40.000, 160000.00,
     1001, '2026-05-13 14:15:00+05:30', 'Critical bore plating process outsourced to Micro Precision.', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (comp_id, branch_id, challan_no) DO NOTHING;

SELECT setval('seq_job_work_challan_id', GREATEST((SELECT COALESCE(MAX(challan_id), 1002) FROM tbl_mfg_job_work_challan), 1002));

-- Sample Outward Challan Line Items
INSERT INTO tbl_mfg_job_work_challan_item (
    challan_item_id, challan_id, item_id, item_description, uom_id,
    sent_qty, unit_rate, total_value, hsn_code, batch_no, heat_no,
    received_qty, scrap_returned_qty, loss_qty, pending_qty, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1003, 'SS-316 Gate Valve Spindle Shaft 2" Turned Blank', 1003,
     50.000, 1500.0000, 75000.00, '8481', 'BATCH-VALVE-26-01', 'HEAT-SS316-441',
     30.000, 1.000, 0.000, 19.000, '50 turned blanks sent; 30 received back with 1 scrap unit.', TRUE,
     1001, 1001, 1001, 1001),

    (1002, 1002, 1004, 'SS-316 Gate Valve Body Casting 2" Class 150', 1003,
     40.000, 4000.0000, 160000.00, '8481', 'BATCH-BODY-26-01', 'HEAT-SS316-110',
     0.000, 0.000, 0.000, 40.000, '40 valve bodies sent for nitriding; in processing at vendor plant.', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (challan_item_id) DO NOTHING;

SELECT setval('seq_job_work_challan_item_id', GREATEST((SELECT COALESCE(MAX(challan_item_id), 1002) FROM tbl_mfg_job_work_challan_item), 1002));

-- Sample Inward Job-Work Receipt
INSERT INTO tbl_mfg_job_work_receipt (
    receipt_id, receipt_no, receipt_date, challan_id, vendor_id, wo_id,
    vendor_dc_no, vendor_dc_date, vendor_invoice_no, to_warehouse_id,
    service_charges, tax_amount, total_amount, status,
    received_by, qc_inspected_by, qc_status, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'JW-IN-AHM-2627-0001', '2026-05-15', 1001, 1005, 1001,
     'MP-DC-2026-144', '2026-05-14', 'MP-INV-8891', 1003,
     10500.00, 1890.00, 12390.00, 'SUBMITTED',
     1001, 1001, 'ACCEPTED', 'Batch 1 of 30 spindle shafts received hardened to 60 HRC. QC Passed.', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (comp_id, branch_id, receipt_no) DO NOTHING;

SELECT setval('seq_job_work_receipt_id', GREATEST((SELECT COALESCE(MAX(receipt_id), 1001) FROM tbl_mfg_job_work_receipt), 1001));

-- Sample Inward Receipt Items
INSERT INTO tbl_mfg_job_work_receipt_item (
    receipt_item_id, receipt_id, challan_item_id, received_item_id, uom_id,
    received_qty, accepted_qty, rejected_qty, rework_qty, scrap_qty, loss_qty,
    processing_rate, processing_amount, batch_no, heat_no, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1001, 1003, 1003,
     30.000, 30.000, 0.000, 0.000, 1.000, 0.000,
     350.0000, 10500.00, 'BATCH-VALVE-26-01', 'HEAT-SS316-441', '30 good pieces + 1 scrap piece returned.', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (receipt_item_id) DO NOTHING;

SELECT setval('seq_job_work_receipt_item_id', GREATEST((SELECT COALESCE(MAX(receipt_item_id), 1001) FROM tbl_mfg_job_work_receipt_item), 1001));


-- ============================================================================
-- DATE: 2026-10-19
-- FEATURE: Step 6.9 - Finished Goods (FG) Production Receipt, Scrap/By-Product
--          Accounting & Absorption Cost Rollup (tbl_mfg_fg_receipt_header & tbl_mfg_fg_receipt_byproduct)
-- ============================================================================
INSERT INTO tbl_mfg_fg_receipt_header (
    fg_receipt_id, receipt_no, receipt_date, wo_id, item_id, uom_id,
    to_warehouse_id, to_bin_id, batch_no, heat_no, manufacturing_date, expiry_date,
    received_qty, accepted_qty, rejected_qty, rework_qty,
    qc_status, qc_inspected_by, qc_inspected_at, qc_remarks,
    material_cost, operation_cost, byproduct_credit, total_cost, unit_cost,
    status, posted_by, posted_at, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'FGR-AHM-2627-0001', '2026-04-25', 1001, 1008, 1003,
     1004, 1007, 'BAT-2026-VLV-001', 'HT-SS316-2026-04', '2026-04-25', NULL,
     10.000, 10.000, 0.000, 0.000,
     'ACCEPTED', 1001, '2026-04-25 14:30:00+05:30', 'Hydrostatic pressure tested at 1.5x rating. Zero leakage observed. Dimensional compliance verified.',
     22202.00, 7664.00, 500.00, 29366.00, 2936.6000,
     'POSTED', 1001, '2026-04-25 16:00:00+05:30', 'Initial finished production lot transferred to bonded FG warehouse.', TRUE,
     1001, 1001, 1001, 1001),

    (1002, 'FGR-AHM-2627-0002', '2026-04-27', 1001, 1008, 1003,
     1004, 1007, 'BAT-2026-VLV-001', 'HT-SS316-2026-05', '2026-04-27', NULL,
     15.000, 14.000, 1.000, 0.000,
     'PENDING', NULL, NULL, NULL,
     33303.00, 11496.00, 750.00, 44049.00, 3146.3571,
     'DRAFT', NULL, NULL, 'Batch 2 valve assembly awaiting final QA inspector signoff.', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (comp_id, branch_id, receipt_no) DO NOTHING;

SELECT setval('seq_fg_receipt_id', GREATEST((SELECT COALESCE(MAX(fg_receipt_id), 1002) FROM tbl_mfg_fg_receipt_header), 1002));

INSERT INTO tbl_mfg_fg_receipt_byproduct (
    receipt_byproduct_id, fg_receipt_id, item_id, uom_id, product_type,
    quantity, recovery_rate, total_recovery_value, to_warehouse_id, to_bin_id,
    remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1001, 1001, 'RECOVERABLE_SCRAP',
     5.000, 100.0000, 500.00, 1005, NULL,
     'SS-316 clean turning chips recovered during body face milling', TRUE,
     1001, 1001, 1001, 1001),

    (1002, 1002, 1001, 1001, 'RECOVERABLE_SCRAP',
     7.500, 100.0000, 750.00, 1005, NULL,
     'SS-316 machining swarf and chips', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (receipt_byproduct_id) DO NOTHING;

SELECT setval('seq_fg_receipt_byproduct_id', GREATEST((SELECT COALESCE(MAX(receipt_byproduct_id), 1002) FROM tbl_mfg_fg_receipt_byproduct), 1002));


-- ============================================================================
-- DATE: 2026-10-19
-- FEATURE: Step 7.1 - Customer Inquiry & Quotation / Proforma Invoice
--          (tbl_sales_quotation_header & tbl_sales_quotation_item)
-- ============================================================================
INSERT INTO tbl_sales_quotation_header (
    quotation_id, quotation_no, quotation_date, inquiry_ref_no, inquiry_date,
    customer_id, customer_name, contact_person, contact_email, contact_phone,
    billing_address_id, billing_address, shipping_address_id, shipping_address,
    shipping_state_code, shipping_state_name, customer_gstin, price_list_id,
    currency_code, exchange_rate, valid_until, delivery_lead_time_days,
    payment_terms, delivery_terms,
    subtotal_amount, discount_percent, discount_amount, taxable_amount,
    cgst_amount, sgst_amount, igst_amount, total_tax_amount,
    freight_charges, packaging_charges, round_off, grand_total,
    revision_no, status, submitted_by, submitted_at, sent_at, accepted_at,
    remarks, terms_and_conditions, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'QT-AHM-2627-0001', '2026-05-02', 'RFQ-MSIL-ENG-2026-441', '2026-04-28',
     1001, 'Maruti Suzuki India Limited', 'Rakesh Sharma (Head of SCM)', 'rakesh.sharma@maruti.co.in', '+91-9811012345',
     1001, '1, Nelson Mandela Road, Vasant Kunj, Phase II, New Delhi 110070',
     1002, 'Palam Gurgaon Road, Sector 18, Automotive Manufacturing Zone, Gurugram 122015',
     '06', 'Haryana', '06AAACM1234F1Z3', 1001,
     'INR', 1.0000, '2026-06-02', 21,
     'NET_45', 'FOR_DESTINATION',
     878750.00, 0.00, 0.00, 878750.00,
     0.00, 0.00, 246050.00, 246050.00,
     15000.00, 5000.00, 0.00, 1144800.00,
     0, 'SENT', 1001, '2026-05-02 16:30:00+05:30', '2026-05-03 10:15:00+05:30', NULL,
     'Annual Powertrain Hydromount Contract rate quotation with door delivery to Gurugram plant.',
     '1. Price validity: 30 days from quotation date. 2. Payment Terms: 45 days PDC from receipt of material. 3. Warranty: 18 months from supply or 12 months from commissioning.',
     TRUE, 1001, 1001, 1001, 1001),

    (1002, 'QT-AHM-2627-0002', '2026-05-04', 'RFQ-LNT-HAZ-2026-089', '2026-05-01',
     1002, 'Larsen & Toubro Limited - Heavy Engineering Division', 'Suresh Narayanan (VP Procurement)', 'suresh.n@lntvalves.com', '+91-9820054321',
     NULL, 'L&T House, Ballard Estate, Mumbai 400001',
     NULL, 'Hazira Manufacturing Complex, Surat Hazira Road, Gujarat 394510',
     '24', 'Gujarat', '24AAACL5678G1Z2', 1002,
     'INR', 1.0000, '2026-06-15', 14,
     'NET_30', 'EX_WORKS',
     164900.00, 0.00, 0.00, 164900.00,
     14841.00, 14841.00, 0.00, 29682.00,
     2500.00, 1500.00, 0.00, 198682.00,
     0, 'ACCEPTED', 1001, '2026-05-04 14:00:00+05:30', '2026-05-04 15:30:00+05:30', '2026-05-06 15:45:00+05:30',
     'Technical bid accepted by Hazira engineering committee. Commercial terms confirmed.',
     '1. Prices are Ex-Works Ahmedabad. 2. Third-party inspection (TPI) by Bureau Veritas included. 3. Hydrostatic test certificates to accompany dispatch.',
     TRUE, 1001, 1001, 1001, 1001),

    (1003, 'QT-AHM-2627-0003', '2026-05-08', 'RFQ-MSIL-ENG-2026-512', '2026-05-07',
     1001, 'Maruti Suzuki India Limited', 'Rakesh Sharma (Head of SCM)', 'rakesh.sharma@maruti.co.in', '+91-9811012345',
     1001, '1, Nelson Mandela Road, Vasant Kunj, Phase II, New Delhi 110070',
     1002, 'Palam Gurgaon Road, Sector 18, Automotive Manufacturing Zone, Gurugram 122015',
     '06', 'Haryana', '06AAACM1234F1Z3', 1001,
     'INR', 1.0000, '2026-06-08', 28,
     'NET_45', 'FOR_DESTINATION',
     2160000.00, 0.00, 0.00, 2160000.00,
     0.00, 0.00, 604800.00, 604800.00,
     25000.00, 8000.00, 0.00, 2797800.00,
     0, 'DRAFT', NULL, NULL, NULL, NULL,
     'High-volume hydromount quote revision pending internal tooling cost verification.',
     '1. Delivery in 4 monthly phased call-offs. 2. Packaging in returnable steel stillages.',
     TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (comp_id, branch_id, quotation_no, revision_no) DO NOTHING;

SELECT setval('seq_quotation_id', GREATEST((SELECT COALESCE(MAX(quotation_id), 1003) FROM tbl_sales_quotation_header), 1003));

INSERT INTO tbl_sales_quotation_item (
    quotation_item_id, quotation_id, item_sequence, item_id, item_code, item_name,
    description, hsn_sac_code, uom_id, quantity, unit_rate,
    gross_amount, discount_percent, discount_amount, taxable_amount,
    gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
    total_tax_amount, total_amount, delivery_lead_time_days, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1, 1009, 'FG-AUTO-MNT-DRV', 'Automotive Hydromount Powertrain Assembly',
     'OEM-spec liquid-filled vibration damping powertrain engine mount assembly',
     '8708', 1003, 500.000, 1850.0000,
     925000.00, 5.00, 46250.00, 878750.00,
     28.00, 0.00, 0.00, 0.00, 0.00, 28.00, 246050.00,
     246050.00, 1124800.00, 21, 'Batch 1 delivery within 3 weeks of PO signoff', TRUE,
     1001, 1001, 1001, 1001),

    (1002, 1002, 1, 1008, 'FG-GATE-VALVE-50', 'Industrial SS-316 Flanged Gate Valve 2" Class 150',
     'API 600 compliant stainless steel gate valve with handwheel actuator and hydrostatic test certificate',
     '8481', 1003, 25.000, 6800.0000,
     170000.00, 3.00, 5100.00, 164900.00,
     18.00, 9.00, 14841.00, 9.00, 14841.00, 0.00, 0.00,
     29682.00, 194582.00, 14, 'Flanges drilled as per ANSI B16.5 Class 150', TRUE,
     1001, 1001, 1001, 1001),

    (1003, 1003, 1, 1009, 'FG-AUTO-MNT-DRV', 'Automotive Hydromount Powertrain Assembly',
     'OEM-spec liquid-filled vibration damping powertrain engine mount assembly',
     '8708', 1003, 1200.000, 1800.0000,
     2160000.00, 0.00, 0.00, 2160000.00,
     28.00, 0.00, 0.00, 0.00, 0.00, 28.00, 604800.00,
     604800.00, 2764800.00, 28, 'Volume Tier 2 discount applied on base rate card', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (quotation_item_id) DO NOTHING;

SELECT setval('seq_quotation_item_id', GREATEST((SELECT COALESCE(MAX(quotation_item_id), 1003) FROM tbl_sales_quotation_item), 1003));


-- ============================================================================
-- Finished Goods Bin Stock Balances for ATP Reservation
-- ============================================================================
INSERT INTO tbl_inv_bin_stock (
    bin_stock_id, comp_id, branch_id, fyear_id,
    warehouse_id, bin_id, item_id, uom_id,
    batch_no, heat_no,
    on_hand_qty, reserved_qty, available_qty,
    unit_cost, total_valuation, last_stock_date,
    is_active, created_by
) VALUES
    (1003, 1001, 1001, 1001,
     1004, 1007, 1008, 1003,
     'BAT-2026-VLV-001', 'HT-SS316-2026-04',
     25.000, 25.000, 0.000,
     2936.6000, 73415.00, '2026-04-25 16:00:00+05:30',
     TRUE, 1001),
    (1004, 1001, 1001, 1001,
     1004, 1007, 1009, 1003,
     'BAT-2026-MNT-001', 'HT-MNT-2026-05',
     150.000, 100.000, 50.000,
     1450.0000, 217500.00, '2026-04-26 12:00:00+05:30',
     TRUE, 1001)
ON CONFLICT (warehouse_id, bin_id, item_id, batch_no) DO NOTHING;

SELECT setval('seq_bin_stock_id', GREATEST((SELECT COALESCE(MAX(bin_stock_id), 1004) FROM tbl_inv_bin_stock), 1004));


-- ============================================================================
-- DATE: 2026-10-19
-- FEATURE: Step 7.2 - Sales Order (SO), Commercial Credit Check & ATP Stock Reservation
--          (tbl_sales_order_header & tbl_sales_order_item)
-- ============================================================================
INSERT INTO tbl_sales_order_header (
    so_id, so_no, so_date, quotation_id,
    customer_id, customer_name, customer_po_no, customer_po_date,
    contact_person, contact_email, contact_phone,
    billing_address_id, billing_address, shipping_address_id, shipping_address,
    shipping_state_code, shipping_state_name, customer_gstin, price_list_id,
    currency_code, exchange_rate, target_delivery_date,
    payment_terms, delivery_terms,
    customer_credit_limit, current_credit_exposure, is_credit_limit_exceeded,
    credit_override_by, credit_override_at, credit_override_reason,
    subtotal_amount, discount_percent, discount_amount, taxable_amount,
    cgst_amount, sgst_amount, igst_amount, total_tax_amount,
    freight_charges, packaging_charges, round_off, grand_total,
    status, atp_reservation_status, confirmed_by, confirmed_at,
    hold_reason, remarks, terms_and_conditions, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'SO-AHM-2627-0001', '2026-05-04', 1001,
     1001, 'Maruti Suzuki India Limited', 'PO/MSIL/ENG/2026/09912', '2026-05-03',
     'Rakesh Sharma (Head of SCM)', 'rakesh.sharma@maruti.co.in', '+91-9811012345',
     1001, '1, Nelson Mandela Road, Vasant Kunj, Phase II, New Delhi 110070',
     1002, 'Palam Gurgaon Road, Sector 18, Automotive Manufacturing Zone, Gurugram 122015',
     '06', 'Haryana', '06AAACM1234F1Z3', 1001,
     'INR', 1.0000, '2026-05-25',
     'NET_45', 'FOR_DESTINATION',
     5000000.00, 1144800.00, FALSE,
     NULL, NULL, NULL,
     878750.00, 0.00, 0.00, 878750.00,
     0.00, 0.00, 246050.00, 246050.00,
     15000.00, 5000.00, 0.00, 1144800.00,
     'CONFIRMED', 'PARTIAL', 1001, '2026-05-04 11:30:00+05:30',
     NULL,
     'Firm purchase order received against Quotation QT-AHM-2627-0001. Partial ATP stock (100 units) reserved. Balance 400 units queued for work order generation.',
     '1. Prices include door delivery to Gurugram. 2. GST 28% applicable. 3. Warranty 18 months from supply.',
     TRUE, 1001, 1001, 1001, 1001),

    (1002, 'SO-AHM-2627-0002', '2026-05-06', 1002,
     1002, 'Larsen & Toubro Limited - Heavy Engineering Division', 'LNT/HAZ/VALVES/PO-8821', '2026-05-06',
     'Suresh Narayanan (VP Procurement)', 'suresh.n@lntvalves.com', '+91-9820054321',
     NULL, 'L&T House, Ballard Estate, Mumbai 400001',
     NULL, 'Hazira Manufacturing Complex, Surat Hazira Road, Gujarat 394510',
     '24', 'Gujarat', '24AAACL5678G1Z2', 1002,
     'INR', 1.0000, '2026-05-20',
     'NET_30', 'EX_WORKS',
     3500000.00, 198682.00, FALSE,
     NULL, NULL, NULL,
     164900.00, 0.00, 0.00, 164900.00,
     14841.00, 14841.00, 0.00, 29682.00,
     2500.00, 1500.00, 0.00, 198682.00,
     'READY_FOR_DISPATCH', 'FULL', 1001, '2026-05-06 16:00:00+05:30',
     NULL,
     'Complete stock of 25 units allocated from Batch BAT-2026-VLV-001. Packaged for Hazira pickup.',
     '1. Ex-works Ahmedabad. 2. Third-party inspection (TPI) certificate and hydrostatic test reports attached.',
     TRUE, 1001, 1001, 1001, 1001),

    (1003, 'SO-AHM-2627-0003', '2026-05-10', NULL,
     1001, 'Maruti Suzuki India Limited', 'PO/MSIL/ENG/2026/09988', '2026-05-09',
     'Rakesh Sharma (Head of SCM)', 'rakesh.sharma@maruti.co.in', '+91-9811012345',
     1001, '1, Nelson Mandela Road, Vasant Kunj, Phase II, New Delhi 110070',
     1002, 'Palam Gurgaon Road, Sector 18, Automotive Manufacturing Zone, Gurugram 122015',
     '06', 'Haryana', '06AAACM1234F1Z3', 1001,
     'INR', 1.0000, '2026-06-01',
     'NET_45', 'FOR_DESTINATION',
     5000000.00, 1602720.00, FALSE,
     NULL, NULL, NULL,
     351500.00, 0.00, 0.00, 351500.00,
     0.00, 0.00, 98420.00, 98420.00,
     6000.00, 2000.00, 0.00, 457920.00,
     'DRAFT', 'PENDING', NULL, NULL,
     NULL,
     'Direct spot purchase order received for 200 hydromount units. Pending commercial confirmation and credit approval.',
     'Standard MSIL OEM purchase order terms & vendor code of conduct apply.',
     TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (comp_id, branch_id, so_no) DO NOTHING;

SELECT setval('seq_sales_order_id', GREATEST((SELECT COALESCE(MAX(so_id), 1003) FROM tbl_sales_order_header), 1003));

INSERT INTO tbl_sales_order_item (
    so_item_id, so_id, item_sequence, item_id, item_code, item_name,
    description, hsn_sac_code, uom_id,
    ordered_qty, reserved_qty, delivered_qty, invoiced_qty, cancelled_qty,
    unit_rate, gross_amount, discount_percent, discount_amount, taxable_amount,
    gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
    total_tax_amount, total_amount, target_delivery_date,
    reservation_status, work_order_id, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1, 1009, 'FG-AUTO-MNT-DRV', 'Automotive Hydromount Powertrain Assembly',
     'OEM-spec liquid-filled vibration damping powertrain engine mount assembly',
     '8708', 1003,
     500.000, 100.000, 0.000, 0.000, 0.000,
     1850.0000, 925000.00, 5.00, 46250.00, 878750.00,
     28.00, 0.00, 0.00, 0.00, 0.00, 28.00, 246050.00,
     246050.00, 1124800.00, '2026-05-25',
     'PARTIAL', NULL,
     '100 units reserved from FG warehouse bin. Remaining 400 to be manufactured.', TRUE,
     1001, 1001, 1001, 1001),

    (1002, 1002, 1, 1008, 'FG-GATE-VALVE-50', 'Industrial SS-316 Flanged Gate Valve 2" Class 150',
     'API 600 compliant stainless steel gate valve with handwheel actuator and hydrostatic test certificate',
     '8481', 1003,
     25.000, 25.000, 0.000, 0.000, 0.000,
     6800.0000, 170000.00, 3.00, 5100.00, 164900.00,
     18.00, 9.00, 14841.00, 9.00, 14841.00, 0.00, 0.00,
     29682.00, 194582.00, '2026-05-20',
     'FULL', 1001,
     'Fully reserved from Batch BAT-2026-VLV-001. Packaged for delivery.', TRUE,
     1001, 1001, 1001, 1001),

    (1003, 1003, 1, 1009, 'FG-AUTO-MNT-DRV', 'Automotive Hydromount Powertrain Assembly',
     'OEM-spec liquid-filled vibration damping powertrain engine mount assembly',
     '8708', 1003,
     200.000, 0.000, 0.000, 0.000, 0.000,
     1850.0000, 370000.00, 5.00, 18500.00, 351500.00,
     28.00, 0.00, 0.00, 0.00, 0.00, 28.00, 98420.00,
     98420.00, 449920.00, '2026-06-01',
     'PENDING', NULL,
     'Draft order pending credit clearance and confirmation.', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (so_item_id) DO NOTHING;

SELECT setval('seq_so_item_id', GREATEST((SELECT COALESCE(MAX(so_item_id), 1003) FROM tbl_sales_order_item), 1003));



-- ============================================================================
-- Phase 7: Step 7.3 — Outward Sales Delivery Challans (tbl_sales_delivery_challan_header / item)
-- ============================================================================
INSERT INTO tbl_sales_delivery_challan_header (
    challan_id, challan_no, challan_date, so_id, so_no,
    customer_id, customer_name, contact_person, contact_phone,
    billing_address_id, billing_address, shipping_address_id, shipping_address,
    shipping_state_code, shipping_state_name, customer_gstin,
    dispatch_purpose, transporter_id, transporter_name, vehicle_no,
    lr_rr_no, lr_rr_date, e_way_bill_no, e_way_bill_date,
    delivery_terms, total_packages, package_type, gross_weight_kg, net_weight_kg,
    warehouse_id, total_quantity, total_value, status,
    picked_by, picked_at, packed_by, packed_at, dispatched_by, dispatched_at,
    remarks, terms_and_conditions, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'DC-AHM-2627-0001', '2026-05-18', 1002, 'SO-AHM-2627-0002',
     1002, 'Larsen & Toubro Ltd - Heavy Engineering Division', 'Mr. Rajesh K. Mehta', '+91 98250 11223',
     1003, 'L&T Hazira Manufacturing Complex, Surat-Hazira Road, Surat, Gujarat 394510',
     1003, 'L&T Hazira Manufacturing Complex, Surat-Hazira Road, Surat, Gujarat 394510',
     '24', 'Gujarat', '24AAACL0149P1ZM',
     'SUPPLY_ON_SALE', 1004, 'V-Trans (India) Limited', 'GJ-01-BX-8821',
     'LR-789012', '2026-05-18', 'EWB-2627-891023', '2026-05-18',
     'EX_WORKS', 2, 'Wooden Crates', 320.000, 300.000,
     1001, 25.000, 164900.00, 'DISPATCHED',
     1001, '2026-05-18 10:15:00+05:30', 1001, '2026-05-18 11:45:00+05:30', 1001, '2026-05-18 14:30:00+05:30',
     'Full dispatch for SO-AHM-2627-0002. Dispatched via dedicated open-body truck with hydrostatic test certificates and warranty cards.',
     'Goods dispatched in sound condition per Rule 55 of CGST Rules 2017. Acceptance of delivery constitutes acceptance of commercial invoice terms.',
     TRUE, 1001, 1001, 1001, 1001),

    (1002, 'DC-AHM-2627-0002', '2026-05-19', 1001, 'SO-AHM-2627-0001',
     1001, 'Maruti Suzuki India Limited', 'Mr. Vikram Singhania', '+91 98110 54321',
     1001, '1, Nelson Mandela Road, Vasant Kunj, New Delhi 110070',
     1002, 'Plot No. 1, Phase 3A, IMT Manesar, Gurugram, Haryana 122051',
     '06', 'Haryana', '07AABCM8529R1ZE',
     'SUPPLY_ON_SALE', 1004, 'V-Trans (India) Limited', 'GJ-06-TY-4412',
     'LR-789456', '2026-05-19', 'EWB-2627-891055', '2026-05-19',
     'FOR_DESTINATION', 5, 'Heavy Corrugated Cartons', 155.000, 140.000,
     1001, 50.000, 87875.00, 'PACKED',
     1001, '2026-05-19 09:30:00+05:30', 1001, '2026-05-19 11:00:00+05:30', NULL, NULL,
     'First partial lot of 50 hydromount assemblies packed and staged in Outward Bay 2. Awaiting transporter vehicle placement for gate dispatch.',
     'Material subject to destination inward inspection at MSIL Manesar plant.',
     TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (comp_id, branch_id, challan_no) DO NOTHING;

SELECT setval('seq_delivery_challan_id', GREATEST((SELECT COALESCE(MAX(challan_id), 1002) FROM tbl_sales_delivery_challan_header), 1002));

INSERT INTO tbl_sales_delivery_challan_item (
    challan_item_id, challan_id, so_item_id, item_sequence,
    item_id, item_code, item_name, description, hsn_sac_code, uom_id,
    ordered_qty, dispatched_qty, warehouse_id, bin_id, batch_no, heat_no,
    unit_rate, total_amount, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1002, 1,
     1008, 'FG-GATE-VALVE-50', 'Industrial SS-316 Flanged Gate Valve 2" Class 150',
     'API 600 compliant stainless steel gate valve with handwheel actuator and hydrostatic test certificate',
     '8481', 1003,
     25.000, 25.000, 1001, 1003, 'BAT-2026-VLV-001', 'HT-7821',
     6596.0000, 164900.00, '25 units picked from Bin A-01-01 and loaded into Crate 1 & 2', TRUE,
     1001, 1001, 1001, 1001),

    (1002, 1002, 1001, 1,
     1009, 'FG-AUTO-MNT-DRV', 'Automotive Hydromount Powertrain Assembly',
     'OEM-spec liquid-filled vibration damping powertrain engine mount assembly',
     '8708', 1003,
     500.000, 50.000, 1001, 1004, 'BAT-2026-MNT-001', 'HT-MNT-44',
     1757.5000, 87875.00, '50 units packed in 5 cartons (10 pcs/box)', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (challan_item_id) DO NOTHING;

SELECT setval('seq_challan_item_id', GREATEST((SELECT COALESCE(MAX(challan_item_id), 1002) FROM tbl_sales_delivery_challan_item), 1002));

-- Update delivered_qty and status for SO-AHM-2627-0002 (so_id = 1002)
UPDATE tbl_sales_order_item
SET delivered_qty = 25.000,
    reserved_qty = 0.000
WHERE so_item_id = 1002;

UPDATE tbl_sales_order_header
SET status = 'COMPLETED',
    atp_reservation_status = 'FULL'
WHERE so_id = 1002;

-- Record stock ledger outward dispatch for DC 1001
INSERT INTO tbl_inv_stock_ledger (
    comp_id, branch_id, fyear_id, transaction_date,
    transaction_type, reference_doc_type, reference_doc_id, reference_doc_no,
    warehouse_id, from_bin_id, to_bin_id, item_id, uom_id,
    batch_no, heat_no, qty_in, qty_out, unit_cost, total_cost, closing_balance,
    remarks, is_active, created_by
) VALUES (
    1001, 1001, 1001, '2026-05-18 14:30:00+05:30',
    'SALES_DISPATCH', 'DELIVERY_CHALLAN', 1001, 'DC-AHM-2627-0001',
    1001, 1003, NULL, 1008, 1003,
    'BAT-2026-VLV-001', 'HT-7821', 0.000, 25.000, 5800.0000, 145000.00, 15.000,
    'Outward sales dispatch against Delivery Challan DC-AHM-2627-0001', TRUE, 1001
);

-- Deduct on-hand stock and reserved stock in tbl_inv_bin_stock for bin 1003
UPDATE tbl_inv_bin_stock
SET on_hand_qty = GREATEST(0, on_hand_qty - 25.000),
    reserved_qty = GREATEST(0, reserved_qty - 25.000),
    available_qty = GREATEST(0, on_hand_qty - 25.000) - GREATEST(0, reserved_qty - 25.000),
    last_stock_date = CURRENT_TIMESTAMP
WHERE bin_id = 1003 AND item_id = 1008;


-- ============================================================================
-- Phase 7: Step 7.4 — Demo Sales Tax Invoices & Customer AR Payment Receipts
-- ============================================================================
INSERT INTO tbl_sales_invoice_header (
    invoice_id, invoice_no, invoice_date, invoice_type, challan_id, so_id,
    customer_id, customer_name, contact_person, contact_phone,
    billing_address_id, billing_address, shipping_address_id, shipping_address,
    place_of_supply, customer_gstin, customer_pan, supply_type, reverse_charge_applicable,
    transporter_name, vehicle_no, lr_rr_no, lr_rr_date,
    irn_status, irn_no, ack_no, ack_date, signed_qr_code, e_way_bill_no, e_way_bill_date,
    payment_terms_days, due_date, currency_code,
    subtotal_amount, discount_amount, taxable_amount,
    cgst_amount, sgst_amount, igst_amount, total_tax_amount,
    freight_charges, insurance_charges, packaging_charges,
    tcs_rate, tcs_amount, round_off,
    total_invoice_amount, paid_amount, balance_amount,
    status, payment_status, posted_by, posted_at,
    remarks, terms_and_conditions, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    -- Invoice 1001: Dispatched against DC-AHM-2627-0001 to L&T (Intra-state Gujarat), Posted, IRN Generated, Partially Paid
    (1001, 'INV-AHM-2627-0001', '2026-05-18', 'TAX_INVOICE', 1001, 1002,
     1002, 'Larsen & Toubro Limited - Heavy Engineering Division', 'Mr. Rajesh Desai', '+91-265-2834567',
     1002, 'Gate No. 4, L&T Heavy Engineering Complex, Ranoli, Vadodara, Gujarat - 391750',
     1002, 'Gate No. 4, L&T Heavy Engineering Complex, Ranoli, Vadodara, Gujarat - 391750',
     '24 - Gujarat', '24AAACL0149A1ZW', 'AAACL0149A', 'INTRA_STATE', FALSE,
     'V-Trans India Ltd', 'GJ-06-AX-8942', 'VT-BRD-89104', '2026-05-18',
     'GENERATED', 'c4b12a89d3e871e41f69209581c74a0e98f0293817456bc912384a78129034ef', '1126101984291', '2026-05-18 16:15:00+05:30',
     '{"Irn":"c4b12a89d3e871e41f69209581c74a0e98f0293817456bc912384a78129034ef","SellerGstin":"24AABCK1234F1Z5","BuyerGstin":"24AAACL0149A1ZW","DocNo":"INV-AHM-2627-0001","DocTyp":"INV","DocDt":"18/05/2026","TotInvVal":194582.00,"ItemCnt":1,"MainHsnCode":"8481"}',
     '241829304918', '2026-05-18',
     30, '2026-06-17', 'INR',
     164900.00, 0.00, 164900.00,
     14841.00, 14841.00, 0.00, 29682.00,
     0.00, 0.00, 0.00,
     0.000, 0.00, 0.00,
     194582.00, 100000.00, 94582.00,
     'POSTED', 'PARTIALLY_PAID', 1001, '2026-05-18 16:30:00+05:30',
     'Tax Invoice against Outward Delivery Challan DC-AHM-2627-0001 for 25 Gate Valves.',
     '1. Payment due within 30 days of invoice date. 2. Interest @ 18% p.a. chargeable on overdue bills.',
     TRUE, 1001, 1001, 1001, 1001),

    -- Invoice 1002: Billed against SO-AHM-2627-0001 (Maruti Suzuki, Haryana - Inter-state), Draft
    (1002, 'INV-AHM-2627-0002', '2026-05-19', 'TAX_INVOICE', NULL, 1001,
     1001, 'Maruti Suzuki India Limited', 'Mr. Vikram Malhotra', '+91-124-4321000',
     1001, 'Plot No. 1, Maruti Joint Venture Complex, Sector 18, Gurugram, Haryana - 122015',
     1001, 'Plot No. 1, Maruti Joint Venture Complex, Sector 18, Gurugram, Haryana - 122015',
     '06 - Haryana', '06AAAAC1234F1Z2', 'AAAAC1234F', 'INTER_STATE', FALSE,
     'SafeXpress Logistics', 'HR-55-AB-7788', 'SX-GGN-78129', '2026-05-19',
     'NOT_GENERATED', NULL, NULL, NULL, NULL, '061928374612', '2026-05-19',
     30, '2026-06-18', 'INR',
     87875.00, 0.00, 87875.00,
     0.00, 0.00, 15817.50, 15817.50,
     0.00, 0.00, 0.00,
     0.000, 0.00, 0.50,
     103693.00, 0.00, 103693.00,
     'DRAFT', 'UNPAID', NULL, NULL,
     'Commercial tax invoice for lot of 50 Automotive Hydromount Assemblies against SO-AHM-2627-0001.',
     '1. Payment due within 30 days. 2. Subject to Ahmedabad jurisdiction.',
     TRUE, 1001, 1001, 1001, 1001)
ON CONFLICT (comp_id, branch_id, invoice_no) DO NOTHING;

SELECT setval('seq_sales_invoice_id', GREATEST((SELECT COALESCE(MAX(invoice_id), 1002) FROM tbl_sales_invoice_header), 1002));

INSERT INTO tbl_sales_invoice_item (
    invoice_item_id, invoice_id, so_item_id, challan_item_id, item_sequence,
    item_id, item_code, item_name, description, hsn_sac_code, uom_id,
    quantity, unit_rate, gross_amount, discount_percent, discount_amount, taxable_amount,
    gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
    total_tax_amount, total_item_amount, batch_no, heat_no, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1002, 1001, 1,
     1008, 'FG-GATE-VALVE-50', 'Industrial SS-316 Flanged Gate Valve 2" Class 150',
     'API 600 compliant stainless steel gate valve with handwheel actuator and hydrostatic test certificate',
     '8481', 1003,
     25.000, 6596.0000, 164900.00, 0.00, 0.00, 164900.00,
     18.00, 9.00, 14841.00, 9.00, 14841.00, 0.00, 0.00,
     29682.00, 194582.00, 'BAT-2026-VLV-001', 'HT-7821', 'Dispatched per DC-AHM-2627-0001', TRUE,
     1001, 1001, 1001, 1001),

    (1002, 1002, 1001, NULL, 1,
     1009, 'FG-AUTO-MNT-DRV', 'Automotive Hydromount Powertrain Assembly',
     'OEM-spec liquid-filled vibration damping powertrain engine mount assembly',
     '8708', 1003,
     50.000, 1757.5000, 87875.00, 0.00, 0.00, 87875.00,
     18.00, 0.00, 0.00, 0.00, 0.00, 18.00, 15817.50,
     15817.50, 103692.50, 'BAT-2026-MNT-001', 'HT-MNT-44', 'Lot 1 of 500 under SO-AHM-2627-0001', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (invoice_item_id) DO NOTHING;

SELECT setval('seq_sales_invoice_item_id', GREATEST((SELECT COALESCE(MAX(invoice_item_id), 1002) FROM tbl_sales_invoice_item), 1002));

-- Customer AR Payment Receipt (tbl_sales_ar_payment_receipt)
INSERT INTO tbl_sales_ar_payment_receipt (
    payment_id, receipt_no, receipt_date, invoice_id, customer_id,
    payment_mode, reference_no, payment_amount, tds_amount, total_allocated_amount,
    bank_name, cheque_date, remarks, recorded_by, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'REC-AHM-2627-0001', '2026-05-25', 1001, 1002,
     'NEFT_RTGS', 'HDFCR52026052500912', 100000.00, 0.00, 100000.00,
     'HDFC Bank Ltd', NULL, 'On-account partial payment received via RTGS against INV-AHM-2627-0001', 1001, TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (comp_id, branch_id, receipt_no) DO NOTHING;

SELECT setval('seq_ar_payment_id', GREATEST((SELECT COALESCE(MAX(payment_id), 1001) FROM tbl_sales_ar_payment_receipt), 1001));

-- Synchronize invoiced_qty on Sales Order Item 1002
UPDATE tbl_sales_order_item
SET invoiced_qty = 25.000
WHERE so_item_id = 1002;

-- ============================================================================
-- Phase 7: Step 7.5 — Sales Return, RMA & Statutory GST Credit Note (tbl_sales_return_header & tbl_sales_return_item)
-- ============================================================================
INSERT INTO tbl_sales_return_header (
    return_id, return_no, return_date, return_type,
    credit_note_no, credit_note_date,
    invoice_id, invoice_no, invoice_date,
    customer_id, customer_name, customer_gstin, customer_pan,
    billing_address, billing_city, billing_state, billing_pincode, billing_state_code,
    place_of_supply, pos_state_code,
    rma_reference_no, rma_reference_date,
    gate_entry_no, gate_entry_date,
    vehicle_no, transporter_name, lr_no, lr_date,
    currency_code, exchange_rate,
    subtotal_amount, discount_amount, taxable_amount,
    cgst_amount, sgst_amount, igst_amount, round_off_amount,
    total_credit_amount, ar_adjusted_amount,
    irn_status, irn_no, ack_no, ack_date, signed_qr_code,
    return_reason,
    qc_status, qc_inspected_by, qc_inspected_at, qc_remarks,
    restock_status, restocked_by, restocked_at,
    credit_note_status, credit_posted_by, credit_posted_at,
    status, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 'SR-AHM-2627-0001', '2026-05-28', 'QUALITY_REJECTION',
     'CN-AHM-2627-0001', '2026-05-29',
     1001, 'INV-AHM-2627-0001', '2026-05-20',
     1002, 'Larsen & Toubro Heavy Engineering Ltd', '24AAACL1234F1Z8', 'AAACL1234F',
     'Hazira Manufacturing Complex, Surat-Hazira Road', 'Surat', 'Gujarat', '394510', '24',
     'Gujarat (24)', '24',
     'LT-RMA-2627-04', '2026-05-26',
     'GE-IN-2627-088', '2026-05-27',
     'GJ-05-BT-4412', 'V-Trans India Ltd', 'VT-SUR-99021', '2026-05-27',
     'INR', 1.0000,
     13192.00, 0.00, 13192.00,
     1187.28, 1187.28, 0.00, -0.56,
     15566.00, 15566.00,
     'GENERATED', 'e4d7a8b9c0123456789abcdef0123456789abcdef0123456789abcdef0123456', '142627000098124', '2026-05-29 11:20:00+05:30', 'eyJwYXlsb2FkIjoie1wic2VsbGVyR3N0aW5cIjpcIjI0QUFBQ0sxMjM0QzFaNVwiLFwiZG9jTm9cIjpcIkNOLUFITS0yNjI3LTAwMDFcIn0ifQ==',
     '2 valves returned from lot of 25: 1 flange lap blemish (reworkable/restockable) & 1 casting wall porosity leak',
     'PARTIALLY_ACCEPTED', 1001, '2026-05-28 15:30:00+05:30', 'Pressure decay test: Valve #1 meets API 598 seat seal; Valve #2 failed hydrostatic body shell test. 1 unit restocked to Bin FG-BAY-01, 1 scrapped.',
     'RESTOCKED', 1001, '2026-05-29 14:00:00+05:30',
     'POSTED', 1001, '2026-05-29 16:00:00+05:30',
     'COMPLETED', 'Statutory GST Credit Note issued per Sec 34. Adjusted ₹15,566 against INV-AHM-2627-0001 AR balance.', TRUE,
     1001, 1001, 1001, 1001),

    (1002, 'SR-AHM-2627-0002', '2026-06-02', 'TRANSIT_DAMAGE',
     NULL, NULL,
     1002, 'INV-AHM-2627-0002', '2026-05-22',
     1001, 'Maruti Suzuki India Limited', '06AAAAC1234G1Z2', 'AAAAC1234G',
     'Plot No. 1, Nelson Mandela Road, Vasant Kunj', 'New Delhi', 'Delhi', '110070', '07',
     'Haryana (06)', '06',
     'MSIL-RMA-2627-11', '2026-06-01',
     'GE-IN-2627-095', '2026-06-02',
     'HR-55-E-8812', 'Safexpress Pvt Ltd', 'SFX-DEL-55109', '2026-06-01',
     'INR', 1.0000,
     8787.50, 0.00, 8787.50,
     0.00, 0.00, 1581.75, 0.25,
     10369.50, 0.00,
     'NOT_APPLICABLE', NULL, NULL, NULL, NULL,
     '5 powertrain hydromount assemblies damaged during carrier transit - torn elastomer bellows',
     'PENDING', NULL, NULL, NULL,
     'PENDING', NULL, NULL,
     'DRAFT', NULL, NULL,
     'DRAFT', 'RMA shipment staged in Central Inward Quarantine Bay awaiting technical tear-down review', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (comp_id, branch_id, return_no) DO NOTHING;

SELECT setval('seq_sales_return_id', GREATEST((SELECT COALESCE(MAX(return_id), 1002) FROM tbl_sales_return_header), 1002));

-- Sales Return Line Items
INSERT INTO tbl_sales_return_item (
    return_item_id, return_id, invoice_item_id, item_sequence,
    item_id, item_code, item_name, description, hsn_sac_code, uom_id,
    invoiced_qty, returned_qty, accepted_qty, rejected_scrap_qty,
    unit_price, discount_percent, discount_amount, taxable_amount,
    gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
    line_total, target_warehouse_id, target_bin_id,
    batch_no, heat_no, defect_type, qc_verdict, action_taken, remarks, is_active,
    comp_id, branch_id, fyear_id, created_by
) VALUES
    (1001, 1001, 1001, 1,
     1008, 'FG-GATE-VALVE-50', 'Industrial SS-316 Flanged Gate Valve 2" Class 150',
     'API 600 compliant stainless steel gate valve with handwheel actuator', '8481', 1003,
     25.000, 2.000, 1.000, 1.000,
     6596.0000, 0.00, 0.00, 13192.00,
     18.00, 9.00, 1187.28, 9.00, 1187.28, 0.00, 0.00,
     15566.56, 1004, 1007,
     'BAT-2026-VLV-001', 'HT-7821', 'SURFACE_AND_POROSITY', 'ACCEPT_FOR_RESTOCK',
     '1 unit lap-polished & re-tested for bin restock; 1 unit tagged for scrap metallographic review',
     'QC clearance certificate QC-RMA-2627-001', TRUE,
     1001, 1001, 1001, 1001),

    (1002, 1002, 1002, 1,
     1009, 'FG-AUTO-MNT-DRV', 'Automotive Hydromount Powertrain Assembly',
     'OEM-spec liquid-filled vibration damping powertrain engine mount assembly', '8708', 1003,
     50.000, 5.000, 0.000, 0.000,
     1757.5000, 0.00, 0.00, 8787.50,
     18.00, 0.00, 0.00, 0.00, 0.00, 18.00, 1581.75,
     10369.25, 1004, 1007,
     'BAT-2026-MNT-001', 'HT-MNT-44', 'TRANSIT_CRUSH', 'PENDING',
     'Awaiting QC physical tear-down inspection',
     'Physical goods staged in Bay Q-01', TRUE,
     1001, 1001, 1001, 1001)
ON CONFLICT (return_item_id) DO NOTHING;

SELECT setval('seq_sales_return_item_id', GREATEST((SELECT COALESCE(MAX(return_item_id), 1002) FROM tbl_sales_return_item), 1002));

-- Adjust INV-AHM-2627-0001 balance for Credit Note CN-AHM-2627-0001
UPDATE tbl_sales_invoice_header
SET balance_amount = 79016.00,
    paid_amount = 100000.00
WHERE invoice_id = 1001;

-- Update Bin Stock for Restocked 1 Valve (Bin 1007, Item 1008)
UPDATE tbl_inv_bin_stock
SET on_hand_qty = 1.000,
    available_qty = 1.000,
    total_valuation = 2936.60
WHERE warehouse_id = 1004 AND bin_id = 1007 AND item_id = 1008 AND batch_no = 'BAT-2026-VLV-001';

-- Post Stock Ledger Inward for Restocked Sales Return
INSERT INTO tbl_inv_stock_ledger (
    comp_id, branch_id, fyear_id, transaction_date, transaction_type,
    reference_doc_type, reference_doc_id, reference_doc_no,
    warehouse_id, to_bin_id, item_id, uom_id,
    batch_no, heat_no, qty_in, qty_out, unit_cost, total_cost, remarks, created_by
) VALUES (
    1001, 1001, 1001, '2026-05-29 14:00:00+05:30', 'SALES_RETURN',
    'SALES_RETURN', 1001, 'SR-AHM-2627-0001',
    1004, 1007, 1008, 1003,
    'BAT-2026-VLV-001', 'HT-7821', 1.000, 0.000, 2936.6000, 2936.60,
    'Sales return restock inward from SR-AHM-2627-0001 (1 unit accepted after lap-polish QC)', 1001
);


