import {
  pgTable,
  bigint,
  varchar,
  text,
  boolean,
  date,
  integer,
  numeric,
  smallint,
  timestamp,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Helper for standard 7 mandatory audit & multi-tenancy columns
 * Used across tables where comp_id, branch_id, and fyear_id are regular columns
 */
export const standardAuditColumns = {
  compId: bigint('comp_id', { mode: 'number' }).notNull().default(1001),
  branchId: bigint('branch_id', { mode: 'number' }).notNull().default(1001),
  fyearId: bigint('fyear_id', { mode: 'number' }),
  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  createdDate: timestamp('created_date', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: bigint('updated_by', { mode: 'number' }),
  updatedDate: timestamp('updated_date', { withTimezone: true }),
};

// ============================================================================
// 1. Organization & Multi-Tenancy Tables
// ============================================================================

export const tblOrgCompany = pgTable('tbl_org_company', {
  compId: bigint('comp_id', { mode: 'number' })
    .primaryKey()
    .default(sql`nextval('seq_comp_id')`),
  compCode: varchar('comp_code', { length: 20 }).notNull().unique(),
  compName: varchar('comp_name', { length: 150 }).notNull(),
  legalName: varchar('legal_name', { length: 200 }).notNull(),
  gstin: varchar('gstin', { length: 20 }),
  panNo: varchar('pan_no', { length: 20 }),
  cinNo: varchar('cin_no', { length: 30 }),
  iecCode: varchar('iec_code', { length: 30 }),
  msmeRegNo: varchar('msme_reg_no', { length: 50 }),
  baseCurrencyCode: varchar('base_currency_code', { length: 10 })
    .notNull()
    .default('INR'),
  registeredAddress: text('registered_address'),
  city: varchar('city', { length: 100 }),
  stateName: varchar('state_name', { length: 100 }),
  stateCode: varchar('state_code', { length: 10 }),
  pincode: varchar('pincode', { length: 15 }),
  country: varchar('country', { length: 100 }).notNull().default('India'),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 150 }),
  website: varchar('website', { length: 150 }),
  logoUrl: varchar('logo_url', { length: 500 }),
  isActive: boolean('is_active').notNull().default(true),
  // Remaining 6 of the 7 mandatory columns (comp_id is PK above)
  branchId: bigint('branch_id', { mode: 'number' }).notNull().default(0),
  fyearId: bigint('fyear_id', { mode: 'number' }),
  createdBy: bigint('created_by', { mode: 'number' }).notNull(),
  createdDate: timestamp('created_date', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: bigint('updated_by', { mode: 'number' }),
  updatedDate: timestamp('updated_date', { withTimezone: true }),
});

export const tblOrgBranch = pgTable(
  'tbl_org_branch',
  {
    branchId: bigint('branch_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_branch_id')`),
    branchCode: varchar('branch_code', { length: 20 }).notNull(),
    branchName: varchar('branch_name', { length: 150 }).notNull(),
    branchType: varchar('branch_type', { length: 30 })
      .notNull()
      .default('PLANT'),
    gstin: varchar('gstin', { length: 20 }),
    address: text('address'),
    city: varchar('city', { length: 100 }),
    stateName: varchar('state_name', { length: 100 }),
    stateCode: varchar('state_code', { length: 10 }),
    pincode: varchar('pincode', { length: 15 }),
    country: varchar('country', { length: 100 }).notNull().default('India'),
    phone: varchar('phone', { length: 30 }),
    email: varchar('email', { length: 150 }),
    isHeadOffice: boolean('is_head_office').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    // Remaining 6 of the 7 mandatory columns (branch_id is PK above)
    compId: bigint('comp_id', { mode: 'number' })
      .notNull()
      .references(() => tblOrgCompany.compId),
    fyearId: bigint('fyear_id', { mode: 'number' }),
    createdBy: bigint('created_by', { mode: 'number' }).notNull(),
    createdDate: timestamp('created_date', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: bigint('updated_by', { mode: 'number' }),
    updatedDate: timestamp('updated_date', { withTimezone: true }),
  },
  (table) => ({
    uqBranchCode: unique('uq_org_branch_code').on(
      table.compId,
      table.branchCode,
    ),
  }),
);

export const tblOrgFinancialYear = pgTable(
  'tbl_org_financial_year',
  {
    fyearId: bigint('fyear_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_fyear_id')`),
    fyearCode: varchar('fyear_code', { length: 20 }).notNull(),
    fyearName: varchar('fyear_name', { length: 50 }).notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    isCurrent: boolean('is_current').notNull().default(false),
    isClosed: boolean('is_closed').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    // Remaining 6 of the 7 mandatory columns (fyear_id is PK above)
    compId: bigint('comp_id', { mode: 'number' })
      .notNull()
      .references(() => tblOrgCompany.compId),
    branchId: bigint('branch_id', { mode: 'number' }).notNull().default(0),
    createdBy: bigint('created_by', { mode: 'number' }).notNull(),
    createdDate: timestamp('created_date', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: bigint('updated_by', { mode: 'number' }),
    updatedDate: timestamp('updated_date', { withTimezone: true }),
  },
  (table) => ({
    uqFyearCode: unique('uq_org_fyear_code').on(table.compId, table.fyearCode),
  }),
);

export const tblOrgBranchFyear = pgTable(
  'tbl_org_branch_fyear',
  {
    branchFyearId: bigint('branch_fyear_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_branch_fyear_id')`),
    isLocked: boolean('is_locked').notNull().default(false),
    booksBeginFrom: date('books_begin_from'),
    isActive: boolean('is_active').notNull().default(true),
    compId: bigint('comp_id', { mode: 'number' })
      .notNull()
      .references(() => tblOrgCompany.compId),
    branchId: bigint('branch_id', { mode: 'number' })
      .notNull()
      .references(() => tblOrgBranch.branchId),
    fyearId: bigint('fyear_id', { mode: 'number' })
      .notNull()
      .references(() => tblOrgFinancialYear.fyearId),
    createdBy: bigint('created_by', { mode: 'number' }).notNull(),
    createdDate: timestamp('created_date', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: bigint('updated_by', { mode: 'number' }),
    updatedDate: timestamp('updated_date', { withTimezone: true }),
  },
  (table) => ({
    uqBranchFyear: unique('uq_org_branch_fyear').on(
      table.compId,
      table.branchId,
      table.fyearId,
    ),
  }),
);

// ============================================================================
// 2. Global Roles, Screens, Actions & RBAC Tables
// ============================================================================

export const tblSecRole = pgTable('tbl_sec_role', {
  roleId: bigint('role_id', { mode: 'number' })
    .primaryKey()
    .default(sql`nextval('seq_role_id')`),
  roleCode: varchar('role_code', { length: 40 }).notNull().unique(),
  roleName: varchar('role_name', { length: 100 }).notNull(),
  roleDescription: varchar('role_description', { length: 300 }),
  isSystemRole: boolean('is_system_role').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  ...standardAuditColumns,
});

export const tblSecScreen = pgTable('tbl_sec_screen', {
  screenId: bigint('screen_id', { mode: 'number' })
    .primaryKey()
    .default(sql`nextval('seq_screen_id')`),
  screenCode: varchar('screen_code', { length: 60 }).notNull().unique(),
  screenName: varchar('screen_name', { length: 120 }).notNull(),
  moduleName: varchar('module_name', { length: 60 }).notNull(),
  routePath: varchar('route_path', { length: 150 }),
  iconName: varchar('icon_name', { length: 60 }),
  displayOrder: integer('display_order').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  ...standardAuditColumns,
});

export const tblSecAction = pgTable(
  'tbl_sec_action',
  {
    actionId: bigint('action_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_action_id')`),
    screenId: bigint('screen_id', { mode: 'number' })
      .notNull()
      .references(() => tblSecScreen.screenId),
    actionCode: varchar('action_code', { length: 40 }).notNull(),
    actionName: varchar('action_name', { length: 100 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqScreenAction: unique('uq_sec_screen_action').on(
      table.screenId,
      table.actionCode,
    ),
  }),
);

export const tblSecRolePermission = pgTable(
  'tbl_sec_role_permission',
  {
    rolePermissionId: bigint('role_permission_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_role_permission_id')`),
    roleId: bigint('role_id', { mode: 'number' })
      .notNull()
      .references(() => tblSecRole.roleId),
    screenId: bigint('screen_id', { mode: 'number' })
      .notNull()
      .references(() => tblSecScreen.screenId),
    canView: boolean('can_view').notNull().default(false),
    canAdd: boolean('can_add').notNull().default(false),
    canEdit: boolean('can_edit').notNull().default(false),
    canDelete: boolean('can_delete').notNull().default(false),
    ...standardAuditColumns,
  },
  (table) => ({
    uqRoleScreen: unique('uq_sec_role_screen').on(table.roleId, table.screenId),
  }),
);

export const tblSecRoleActionPermission = pgTable(
  'tbl_sec_role_action_permission',
  {
    roleActionPermissionId: bigint('role_action_permission_id', {
      mode: 'number',
    })
      .primaryKey()
      .default(sql`nextval('seq_role_action_permission_id')`),
    roleId: bigint('role_id', { mode: 'number' })
      .notNull()
      .references(() => tblSecRole.roleId),
    screenId: bigint('screen_id', { mode: 'number' })
      .notNull()
      .references(() => tblSecScreen.screenId),
    actionId: bigint('action_id', { mode: 'number' })
      .notNull()
      .references(() => tblSecAction.actionId),
    isAllowed: boolean('is_allowed').notNull().default(false),
    ...standardAuditColumns,
  },
  (table) => ({
    uqRoleAction: unique('uq_sec_role_action').on(table.roleId, table.actionId),
  }),
);

// ============================================================================
// 3. Users, Company/Branch Role Mappings & User Preferences
// ============================================================================

export const tblSecUser = pgTable('tbl_sec_user', {
  userId: bigint('user_id', { mode: 'number' })
    .primaryKey()
    .default(sql`nextval('seq_user_id')`),
  username: varchar('username', { length: 60 }).notNull().unique(),
  email: varchar('email', { length: 150 }).notNull().unique(),
  mobile: varchar('mobile', { length: 25 }),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 150 }).notNull(),
  userCategory: varchar('user_category', { length: 20 })
    .notNull()
    .default('EMPLOYEE'), // 'SYSTEM', 'EMPLOYEE', 'PARTY'
  linkedEntityId: bigint('linked_entity_id', { mode: 'number' }),
  isSuperAdmin: boolean('is_super_admin').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  ...standardAuditColumns,
});

export const tblSecUserCompanyRole = pgTable(
  'tbl_sec_user_company_role',
  {
    userCompanyRoleId: bigint('user_company_role_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_user_company_role_id')`),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => tblSecUser.userId),
    mappedCompId: bigint('mapped_comp_id', { mode: 'number' })
      .notNull()
      .references(() => tblOrgCompany.compId),
    roleId: bigint('role_id', { mode: 'number' })
      .notNull()
      .references(() => tblSecRole.roleId),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqUserCompRole: unique('uq_sec_user_comp_role').on(
      table.userId,
      table.mappedCompId,
      table.roleId,
    ),
  }),
);

