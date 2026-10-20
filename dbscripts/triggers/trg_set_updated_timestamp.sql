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

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 3.1 - Triggers for tbl_inv_warehouse & tbl_inv_storage_bin
-- ============================================================================
DROP TRIGGER IF EXISTS trg_inv_warehouse_updated_date ON tbl_inv_warehouse;
CREATE TRIGGER trg_inv_warehouse_updated_date
BEFORE UPDATE ON tbl_inv_warehouse
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_inv_storage_bin_updated_date ON tbl_inv_storage_bin;
CREATE TRIGGER trg_inv_storage_bin_updated_date
BEFORE UPDATE ON tbl_inv_storage_bin
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 3.2 - Triggers for tbl_inv_uom, tbl_inv_uom_conversion & tbl_inv_item_category
-- ============================================================================
DROP TRIGGER IF EXISTS trg_inv_uom_updated_date ON tbl_inv_uom;
CREATE TRIGGER trg_inv_uom_updated_date
BEFORE UPDATE ON tbl_inv_uom
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_inv_uom_conversion_updated_date ON tbl_inv_uom_conversion;
CREATE TRIGGER trg_inv_uom_conversion_updated_date
BEFORE UPDATE ON tbl_inv_uom_conversion
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_inv_item_category_updated_date ON tbl_inv_item_category;
CREATE TRIGGER trg_inv_item_category_updated_date
BEFORE UPDATE ON tbl_inv_item_category
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_inv_item_updated_date ON tbl_inv_item;
CREATE TRIGGER trg_inv_item_updated_date
BEFORE UPDATE ON tbl_inv_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_crm_party_updated_date ON tbl_crm_party;
CREATE TRIGGER trg_crm_party_updated_date
BEFORE UPDATE ON tbl_crm_party
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_crm_party_address_updated_date ON tbl_crm_party_address;
CREATE TRIGGER trg_crm_party_address_updated_date
BEFORE UPDATE ON tbl_crm_party_address
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();






