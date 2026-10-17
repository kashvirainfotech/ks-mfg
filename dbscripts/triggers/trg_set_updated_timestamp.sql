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