export const tblSecUserBranchRole = pgTable(
  'tbl_sec_user_branch_role',
  {
    userBranchRoleId: bigint('user_branch_role_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_user_branch_role_id')`),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => tblSecUser.userId),
    mappedCompId: bigint('mapped_comp_id', { mode: 'number' })
      .notNull()
      .references(() => tblOrgCompany.compId),
    mappedBranchId: bigint('mapped_branch_id', { mode: 'number' })
      .notNull()
      .references(() => tblOrgBranch.branchId),
    roleId: bigint('role_id', { mode: 'number' })
      .notNull()
      .references(() => tblSecRole.roleId),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqUserBranchRole: unique('uq_sec_user_branch_role').on(
      table.userId,
      table.mappedBranchId,
      table.roleId,
    ),
  }),
);

export const tblSecUserPreference = pgTable('tbl_sec_user_preference', {
  userPreferenceId: bigint('user_preference_id', { mode: 'number' })
    .primaryKey()
    .default(sql`nextval('seq_user_preference_id')`),
  userId: bigint('user_id', { mode: 'number' })
    .notNull()
    .unique()
    .references(() => tblSecUser.userId),
  themeMode: varchar('theme_mode', { length: 20 }).notNull().default('light'),
  themeColor: varchar('theme_color', { length: 30 })
    .notNull()
    .default('indigo'),
  sidebarCollapsed: boolean('sidebar_collapsed').notNull().default(false),
  defaultCompId: bigint('default_comp_id', { mode: 'number' }).references(
    () => tblOrgCompany.compId,
  ),
  defaultBranchId: bigint('default_branch_id', { mode: 'number' }).references(
    () => tblOrgBranch.branchId,
  ),
  defaultFyearId: bigint('default_fyear_id', { mode: 'number' }).references(
    () => tblOrgFinancialYear.fyearId,
  ),
  ...standardAuditColumns,
});

// ============================================================================
// 4. Universal Activity & Field-Delta Audit Trail Table
// ============================================================================

export const tblSysAuditLog = pgTable('tbl_sys_audit_log', {
  auditId: bigint('audit_id', { mode: 'number' })
    .primaryKey()
    .default(sql`nextval('seq_audit_id')`),
  userId: bigint('user_id', { mode: 'number' }).notNull(),
  username: varchar('username', { length: 60 }),
  screenCode: varchar('screen_code', { length: 60 }).notNull(),
  actionType: varchar('action_type', { length: 30 }).notNull(),
  entityTable: varchar('entity_table', { length: 100 }).notNull(),
  recordId: bigint('record_id', { mode: 'number' }).notNull(),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  changedFields: jsonb('changed_fields'),
  ipAddress: varchar('ip_address', { length: 50 }),
  userAgent: varchar('user_agent', { length: 300 }),
  correlationId: varchar('correlation_id', { length: 60 }),
  actionTimestamp: timestamp('action_timestamp', { withTimezone: true })
    .notNull()
    .defaultNow(),
  ...standardAuditColumns,
});

// ============================================================================
// 5. HR Organization Hierarchy Tables (Step 2.1 — Departments & Designations)
// ============================================================================

export const tblHrDepartment = pgTable(
  'tbl_hr_department',
  {
    deptId: bigint('dept_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_dept_id')`),
    deptCode: varchar('dept_code', { length: 30 }).notNull(),
    deptName: varchar('dept_name', { length: 120 }).notNull(),
    deptCategory: varchar('dept_category', { length: 40 })
      .notNull()
      .default('PRODUCTION'),
    parentDeptId: bigint('parent_dept_id', { mode: 'number' }),
    hodEmployeeId: bigint('hod_employee_id', { mode: 'number' }),
    costCenterCode: varchar('cost_center_code', { length: 40 }),
    description: varchar('description', { length: 300 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqDeptCode: unique('uq_hr_dept_code').on(table.compId, table.deptCode),
  }),
);