DROP TRIGGER IF EXISTS trg_crm_price_list_updated_date ON tbl_crm_price_list;
CREATE TRIGGER trg_crm_price_list_updated_date
BEFORE UPDATE ON tbl_crm_price_list
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_crm_price_list_item_updated_date ON tbl_crm_price_list_item;
CREATE TRIGGER trg_crm_price_list_item_updated_date
BEFORE UPDATE ON tbl_crm_price_list_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_crm_party_price_list_updated_date ON tbl_crm_party_price_list;
CREATE TRIGGER trg_crm_party_price_list_updated_date
BEFORE UPDATE ON tbl_crm_party_price_list
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_pr_header_updated_date ON tbl_pr_header;
CREATE TRIGGER trg_pr_header_updated_date
BEFORE UPDATE ON tbl_pr_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_pr_item_updated_date ON tbl_pr_item;
CREATE TRIGGER trg_pr_item_updated_date
BEFORE UPDATE ON tbl_pr_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_rfq_header_updated_date ON tbl_rfq_header;
CREATE TRIGGER trg_rfq_header_updated_date
BEFORE UPDATE ON tbl_rfq_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_rfq_item_updated_date ON tbl_rfq_item;
CREATE TRIGGER trg_rfq_item_updated_date
BEFORE UPDATE ON tbl_rfq_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_rfq_vendor_updated_date ON tbl_rfq_vendor;
CREATE TRIGGER trg_rfq_vendor_updated_date
BEFORE UPDATE ON tbl_rfq_vendor
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_rfq_vendor_item_updated_date ON tbl_rfq_vendor_item;
CREATE TRIGGER trg_rfq_vendor_item_updated_date
BEFORE UPDATE ON tbl_rfq_vendor_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_po_header_updated_date ON tbl_po_header;
CREATE TRIGGER trg_po_header_updated_date
BEFORE UPDATE ON tbl_po_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_po_item_updated_date ON tbl_po_item;
CREATE TRIGGER trg_po_item_updated_date
BEFORE UPDATE ON tbl_po_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_gate_inward_header_updated_date ON tbl_gate_inward_header;
CREATE TRIGGER trg_gate_inward_header_updated_date
BEFORE UPDATE ON tbl_gate_inward_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_gate_inward_item_updated_date ON tbl_gate_inward_item;
CREATE TRIGGER trg_gate_inward_item_updated_date
BEFORE UPDATE ON tbl_gate_inward_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_inv_grn_header_updated_date ON tbl_inv_grn_header;
CREATE TRIGGER trg_inv_grn_header_updated_date
BEFORE UPDATE ON tbl_inv_grn_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_inv_grn_item_updated_date ON tbl_inv_grn_item;
CREATE TRIGGER trg_inv_grn_item_updated_date
BEFORE UPDATE ON tbl_inv_grn_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_qc_inward_header_updated_date ON tbl_qc_inward_inspection_header;
CREATE TRIGGER trg_qc_inward_header_updated_date
BEFORE UPDATE ON tbl_qc_inward_inspection_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_qc_inward_item_updated_date ON tbl_qc_inward_inspection_item;
CREATE TRIGGER trg_qc_inward_item_updated_date
BEFORE UPDATE ON tbl_qc_inward_inspection_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_inv_putaway_header_updated_date ON tbl_inv_putaway_header;
CREATE TRIGGER trg_inv_putaway_header_updated_date
BEFORE UPDATE ON tbl_inv_putaway_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_inv_putaway_item_updated_date ON tbl_inv_putaway_item;
CREATE TRIGGER trg_inv_putaway_item_updated_date
BEFORE UPDATE ON tbl_inv_putaway_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_inv_bin_stock_updated_date ON tbl_inv_bin_stock;
CREATE TRIGGER trg_inv_bin_stock_updated_date
BEFORE UPDATE ON tbl_inv_bin_stock
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_pur_invoice_header_updated_date ON tbl_pur_invoice_header;
CREATE TRIGGER trg_pur_invoice_header_updated_date
BEFORE UPDATE ON tbl_pur_invoice_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_pur_invoice_item_updated_date ON tbl_pur_invoice_item;
CREATE TRIGGER trg_pur_invoice_item_updated_date
BEFORE UPDATE ON tbl_pur_invoice_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_bom_header_updated_date ON tbl_mfg_bom_header;
CREATE TRIGGER trg_mfg_bom_header_updated_date
BEFORE UPDATE ON tbl_mfg_bom_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_bom_item_updated_date ON tbl_mfg_bom_item;
CREATE TRIGGER trg_mfg_bom_item_updated_date
BEFORE UPDATE ON tbl_mfg_bom_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_bom_byproduct_updated_date ON tbl_mfg_bom_byproduct;
CREATE TRIGGER trg_mfg_bom_byproduct_updated_date
BEFORE UPDATE ON tbl_mfg_bom_byproduct
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_shift_updated_date ON tbl_mfg_shift;
CREATE TRIGGER trg_mfg_shift_updated_date
BEFORE UPDATE ON tbl_mfg_shift
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_work_center_updated_date ON tbl_mfg_work_center;
CREATE TRIGGER trg_mfg_work_center_updated_date
BEFORE UPDATE ON tbl_mfg_work_center
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_work_center_machine_updated_date ON tbl_mfg_work_center_machine;
CREATE TRIGGER trg_mfg_work_center_machine_updated_date
BEFORE UPDATE ON tbl_mfg_work_center_machine
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_work_center_shift_updated_date ON tbl_mfg_work_center_shift;
CREATE TRIGGER trg_mfg_work_center_shift_updated_date
BEFORE UPDATE ON tbl_mfg_work_center_shift
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_routing_header_updated_date ON tbl_mfg_routing_header;
CREATE TRIGGER trg_mfg_routing_header_updated_date
BEFORE UPDATE ON tbl_mfg_routing_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_routing_operation_updated_date ON tbl_mfg_routing_operation;
CREATE TRIGGER trg_mfg_routing_operation_updated_date
BEFORE UPDATE ON tbl_mfg_routing_operation
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_mrp_run_header_updated_date ON tbl_mfg_mrp_run_header;
CREATE TRIGGER trg_mfg_mrp_run_header_updated_date
BEFORE UPDATE ON tbl_mfg_mrp_run_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_mrp_planned_order_updated_date ON tbl_mfg_mrp_planned_order;
CREATE TRIGGER trg_mfg_mrp_planned_order_updated_date
BEFORE UPDATE ON tbl_mfg_mrp_planned_order
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_wo_header_updated_date ON tbl_mfg_wo_header;
CREATE TRIGGER trg_mfg_wo_header_updated_date
BEFORE UPDATE ON tbl_mfg_wo_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_wo_bom_item_updated_date ON tbl_mfg_wo_bom_item;
CREATE TRIGGER trg_mfg_wo_bom_item_updated_date
BEFORE UPDATE ON tbl_mfg_wo_bom_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_wo_routing_op_updated_date ON tbl_mfg_wo_routing_op;
CREATE TRIGGER trg_mfg_wo_routing_op_updated_date
BEFORE UPDATE ON tbl_mfg_wo_routing_op
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_material_issue_header_updated_date ON tbl_mfg_material_issue_header;
CREATE TRIGGER trg_mfg_material_issue_header_updated_date
BEFORE UPDATE ON tbl_mfg_material_issue_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_material_issue_item_updated_date ON tbl_mfg_material_issue_item;
CREATE TRIGGER trg_mfg_material_issue_item_updated_date
BEFORE UPDATE ON tbl_mfg_material_issue_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();



