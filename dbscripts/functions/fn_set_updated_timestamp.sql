-- ============================================================================
-- KS-MFG ERP: Function - fn_set_updated_timestamp
-- File: dbscripts/functions/fn_set_updated_timestamp.sql
-- Date: 2026-10-17
-- Description: Automatically updates the updated_date column to CURRENT_TIMESTAMP
--              whenever a row is modified via an UPDATE statement.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_set_updated_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_date = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;