export const tblHrDesignation = pgTable(
  'tbl_hr_designation',
  {
    desigId: bigint('desig_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_desig_id')`),
    desigCode: varchar('desig_code', { length: 30 }).notNull(),
    desigName: varchar('desig_name', { length: 120 }).notNull(),
    deptId: bigint('dept_id', { mode: 'number' }).references(
      () => tblHrDepartment.deptId,
    ),
    gradeCode: varchar('grade_code', { length: 20 }).notNull().default('L3'),
    hierarchyLevel: integer('hierarchy_level').notNull().default(3),
    description: varchar('description', { length: 300 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqDesigCode: unique('uq_hr_desig_code').on(table.compId, table.desigCode),
  }),
);

// ============================================================================
// 6. HR Employee Master Table (Step 2.2 — Employee Master)
// ============================================================================

export const tblHrEmployee = pgTable(
  'tbl_hr_employee',
  {
    employeeId: bigint('employee_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_employee_id')`),
    empCode: varchar('emp_code', { length: 30 }).notNull(),
    firstName: varchar('first_name', { length: 80 }).notNull(),
    lastName: varchar('last_name', { length: 80 }),
    fullName: varchar('full_name', { length: 165 }).notNull(),
    gender: varchar('gender', { length: 20 }).notNull().default('MALE'),
    dateOfBirth: date('date_of_birth'),
    dateOfJoining: date('date_of_joining').notNull(),
    deptId: bigint('dept_id', { mode: 'number' })
      .notNull()
      .references(() => tblHrDepartment.deptId),
    desigId: bigint('desig_id', { mode: 'number' })
      .notNull()
      .references(() => tblHrDesignation.desigId),
    primaryBranchId: bigint('primary_branch_id', { mode: 'number' })
      .notNull()
      .references(() => tblOrgBranch.branchId),
    reportingManagerId: bigint('reporting_manager_id', { mode: 'number' }),
    employmentType: varchar('employment_type', { length: 30 })
      .notNull()
      .default('PERMANENT'),
    employmentStatus: varchar('employment_status', { length: 30 })
      .notNull()
      .default('ACTIVE'),
    workEmail: varchar('work_email', { length: 150 }),
    mobileNo: varchar('mobile_no', { length: 25 }).notNull(),
    emergencyContactName: varchar('emergency_contact_name', { length: 120 }),
    emergencyContactPhone: varchar('emergency_contact_phone', { length: 25 }),
    bloodGroup: varchar('blood_group', { length: 10 }),
    panNo: varchar('pan_no', { length: 15 }),
    aadhaarMasked: varchar('aadhaar_masked', { length: 20 }),
    pfUanNo: varchar('pf_uan_no', { length: 25 }),
    esiNo: varchar('esi_no', { length: 25 }),
    bankName: varchar('bank_name', { length: 120 }),
    bankAccountNo: varchar('bank_account_no', { length: 40 }),
    bankIfscCode: varchar('bank_ifsc_code', { length: 20 }),
    addressLine1: varchar('address_line1', { length: 200 }),
    city: varchar('city', { length: 80 }),
    stateName: varchar('state_name', { length: 80 }),
    pincode: varchar('pincode', { length: 15 }),
    remarks: varchar('remarks', { length: 300 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqEmpCode: unique('uq_hr_employee_code').on(table.compId, table.empCode),
  }),
);