DROP TRIGGER IF EXISTS trg_mfg_job_card_updated_date ON tbl_mfg_job_card;
CREATE TRIGGER trg_mfg_job_card_updated_date
BEFORE UPDATE ON tbl_mfg_job_card
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_job_card_time_log_updated_date ON tbl_mfg_job_card_time_log;
CREATE TRIGGER trg_mfg_job_card_time_log_updated_date
BEFORE UPDATE ON tbl_mfg_job_card_time_log
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_job_work_challan_updated_date ON tbl_mfg_job_work_challan;
CREATE TRIGGER trg_mfg_job_work_challan_updated_date
BEFORE UPDATE ON tbl_mfg_job_work_challan
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_job_work_challan_item_updated_date ON tbl_mfg_job_work_challan_item;
CREATE TRIGGER trg_mfg_job_work_challan_item_updated_date
BEFORE UPDATE ON tbl_mfg_job_work_challan_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_job_work_receipt_updated_date ON tbl_mfg_job_work_receipt;
CREATE TRIGGER trg_mfg_job_work_receipt_updated_date
BEFORE UPDATE ON tbl_mfg_job_work_receipt
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_job_work_receipt_item_updated_date ON tbl_mfg_job_work_receipt_item;
CREATE TRIGGER trg_mfg_job_work_receipt_item_updated_date
BEFORE UPDATE ON tbl_mfg_job_work_receipt_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_fg_receipt_header_updated_date ON tbl_mfg_fg_receipt_header;
CREATE TRIGGER trg_mfg_fg_receipt_header_updated_date
BEFORE UPDATE ON tbl_mfg_fg_receipt_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_mfg_fg_receipt_byproduct_updated_date ON tbl_mfg_fg_receipt_byproduct;
CREATE TRIGGER trg_mfg_fg_receipt_byproduct_updated_date
BEFORE UPDATE ON tbl_mfg_fg_receipt_byproduct
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_sales_quotation_header_updated_date ON tbl_sales_quotation_header;
CREATE TRIGGER trg_sales_quotation_header_updated_date
BEFORE UPDATE ON tbl_sales_quotation_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_sales_quotation_item_updated_date ON tbl_sales_quotation_item;
CREATE TRIGGER trg_sales_quotation_item_updated_date
BEFORE UPDATE ON tbl_sales_quotation_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_sales_order_header_updated_date ON tbl_sales_order_header;
CREATE TRIGGER trg_sales_order_header_updated_date
BEFORE UPDATE ON tbl_sales_order_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_sales_order_item_updated_date ON tbl_sales_order_item;
CREATE TRIGGER trg_sales_order_item_updated_date
BEFORE UPDATE ON tbl_sales_order_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();



