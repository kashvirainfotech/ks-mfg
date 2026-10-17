-- ============================================================================
-- KS-MFG ERP: Triggers - trg_set_updated_timestamp
-- File: dbscripts/triggers/trg_set_updated_timestamp.sql
-- Date: 2026-10-17
-- Description: Binds fn_set_updated_timestamp() BEFORE UPDATE trigger to core
--              organization, security, and preference tables.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_org_company_updated_date ON tbl_org_company;
CREATE TRIGGER trg_org_company_updated_date
BEFORE UPDATE ON tbl_org_company
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_org_branch_updated_date ON tbl_org_branch;
CREATE TRIGGER trg_org_branch_updated_date
BEFORE UPDATE ON tbl_org_branch
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_org_financial_year_updated_date ON tbl_org_financial_year;
CREATE TRIGGER trg_org_financial_year_updated_date
BEFORE UPDATE ON tbl_org_financial_year
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_org_branch_fyear_updated_date ON tbl_org_branch_fyear;
CREATE TRIGGER trg_org_branch_fyear_updated_date
BEFORE UPDATE ON tbl_org_branch_fyear
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_sec_role_updated_date ON tbl_sec_role;
CREATE TRIGGER trg_sec_role_updated_date
BEFORE UPDATE ON tbl_sec_role
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_sec_user_updated_date ON tbl_sec_user;
CREATE TRIGGER trg_sec_user_updated_date
BEFORE UPDATE ON tbl_sec_user
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_sec_user_preference_updated_date ON tbl_sec_user_preference;
CREATE TRIGGER trg_sec_user_preference_updated_date
BEFORE UPDATE ON tbl_sec_user_preference
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.1 - Triggers for tbl_hr_department and tbl_hr_designation
-- ============================================================================
DROP TRIGGER IF EXISTS trg_hr_department_updated_date ON tbl_hr_department;
CREATE TRIGGER trg_hr_department_updated_date
BEFORE UPDATE ON tbl_hr_department
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_hr_designation_updated_date ON tbl_hr_designation;
CREATE TRIGGER trg_hr_designation_updated_date
BEFORE UPDATE ON tbl_hr_designation
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.2 - Trigger for tbl_hr_employee
-- ============================================================================
DROP TRIGGER IF EXISTS trg_hr_employee_updated_date ON tbl_hr_employee;
CREATE TRIGGER trg_hr_employee_updated_date
BEFORE UPDATE ON tbl_hr_employee
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.6 - Triggers for tbl_sys_config & tbl_sys_doc_number_series
-- ============================================================================
DROP TRIGGER IF EXISTS trg_sys_config_updated_date ON tbl_sys_config;
CREATE TRIGGER trg_sys_config_updated_date
BEFORE UPDATE ON tbl_sys_config
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_sys_doc_series_updated_date ON tbl_sys_doc_number_series;
CREATE TRIGGER trg_sys_doc_series_updated_date
BEFORE UPDATE ON tbl_sys_doc_number_series
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