// ============================================================================
// 7. System Configuration Matrix & Document Numbering Series (Step 2.6)
// ============================================================================

export const tblSysConfig = pgTable('tbl_sys_config', {
  configId: bigint('config_id', { mode: 'number' })
    .primaryKey()
    .default(sql`nextval('seq_config_id')`),
  configKey: varchar('config_key', { length: 80 }).notNull(),
  configName: varchar('config_name', { length: 150 }).notNull(),
  configGroup: varchar('config_group', { length: 50 })
    .notNull()
    .default('INVENTORY_VALUATION'),
  dataType: varchar('data_type', { length: 20 }).notNull().default('STRING'), // 'BOOLEAN', 'NUMBER', 'STRING', 'ENUM', 'JSON'
  configValue: varchar('config_value', { length: 500 }).notNull(),
  defaultValue: varchar('default_value', { length: 500 }).notNull(),
  allowedValues: varchar('allowed_values', { length: 500 }),
  scopeLevel: varchar('scope_level', { length: 20 })
    .notNull()
    .default('GLOBAL'), // 'GLOBAL', 'COMPANY', 'BRANCH'
  targetCompId: bigint('target_comp_id', { mode: 'number' }).references(
    () => tblOrgCompany.compId,
  ),
  targetBranchId: bigint('target_branch_id', { mode: 'number' }).references(
    () => tblOrgBranch.branchId,
  ),
  description: varchar('description', { length: 350 }),
  isSystemLocked: boolean('is_system_locked').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  ...standardAuditColumns,
});