DROP TRIGGER IF EXISTS trg_sales_delivery_challan_header_updated_date ON tbl_sales_delivery_challan_header;
CREATE TRIGGER trg_sales_delivery_challan_header_updated_date
BEFORE UPDATE ON tbl_sales_delivery_challan_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_sales_delivery_challan_item_updated_date ON tbl_sales_delivery_challan_item;
CREATE TRIGGER trg_sales_delivery_challan_item_updated_date
BEFORE UPDATE ON tbl_sales_delivery_challan_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_sales_invoice_header_updated_date ON tbl_sales_invoice_header;
CREATE TRIGGER trg_sales_invoice_header_updated_date
BEFORE UPDATE ON tbl_sales_invoice_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_sales_invoice_item_updated_date ON tbl_sales_invoice_item;
CREATE TRIGGER trg_sales_invoice_item_updated_date
BEFORE UPDATE ON tbl_sales_invoice_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_sales_ar_payment_receipt_updated_date ON tbl_sales_ar_payment_receipt;
CREATE TRIGGER trg_sales_ar_payment_receipt_updated_date
BEFORE UPDATE ON tbl_sales_ar_payment_receipt
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_sales_return_header_updated_date ON tbl_sales_return_header;
CREATE TRIGGER trg_sales_return_header_updated_date
BEFORE UPDATE ON tbl_sales_return_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_sales_return_item_updated_date ON tbl_sales_return_item;
CREATE TRIGGER trg_sales_return_item_updated_date
BEFORE UPDATE ON tbl_sales_return_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_inv_adjustment_header_updated_date ON tbl_inv_adjustment_header;
CREATE TRIGGER trg_inv_adjustment_header_updated_date
BEFORE UPDATE ON tbl_inv_adjustment_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_inv_adjustment_item_updated_date ON tbl_inv_adjustment_item;
CREATE TRIGGER trg_inv_adjustment_item_updated_date
BEFORE UPDATE ON tbl_inv_adjustment_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();


DROP TRIGGER IF EXISTS trg_inv_transfer_header_updated_date ON tbl_inv_transfer_header;
CREATE TRIGGER trg_inv_transfer_header_updated_date
BEFORE UPDATE ON tbl_inv_transfer_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_inv_transfer_item_updated_date ON tbl_inv_transfer_item;
CREATE TRIGGER trg_inv_transfer_item_updated_date
BEFORE UPDATE ON tbl_inv_transfer_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();





DROP TRIGGER IF EXISTS trg_inv_batch_master_updated_date ON tbl_inv_batch_master;
CREATE TRIGGER trg_inv_batch_master_updated_date
BEFORE UPDATE ON tbl_inv_batch_master
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_inv_batch_genealogy_updated_date ON tbl_inv_batch_genealogy;
CREATE TRIGGER trg_inv_batch_genealogy_updated_date
BEFORE UPDATE ON tbl_inv_batch_genealogy
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_inv_serial_master_updated_date ON tbl_inv_serial_master;
CREATE TRIGGER trg_inv_serial_master_updated_date
BEFORE UPDATE ON tbl_inv_serial_master
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();


DROP TRIGGER IF EXISTS trg_inv_stock_provision_header_updated_date ON tbl_inv_stock_provision_header;
CREATE TRIGGER trg_inv_stock_provision_header_updated_date
BEFORE UPDATE ON tbl_inv_stock_provision_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_inv_stock_provision_item_updated_date ON tbl_inv_stock_provision_item;
CREATE TRIGGER trg_inv_stock_provision_item_updated_date
BEFORE UPDATE ON tbl_inv_stock_provision_item
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_qc_in_process_header_updated_date ON tbl_qc_in_process_header;
CREATE TRIGGER trg_qc_in_process_header_updated_date
BEFORE UPDATE ON tbl_qc_in_process_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_qc_in_process_param_updated_date ON tbl_qc_in_process_param;
CREATE TRIGGER trg_qc_in_process_param_updated_date
BEFORE UPDATE ON tbl_qc_in_process_param
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_qc_pdi_header_updated_date ON tbl_qc_pdi_header;
CREATE TRIGGER trg_qc_pdi_header_updated_date
BEFORE UPDATE ON tbl_qc_pdi_header
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_qc_pdi_param_updated_date ON tbl_qc_pdi_param;
CREATE TRIGGER trg_qc_pdi_param_updated_date
BEFORE UPDATE ON tbl_qc_pdi_param
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();

DROP TRIGGER IF EXISTS trg_qc_pdi_coa_spec_updated_date ON tbl_qc_pdi_coa_spec;
CREATE TRIGGER trg_qc_pdi_coa_spec_updated_date
BEFORE UPDATE ON tbl_qc_pdi_coa_spec
FOR EACH ROW EXECUTE FUNCTION fn_set_updated_timestamp();
