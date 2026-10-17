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