export const tblSysDocNumberSeries = pgTable(
  'tbl_sys_doc_number_series',
  {
    seriesId: bigint('series_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_doc_series_id')`),
    seriesCode: varchar('series_code', { length: 40 }).notNull(),
    seriesName: varchar('series_name', { length: 120 }).notNull(),
    docTypeCode: varchar('doc_type_code', { length: 40 }).notNull(),
    docTypeName: varchar('doc_type_name', { length: 100 }).notNull(),
    moduleName: varchar('module_name', { length: 40 })
      .notNull()
      .default('PROCUREMENT'),
    targetCompId: bigint('target_comp_id', { mode: 'number' })
      .notNull()
      .references(() => tblOrgCompany.compId),
    targetBranchId: bigint('target_branch_id', { mode: 'number' })
      .notNull()
      .references(() => tblOrgBranch.branchId),
    targetFyearId: bigint('target_fyear_id', { mode: 'number' })
      .notNull()
      .references(() => tblOrgFinancialYear.fyearId),
    prefixTemplate: varchar('prefix_template', { length: 50 }).notNull(),
    suffixTemplate: varchar('suffix_template', { length: 30 }),
    separatorChar: varchar('separator_char', { length: 5 })
      .notNull()
      .default('/'),
    paddingDigits: integer('padding_digits').notNull().default(4),
    startingNo: integer('starting_no').notNull().default(1),
    currentNextNo: integer('current_next_no').notNull().default(1),
    resetFrequency: varchar('reset_frequency', { length: 20 })
      .notNull()
      .default('FYEAR'),
    allowManualOverride: boolean('allow_manual_override')
      .notNull()
      .default(false),
    isDefault: boolean('is_default').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqDocSeriesCode: unique('uq_sys_doc_series_code').on(
      table.targetCompId,
      table.targetBranchId,
      table.targetFyearId,
      table.seriesCode,
    ),
  }),
);

// ============================================================================
// 8. Multi-Level Warehouse & Storage Bin Hierarchy (Step 3.1)
// ============================================================================

export const tblInvWarehouse = pgTable(
  'tbl_inv_warehouse',
  {
    warehouseId: bigint('warehouse_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_warehouse_id')`),
    warehouseCode: varchar('warehouse_code', { length: 30 }).notNull(),
    warehouseName: varchar('warehouse_name', { length: 120 }).notNull(),
    warehouseType: varchar('warehouse_type', { length: 30 })
      .notNull()
      .default('RAW_MATERIAL'),
    targetCompId: bigint('target_comp_id', { mode: 'number' })
      .notNull()
      .references(() => tblOrgCompany.compId),
    targetBranchId: bigint('target_branch_id', { mode: 'number' })
      .notNull()
      .references(() => tblOrgBranch.branchId),
    inchargeEmployeeId: bigint('incharge_employee_id', {
      mode: 'number',
    }).references(() => tblHrEmployee.employeeId),
    allowNegativeStock: boolean('allow_negative_stock')
      .notNull()
      .default(false),
    isQcHoldStore: boolean('is_qc_hold_store').notNull().default(false),
    isShopfloorWip: boolean('is_shopfloor_wip').notNull().default(false),
    storageTempMinC: numeric('storage_temp_min_c', { precision: 6, scale: 2 }),
    storageTempMaxC: numeric('storage_temp_max_c', { precision: 6, scale: 2 }),
    addressLocation: varchar('address_location', { length: 250 }),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqWarehouseCode: unique('uq_inv_warehouse_code').on(
      table.targetCompId,
      table.targetBranchId,
      table.warehouseCode,
    ),
  }),
);

export const tblInvStorageBin = pgTable(
  'tbl_inv_storage_bin',
  {
    binId: bigint('bin_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_storage_bin_id')`),
    warehouseId: bigint('warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    binCode: varchar('bin_code', { length: 50 }).notNull(),
    binName: varchar('bin_name', { length: 120 }).notNull(),
    zoneCode: varchar('zone_code', { length: 25 }).notNull(),
    rackCode: varchar('rack_code', { length: 25 }).notNull().default('R01'),
    shelfLevel: varchar('shelf_level', { length: 25 }).notNull().default('S01'),
    binPosition: varchar('bin_position', { length: 25 })
      .notNull()
      .default('B01'),
    binType: varchar('bin_type', { length: 30 })
      .notNull()
      .default('PALLET_RACK'),
    maxWeightKg: numeric('max_weight_kg', { precision: 12, scale: 2 })
      .notNull()
      .default('1000.00'),
    maxVolumeCbm: numeric('max_volume_cbm', { precision: 10, scale: 3 }),
    allowMixedItems: boolean('allow_mixed_items').notNull().default(true),
    allowMixedBatches: boolean('allow_mixed_batches').notNull().default(false),
    isPickFace: boolean('is_pick_face').notNull().default(true),
    isReceivingStaging: boolean('is_receiving_staging')
      .notNull()
      .default(false),
    isBlockedForPutaway: boolean('is_blocked_for_putaway')
      .notNull()
      .default(false),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqWarehouseBinCode: unique('uq_inv_warehouse_bin_code').on(
      table.warehouseId,
      table.binCode,
    ),
  }),
);

export const tblInvUom = pgTable('tbl_inv_uom', {
  uomId: bigint('uom_id', { mode: 'number' })
    .primaryKey()
    .default(sql`nextval('seq_uom_id')`),
  uomCode: varchar('uom_code', { length: 20 }).notNull().unique(),
  uomName: varchar('uom_name', { length: 100 }).notNull(),
  uomType: varchar('uom_type', { length: 30 }).notNull().default('COUNT'),
  decimalPrecision: smallint('decimal_precision').notNull().default(0),
  gstUqcCode: varchar('gst_uqc_code', { length: 10 }).notNull(),
  isBaseUom: boolean('is_base_uom').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  ...standardAuditColumns,
});

export const tblInvUomConversion = pgTable(
  'tbl_inv_uom_conversion',
  {
    conversionId: bigint('conversion_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_uom_conversion_id')`),
    fromUomId: bigint('from_uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    toUomId: bigint('to_uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    conversionFactor: numeric('conversion_factor', { precision: 18, scale: 6 })
      .notNull(),
    inverseFactor: numeric('inverse_factor', { precision: 18, scale: 6 })
      .notNull(),
    conversionType: varchar('conversion_type', { length: 30 })
      .notNull()
      .default('STANDARD'),
    remarks: varchar('remarks', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqUomConversion: unique('uq_inv_uom_conversion').on(
      table.fromUomId,
      table.toUomId,
    ),
  }),
);

export const tblInvItemCategory = pgTable('tbl_inv_item_category', {
  categoryId: bigint('category_id', { mode: 'number' })
    .primaryKey()
    .default(sql`nextval('seq_item_category_id')`),
  categoryCode: varchar('category_code', { length: 50 }).notNull().unique(),
  categoryName: varchar('category_name', { length: 100 }).notNull(),
  parentCategoryId: bigint('parent_category_id', { mode: 'number' })
    .references((): any => tblInvItemCategory.categoryId),
  categoryType: varchar('category_type', { length: 30 })
    .notNull()
    .default('RAW_MATERIAL'),
  hsnSacCode: varchar('hsn_sac_code', { length: 20 }),
  defaultTaxRate: numeric('default_tax_rate', { precision: 5, scale: 2 })
    .notNull()
    .default('18.00'),
  defaultValuationMethod: varchar('default_valuation_method', { length: 20 })
    .notNull()
    .default('FIFO'),
  levelDepth: smallint('level_depth').notNull().default(1),
  hierarchyPath: varchar('hierarchy_path', { length: 255 }).notNull(),
  isLeaf: boolean('is_leaf').notNull().default(true),
  isActive: boolean('is_active').notNull().default(true),
  ...standardAuditColumns,
});

// ============================================================================
// 10. Item & Material Master (Step 3.3)
// ============================================================================

export const tblInvItem = pgTable(
  'tbl_inv_item',
  {
    itemId: bigint('item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_item_id')`),
    itemCode: varchar('item_code', { length: 50 }).notNull(),
    itemName: varchar('item_name', { length: 150 }).notNull(),
    categoryId: bigint('category_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItemCategory.categoryId),
    itemType: varchar('item_type', { length: 30 })
      .notNull()
      .default('RAW_MATERIAL'),
    description: varchar('description', { length: 500 }),
    baseUomId: bigint('base_uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    purchaseUomId: bigint('purchase_uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    salesUomId: bigint('sales_uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    hsnSacCode: varchar('hsn_sac_code', { length: 20 }),
    taxRate: numeric('tax_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('18.00'),
    standardCost: numeric('standard_cost', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    purchaseRate: numeric('purchase_rate', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    salesRate: numeric('sales_rate', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    minStockLevel: numeric('min_stock_level', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    maxStockLevel: numeric('max_stock_level', { precision: 14, scale: 3 }),
    reorderPoint: numeric('reorder_point', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    safetyStock: numeric('safety_stock', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    leadTimeDays: integer('lead_time_days').notNull().default(7),
    valuationMethod: varchar('valuation_method', { length: 20 })
      .notNull()
      .default('FIFO'),
    isBatchManaged: boolean('is_batch_managed').notNull().default(true),
    isSerialManaged: boolean('is_serial_managed').notNull().default(false),
    isQcInspectionRequired: boolean('is_qc_inspection_required')
      .notNull()
      .default(true),
    shelfLifeDays: integer('shelf_life_days'),
    defaultWarehouseId: bigint('default_warehouse_id', {
      mode: 'number',
    }).references(() => tblInvWarehouse.warehouseId),
    defaultBinId: bigint('default_bin_id', { mode: 'number' }).references(
      () => tblInvStorageBin.binId,
    ),
    drawingNo: varchar('drawing_no', { length: 60 }),
    revisionNo: varchar('revision_no', { length: 20 }),
    weightPerUnitKg: numeric('weight_per_unit_kg', { precision: 12, scale: 4 }),
    isBomAllowed: boolean('is_bom_allowed').notNull().default(true),
    yieldPercentage: numeric('yield_percentage', { precision: 5, scale: 2 })
      .notNull()
      .default('100.00'),
    inspectionLeadTimeDays: integer('inspection_lead_time_days')
      .notNull()
      .default(1),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqInvItemCode: unique('uq_inv_item_code').on(table.compId, table.itemCode),
  }),
);




