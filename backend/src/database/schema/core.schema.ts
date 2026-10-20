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
  time,
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

// ============================================================================
// 11. Unified Customer, Supplier, Subcontractor & Transporter Master (Step 4.1)
// ============================================================================

export const tblCrmParty = pgTable(
  'tbl_crm_party',
  {
    partyId: bigint('party_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_party_id')`),
    partyCode: varchar('party_code', { length: 40 }).notNull(),
    partyName: varchar('party_name', { length: 150 }).notNull(),
    tradeName: varchar('trade_name', { length: 150 }),
    isCustomer: boolean('is_customer').notNull().default(true),
    isSupplier: boolean('is_supplier').notNull().default(false),
    isJobWorker: boolean('is_job_worker').notNull().default(false),
    isTransporter: boolean('is_transporter').notNull().default(false),
    partyGroup: varchar('party_group', { length: 50 })
      .notNull()
      .default('OEM_AUTOMOTIVE'),
    panNo: varchar('pan_no', { length: 15 }),
    msmeRegNo: varchar('msme_reg_no', { length: 30 }),
    primaryContactName: varchar('primary_contact_name', { length: 100 }).notNull(),
    primaryEmail: varchar('primary_email', { length: 150 }),
    primaryPhone: varchar('primary_phone', { length: 25 }).notNull(),
    website: varchar('website', { length: 150 }),
    creditLimit: numeric('credit_limit', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    creditDays: integer('credit_days').notNull().default(30),
    paymentTerms: varchar('payment_terms', { length: 40 })
      .notNull()
      .default('NET_30'),
    currencyCode: varchar('currency_code', { length: 5 })
      .notNull()
      .default('INR'),
    gstTreatmentType: varchar('gst_treatment_type', { length: 30 })
      .notNull()
      .default('REGISTERED_REGULAR'),
    isActive: boolean('is_active').notNull().default(true),
    remarks: varchar('remarks', { length: 350 }),
    ...standardAuditColumns,
  },
  (table) => ({
    uqCrmPartyCode: unique('uq_crm_party_code').on(table.compId, table.partyCode),
  }),
);

export const tblCrmPartyAddress = pgTable('tbl_crm_party_address', {
  addressId: bigint('address_id', { mode: 'number' })
    .primaryKey()
    .default(sql`nextval('seq_party_address_id')`),
  partyId: bigint('party_id', { mode: 'number' })
    .notNull()
    .references(() => tblCrmParty.partyId),
  addressLabel: varchar('address_label', { length: 80 })
    .notNull()
    .default('Head Office / Billing'),
  addressType: varchar('address_type', { length: 30 })
    .notNull()
    .default('BOTH'),
  gstin: varchar('gstin', { length: 20 }),
  stateCode: varchar('state_code', { length: 5 }).notNull().default('24'),
  stateName: varchar('state_name', { length: 80 }).notNull().default('Gujarat'),
  addressLine1: varchar('address_line1', { length: 200 }).notNull(),
  addressLine2: varchar('address_line2', { length: 200 }),
  city: varchar('city', { length: 80 }).notNull(),
  pincode: varchar('pincode', { length: 15 }).notNull(),
  contactPerson: varchar('contact_person', { length: 100 }),
  phone: varchar('phone', { length: 25 }),
  email: varchar('email', { length: 150 }),
  isDefaultBilling: boolean('is_default_billing').notNull().default(false),
  isDefaultShipping: boolean('is_default_shipping').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  ...standardAuditColumns,
});







// ============================================================================
// 19. Tiered Price Lists, Volume Discounts & Vendor Rate Contracts (Step 4.2)
// ============================================================================

export const tblCrmPriceList = pgTable(
  'tbl_crm_price_list',
  {
    priceListId: bigint('price_list_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_price_list_id')`),
    priceListCode: varchar('price_list_code', { length: 50 }).notNull(),
    priceListName: varchar('price_list_name', { length: 150 }).notNull(),
    priceListType: varchar('price_list_type', { length: 30 })
      .notNull()
      .default('SALES'), // 'SALES', 'PURCHASE', 'JOB_WORK'
    currencyCode: varchar('currency_code', { length: 10 })
      .notNull()
      .default('INR'),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    isDefault: boolean('is_default').notNull().default(false),
    description: varchar('description', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqCrmPriceListCode: unique('uq_crm_price_list_code').on(
      table.compId,
      table.priceListCode,
    ),
  }),
);

export const tblCrmPriceListItem = pgTable(
  'tbl_crm_price_list_item',
  {
    priceListItemId: bigint('price_list_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_price_list_item_id')`),
    priceListId: bigint('price_list_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmPriceList.priceListId),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    minQty: numeric('min_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('1.000'),
    maxQty: numeric('max_qty', { precision: 14, scale: 3 }),
    baseRate: numeric('base_rate', { precision: 14, scale: 4 }).notNull(),
    discountPct: numeric('discount_pct', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    effectiveRate: numeric('effective_rate', { precision: 14, scale: 4 }).notNull(),
    leadTimeDays: integer('lead_time_days').notNull().default(0),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqCrmPriceListItem: unique('uq_crm_price_list_item').on(
      table.priceListId,
      table.itemId,
      table.minQty,
    ),
  }),
);

export const tblCrmPartyPriceList = pgTable(
  'tbl_crm_party_price_list',
  {
    partyPriceListId: bigint('party_price_list_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_party_price_list_id')`),
    partyId: bigint('party_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmParty.partyId),
    priceListId: bigint('price_list_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmPriceList.priceListId),
    isPrimary: boolean('is_primary').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqCrmPartyPriceList: unique('uq_crm_party_price_list').on(
      table.partyId,
      table.priceListId,
    ),
  }),
);


// ============================================================================
// 20. Material Purchase Requisition (MR) & Authorization (Step 5.1)
// ============================================================================

export const tblPrHeader = pgTable(
  'tbl_pr_header',
  {
    prId: bigint('pr_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_pr_id')`),
    prNo: varchar('pr_no', { length: 50 }).notNull(),
    prDate: date('pr_date').notNull(),
    requiredByDate: date('required_by_date').notNull(),
    departmentId: bigint('department_id', { mode: 'number' })
      .notNull()
      .references(() => tblHrDepartment.deptId),
    requesterUserId: bigint('requester_user_id', { mode: 'number' })
      .notNull()
      .references(() => tblSecUser.userId),
    warehouseId: bigint('warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    priority: varchar('priority', { length: 20 })
      .notNull()
      .default('MEDIUM'), // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL_URGENT'
    prType: varchar('pr_type', { length: 30 })
      .notNull()
      .default('RAW_MATERIAL'), // 'RAW_MATERIAL', 'CAPITAL_ASSET', 'CONSUMABLE_MRO', 'TOOLING_SPARE', 'JOB_WORK_SERVICE'
    status: varchar('status', { length: 20 })
      .notNull()
      .default('DRAFT'), // 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED'
    totalEstimatedAmount: numeric('total_estimated_amount', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    purpose: varchar('purpose', { length: 350 }).notNull(),
    approvalRemarks: varchar('approval_remarks', { length: 350 }),
    approvedBy: bigint('approved_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    approvedDate: timestamp('approved_date', { withTimezone: true }),
    rejectedBy: bigint('rejected_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    rejectedDate: timestamp('rejected_date', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqPrHeaderNo: unique('uq_pr_header_no').on(table.compId, table.prNo),
  }),
);

export const tblPrItem = pgTable(
  'tbl_pr_item',
  {
    prItemId: bigint('pr_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_pr_item_id')`),
    prId: bigint('pr_id', { mode: 'number' })
      .notNull()
      .references(() => tblPrHeader.prId),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    requiredQty: numeric('required_qty', { precision: 14, scale: 3 }).notNull(),
    approvedQty: numeric('approved_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    orderedQty: numeric('ordered_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    estimatedRate: numeric('estimated_rate', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    estimatedAmount: numeric('estimated_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    suggestedVendorId: bigint('suggested_vendor_id', {
      mode: 'number',
    }).references(() => tblCrmParty.partyId),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqPrItem: unique('uq_pr_item').on(table.prId, table.itemId),
  }),
);

// ============================================================================
// 12. Supplier Request for Quotation (RFQ) & Comparative Statement (Step 5.2)
// ============================================================================

export const tblRfqHeader = pgTable(
  'tbl_rfq_header',
  {
    rfqId: bigint('rfq_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_rfq_id')`),
    rfqNo: varchar('rfq_no', { length: 50 }).notNull(),
    rfqDate: date('rfq_date').notNull().defaultNow(),
    dueDate: date('due_date').notNull(),
    warehouseId: bigint('warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'),
    paymentTerms: varchar('payment_terms', { length: 150 }),
    deliveryTerms: varchar('delivery_terms', { length: 150 }),
    remarks: varchar('remarks', { length: 350 }),
    awardedVendorId: bigint('awarded_vendor_id', { mode: 'number' }).references(
      () => tblCrmParty.partyId,
    ),
    awardedDate: timestamp('awarded_date', { withTimezone: true }),
    awardedRemarks: varchar('awarded_remarks', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqRfqHeaderNo: unique('uq_rfq_header_no').on(table.compId, table.rfqNo),
  }),
);

export const tblRfqItem = pgTable(
  'tbl_rfq_item',
  {
    rfqItemId: bigint('rfq_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_rfq_item_id')`),
    rfqId: bigint('rfq_id', { mode: 'number' })
      .notNull()
      .references(() => tblRfqHeader.rfqId),
    prItemId: bigint('pr_item_id', { mode: 'number' }).references(
      () => tblPrItem.prItemId,
    ),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    requiredQty: numeric('required_qty', { precision: 14, scale: 3 }).notNull(),
    targetRate: numeric('target_rate', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    technicalSpecs: varchar('technical_specs', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqRfqItem: unique('uq_rfq_item').on(table.rfqId, table.itemId),
  }),
);

export const tblRfqVendor = pgTable(
  'tbl_rfq_vendor',
  {
    rfqVendorId: bigint('rfq_vendor_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_rfq_vendor_id')`),
    rfqId: bigint('rfq_id', { mode: 'number' })
      .notNull()
      .references(() => tblRfqHeader.rfqId),
    partyId: bigint('party_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmParty.partyId),
    invitationDate: timestamp('invitation_date', { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: varchar('status', { length: 25 }).notNull().default('INVITED'),
    vendorQuoteRef: varchar('vendor_quote_ref', { length: 100 }),
    quoteDate: date('quote_date'),
    totalQuoteAmount: numeric('total_quote_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    paymentTerms: varchar('payment_terms', { length: 150 }),
    deliveryLeadTimeDays: integer('delivery_lead_time_days').default(0),
    vendorRemarks: varchar('vendor_remarks', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqRfqVendor: unique('uq_rfq_vendor').on(table.rfqId, table.partyId),
  }),
);

export const tblRfqVendorItem = pgTable(
  'tbl_rfq_vendor_item',
  {
    rfqVendorItemId: bigint('rfq_vendor_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_rfq_vendor_item_id')`),
    rfqVendorId: bigint('rfq_vendor_id', { mode: 'number' })
      .notNull()
      .references(() => tblRfqVendor.rfqVendorId),
    rfqItemId: bigint('rfq_item_id', { mode: 'number' })
      .notNull()
      .references(() => tblRfqItem.rfqItemId),
    offeredQty: numeric('offered_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    quotedRate: numeric('quoted_rate', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    discountPct: numeric('discount_pct', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    netRate: numeric('net_rate', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    taxPct: numeric('tax_pct', { precision: 5, scale: 2 })
      .notNull()
      .default('18.00'),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    isL1: boolean('is_l1').notNull().default(false),
    isAwarded: boolean('is_awarded').notNull().default(false),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqRfqVendorItem: unique('uq_rfq_vendor_item').on(
      table.rfqVendorId,
      table.rfqItemId,
    ),
  }),
);

// ============================================================================
// 13. Purchase Order Management & Line Items (Step 5.3)
// ============================================================================

export const tblPoHeader = pgTable(
  'tbl_po_header',
  {
    poId: bigint('po_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_po_id')`),
    poNo: varchar('po_no', { length: 50 }).notNull(),
    poDate: date('po_date').notNull().defaultNow(),
    deliveryDueDate: date('delivery_due_date').notNull(),
    vendorId: bigint('vendor_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmParty.partyId),
    vendorAddressId: bigint('vendor_address_id', { mode: 'number' }).references(
      () => tblCrmPartyAddress.addressId,
    ),
    warehouseId: bigint('warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    rfqId: bigint('rfq_id', { mode: 'number' }).references(
      () => tblRfqHeader.rfqId,
    ),
    prId: bigint('pr_id', { mode: 'number' }).references(
      () => tblPrHeader.prId,
    ),
    poType: varchar('po_type', { length: 30 })
      .notNull()
      .default('STANDARD_PO'),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'),
    paymentTerms: varchar('payment_terms', { length: 150 }),
    deliveryTerms: varchar('delivery_terms', { length: 150 }),
    freightTerms: varchar('freight_terms', { length: 100 }),
    subtotalAmount: numeric('subtotal_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    discountAmount: numeric('discount_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    taxAmount: numeric('tax_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    roundoffAmount: numeric('roundoff_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    netTotalAmount: numeric('net_total_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    notes: varchar('notes', { length: 500 }),
    approvedBy: bigint('approved_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    approvedDate: timestamp('approved_date', { withTimezone: true }),
    releasedBy: bigint('released_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    releasedDate: timestamp('released_date', { withTimezone: true }),
    cancellationReason: varchar('cancellation_reason', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqPoHeaderNo: unique('uq_po_header_no').on(table.compId, table.poNo),
  }),
);

export const tblPoItem = pgTable(
  'tbl_po_item',
  {
    poItemId: bigint('po_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_po_item_id')`),
    poId: bigint('po_id', { mode: 'number' })
      .notNull()
      .references(() => tblPoHeader.poId),
    prItemId: bigint('pr_item_id', { mode: 'number' }).references(
      () => tblPrItem.prItemId,
    ),
    rfqItemId: bigint('rfq_item_id', { mode: 'number' }).references(
      () => tblRfqItem.rfqItemId,
    ),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    orderQty: numeric('order_qty', { precision: 14, scale: 3 }).notNull(),
    unitRate: numeric('unit_rate', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    discountPct: numeric('discount_pct', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    discountAmount: numeric('discount_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    taxPct: numeric('tax_pct', { precision: 5, scale: 2 })
      .notNull()
      .default('18.00'),
    taxAmount: numeric('tax_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    netAmount: numeric('net_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    receivedQty: numeric('received_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    billedQty: numeric('billed_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    deliveryDate: date('delivery_date'),
    technicalSpecs: varchar('technical_specs', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqPoItem: unique('uq_po_item').on(table.poId, table.itemId),
  }),
);

export const tblGateInwardHeader = pgTable(
  'tbl_gate_inward_header',
  {
    gateInwardId: bigint('gate_inward_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_gate_inward_id')`),
    gateInwardNo: varchar('gate_inward_no', { length: 50 }).notNull(),
    inwardDate: date('inward_date').notNull(),
    inwardTime: varchar('inward_time', { length: 10 }).notNull(),
    warehouseId: bigint('warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    vendorId: bigint('vendor_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmParty.partyId),
    poId: bigint('po_id', { mode: 'number' }).references(
      () => tblPoHeader.poId,
    ),
    challanNo: varchar('challan_no', { length: 100 }).notNull(),
    challanDate: date('challan_date').notNull(),
    vehicleNo: varchar('vehicle_no', { length: 50 }).notNull(),
    transporterName: varchar('transporter_name', { length: 150 }),
    driverName: varchar('driver_name', { length: 100 }),
    driverPhone: varchar('driver_phone', { length: 30 }),
    ewayBillNo: varchar('eway_bill_no', { length: 50 }),
    lrNo: varchar('lr_no', { length: 50 }),
    lrDate: date('lr_date'),
    grossWeight: numeric('gross_weight', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    tareWeight: numeric('tare_weight', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    netWeight: numeric('net_weight', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    totalPackages: integer('total_packages').notNull().default(1),
    status: varchar('status', { length: 25 }).notNull().default('INWARDED'),
    securityRemarks: varchar('security_remarks', { length: 350 }),
    unloadedDate: timestamp('unloaded_date', { withTimezone: true }),
    unloadedBy: bigint('unloaded_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    unloadingRemarks: varchar('unloading_remarks', { length: 350 }),
    exitDate: timestamp('exit_date', { withTimezone: true }),
    exitRemarks: varchar('exit_remarks', { length: 350 }),
    cancelReason: varchar('cancel_reason', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqGateInwardHeaderNo: unique('uq_gate_inward_header_no').on(
      table.compId,
      table.gateInwardNo,
    ),
  }),
);

export const tblGateInwardItem = pgTable(
  'tbl_gate_inward_item',
  {
    gateInwardItemId: bigint('gate_inward_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_gate_inward_item_id')`),
    gateInwardId: bigint('gate_inward_id', { mode: 'number' })
      .notNull()
      .references(() => tblGateInwardHeader.gateInwardId),
    poItemId: bigint('po_item_id', { mode: 'number' }).references(
      () => tblPoItem.poItemId,
    ),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    itemDescription: varchar('item_description', { length: 250 }),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    challanQty: numeric('challan_qty', { precision: 14, scale: 3 }).notNull(),
    packageCount: integer('package_count').notNull().default(1),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqGateInwardItem: unique('uq_gate_inward_item').on(
      table.gateInwardId,
      table.itemId,
    ),
  }),
);

export const tblInvGrnHeader = pgTable(
  'tbl_inv_grn_header',
  {
    grnId: bigint('grn_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_grn_id')`),
    grnNo: varchar('grn_no', { length: 50 }).notNull(),
    grnDate: date('grn_date').notNull(),
    warehouseId: bigint('warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    vendorId: bigint('vendor_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmParty.partyId),
    poId: bigint('po_id', { mode: 'number' }).references(
      () => tblPoHeader.poId,
    ),
    gateInwardId: bigint('gate_inward_id', { mode: 'number' }).references(
      () => tblGateInwardHeader.gateInwardId,
    ),
    challanNo: varchar('challan_no', { length: 100 }).notNull(),
    challanDate: date('challan_date').notNull(),
    invoiceNo: varchar('invoice_no', { length: 100 }),
    invoiceDate: date('invoice_date'),
    vehicleNo: varchar('vehicle_no', { length: 50 }),
    ewayBillNo: varchar('eway_bill_no', { length: 50 }),
    lrNo: varchar('lr_no', { length: 50 }),
    lrDate: date('lr_date'),
    totalReceivedAmount: numeric('total_received_amount', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'),
    storeRemarks: varchar('store_remarks', { length: 350 }),
    inspectedBy: bigint('inspected_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    inspectionDate: timestamp('inspection_date', { withTimezone: true }),
    approvedBy: bigint('approved_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    approvalDate: timestamp('approval_date', { withTimezone: true }),
    approvalRemarks: varchar('approval_remarks', { length: 350 }),
    cancelReason: varchar('cancel_reason', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqInvGrnHeaderNo: unique('uq_inv_grn_header_no').on(
      table.compId,
      table.grnNo,
    ),
  }),
);

export const tblInvGrnItem = pgTable(
  'tbl_inv_grn_item',
  {
    grnItemId: bigint('grn_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_grn_item_id')`),
    grnId: bigint('grn_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvGrnHeader.grnId),
    poItemId: bigint('po_item_id', { mode: 'number' }).references(
      () => tblPoItem.poItemId,
    ),
    gateInwardItemId: bigint('gate_inward_item_id', { mode: 'number' }).references(
      () => tblGateInwardItem.gateInwardItemId,
    ),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    itemDescription: varchar('item_description', { length: 250 }),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    orderQty: numeric('order_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    challanQty: numeric('challan_qty', { precision: 14, scale: 3 }).notNull(),
    receivedQty: numeric('received_qty', { precision: 14, scale: 3 }).notNull(),
    acceptedQty: numeric('accepted_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    rejectedQty: numeric('rejected_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    quarantineQty: numeric('quarantine_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    shortageQty: numeric('shortage_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    excessQty: numeric('excess_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    unitRate: numeric('unit_rate', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    receivedAmount: numeric('received_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    batchNo: varchar('batch_no', { length: 100 }),
    mfgDate: date('mfg_date'),
    expiryDate: date('expiry_date'),
    quarantineBinId: bigint('quarantine_bin_id', { mode: 'number' }).references(
      () => tblInvStorageBin.binId,
    ),
    storageBinId: bigint('storage_bin_id', { mode: 'number' }).references(
      () => tblInvStorageBin.binId,
    ),
    isQcRequired: boolean('is_qc_required').notNull().default(true),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqInvGrnItem: unique('uq_inv_grn_item').on(table.grnId, table.itemId),
  }),
);

// ============================================================================
// 34. Inward Material QC Inspection Tables
// ============================================================================

export const tblQcInwardInspectionHeader = pgTable(
  'tbl_qc_inward_inspection_header',
  {
    qcId: bigint('qc_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_qc_inward_id')`),
    qcNo: varchar('qc_no', { length: 50 }).notNull(),
    qcDate: date('qc_date').notNull(),
    grnId: bigint('grn_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvGrnHeader.grnId),
    warehouseId: bigint('warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    vendorId: bigint('vendor_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmParty.partyId),
    poId: bigint('po_id', { mode: 'number' }).references(
      () => tblPoHeader.poId,
    ),
    gateInwardId: bigint('gate_inward_id', { mode: 'number' }).references(
      () => tblGateInwardHeader.gateInwardId,
    ),
    sampleSize: numeric('sample_size', { precision: 14, scale: 3 })
      .notNull()
      .default('1.000'),
    inspectionType: varchar('inspection_type', { length: 50 })
      .notNull()
      .default('INCOMING_RAW_MATERIAL'),
    overallResult: varchar('overall_result', { length: 30 })
      .notNull()
      .default('PENDING'),
    inspectorId: bigint('inspector_id', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    inspectionDate: timestamp('inspection_date', { withTimezone: true }),
    approverId: bigint('approver_id', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    approvalDate: timestamp('approval_date', { withTimezone: true }),
    remarks: varchar('remarks', { length: 350 }),
    deviationReason: varchar('deviation_reason', { length: 350 }),
    testCertNo: varchar('test_cert_no', { length: 100 }),
    testCertDate: date('test_cert_date'),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqQcInwardHeaderNo: unique('uq_qc_inward_header_no').on(
      table.compId,
      table.qcNo,
    ),
  }),
);

export const tblQcInwardInspectionItem = pgTable(
  'tbl_qc_inward_inspection_item',
  {
    qcItemId: bigint('qc_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_qc_inward_item_id')`),
    qcId: bigint('qc_id', { mode: 'number' })
      .notNull()
      .references(() => tblQcInwardInspectionHeader.qcId),
    grnItemId: bigint('grn_item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvGrnItem.grnItemId),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    receivedQty: numeric('received_qty', { precision: 14, scale: 3 }).notNull(),
    sampleQty: numeric('sample_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('1.000'),
    acceptedQty: numeric('accepted_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    rejectedQty: numeric('rejected_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    disposition: varchar('disposition', { length: 30 })
      .notNull()
      .default('ACCEPTED'),
    defectCode: varchar('defect_code', { length: 50 }),
    batchNo: varchar('batch_no', { length: 100 }),
    heatNo: varchar('heat_no', { length: 100 }),
    mfgDate: date('mfg_date'),
    expiryDate: date('expiry_date'),
    quarantineBinId: bigint('quarantine_bin_id', { mode: 'number' }).references(
      () => tblInvStorageBin.binId,
    ),
    destinationBinId: bigint('destination_bin_id', { mode: 'number' }).references(
      () => tblInvStorageBin.binId,
    ),
    visualCheck: varchar('visual_check', { length: 20 }).default('PASS'),
    dimensionCheck: varchar('dimension_check', { length: 20 }).default('PASS'),
    chemicalTest: varchar('chemical_test', { length: 20 }).default('PASS'),
    hardnessTest: varchar('hardness_test', { length: 20 }).default('PASS'),
    observedParameters: jsonb('observed_parameters'),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqQcInwardItem: unique('uq_qc_inward_item').on(table.qcId, table.grnItemId),
  }),
);

export const tblInvPutawayHeader = pgTable(
  'tbl_inv_putaway_header',
  {
    putawayId: bigint('putaway_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_putaway_id')`),
    compId: bigint('comp_id', { mode: 'number' })
      .notNull()
      .default(1001)
      .references(() => tblOrgCompany.compId),
    branchId: bigint('branch_id', { mode: 'number' })
      .notNull()
      .default(1001)
      .references(() => tblOrgBranch.branchId),
    fyearId: bigint('fyear_id', { mode: 'number' }).references(
      () => tblOrgFinancialYear.fyearId,
    ),
    putawayNo: varchar('putaway_no', { length: 50 }).notNull(),
    putawayDate: date('putaway_date').notNull().default(sql`CURRENT_DATE`),
    warehouseId: bigint('warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    grnId: bigint('grn_id', { mode: 'number' }).references(
      () => tblInvGrnHeader.grnId,
    ),
    qcId: bigint('qc_id', { mode: 'number' }).references(
      () => tblQcInwardInspectionHeader.qcId,
    ),
    assignedTo: bigint('assigned_to', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    putawayType: varchar('putaway_type', { length: 50 })
      .notNull()
      .default('GRN_INWARD'),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'),
    totalItems: integer('total_items').notNull().default(0),
    totalQty: numeric('total_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    completedDate: timestamp('completed_date', { withTimezone: true }),
    completedBy: bigint('completed_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    remarks: varchar('remarks', { length: 350 }),
    cancelReason: varchar('cancel_reason', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqInvPutawayNo: unique('uq_inv_putaway_no').on(table.compId, table.putawayNo),
  }),
);

export const tblInvPutawayItem = pgTable(
  'tbl_inv_putaway_item',
  {
    putawayItemId: bigint('putaway_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_putaway_item_id')`),
    putawayId: bigint('putaway_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvPutawayHeader.putawayId),
    grnItemId: bigint('grn_item_id', { mode: 'number' }).references(
      () => tblInvGrnItem.grnItemId,
    ),
    qcItemId: bigint('qc_item_id', { mode: 'number' }).references(
      () => tblQcInwardInspectionItem.qcItemId,
    ),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    itemDescription: varchar('item_description', { length: 250 }),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    sourceBinId: bigint('source_bin_id', { mode: 'number' }).references(
      () => tblInvStorageBin.binId,
    ),
    destinationBinId: bigint('destination_bin_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvStorageBin.binId),
    allocatedQty: numeric('allocated_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    putawayQty: numeric('putaway_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    batchNo: varchar('batch_no', { length: 100 }),
    heatNo: varchar('heat_no', { length: 100 }),
    mfgDate: date('mfg_date'),
    expiryDate: date('expiry_date'),
    status: varchar('status', { length: 25 }).notNull().default('PENDING'),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
);

export const tblInvBinStock = pgTable(
  'tbl_inv_bin_stock',
  {
    binStockId: bigint('bin_stock_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_bin_stock_id')`),
    compId: bigint('comp_id', { mode: 'number' })
      .notNull()
      .default(1001)
      .references(() => tblOrgCompany.compId),
    branchId: bigint('branch_id', { mode: 'number' })
      .notNull()
      .default(1001)
      .references(() => tblOrgBranch.branchId),
    fyearId: bigint('fyear_id', { mode: 'number' }).references(
      () => tblOrgFinancialYear.fyearId,
    ),
    warehouseId: bigint('warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    binId: bigint('bin_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvStorageBin.binId),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    batchNo: varchar('batch_no', { length: 100 }),
    heatNo: varchar('heat_no', { length: 100 }),
    onHandQty: numeric('on_hand_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    reservedQty: numeric('reserved_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    availableQty: numeric('available_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    unitCost: numeric('unit_cost', { precision: 14, scale: 4 }).default('0.0000'),
    totalValuation: numeric('total_valuation', { precision: 14, scale: 2 }).default('0.00'),
    lastStockDate: timestamp('last_stock_date', { withTimezone: true }).default(sql`CURRENT_TIMESTAMP`),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqInvBinStockUnique: unique('uq_inv_bin_stock_unique').on(
      table.warehouseId,
      table.binId,
      table.itemId,
      table.batchNo,
    ),
  }),
);

export const tblInvStockLedger = pgTable(
  'tbl_inv_stock_ledger',
  {
    ledgerId: bigint('ledger_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_stock_ledger_id')`),
    compId: bigint('comp_id', { mode: 'number' })
      .notNull()
      .default(1001)
      .references(() => tblOrgCompany.compId),
    branchId: bigint('branch_id', { mode: 'number' })
      .notNull()
      .default(1001)
      .references(() => tblOrgBranch.branchId),
    fyearId: bigint('fyear_id', { mode: 'number' }).references(
      () => tblOrgFinancialYear.fyearId,
    ),
    transactionDate: timestamp('transaction_date', { withTimezone: true })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    transactionType: varchar('transaction_type', { length: 50 }).notNull(),
    referenceDocType: varchar('reference_doc_type', { length: 50 }).notNull(),
    referenceDocId: bigint('reference_doc_id', { mode: 'number' }).notNull(),
    referenceDocNo: varchar('reference_doc_no', { length: 50 }).notNull(),
    warehouseId: bigint('warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    fromBinId: bigint('from_bin_id', { mode: 'number' }).references(
      () => tblInvStorageBin.binId,
    ),
    toBinId: bigint('to_bin_id', { mode: 'number' }).references(
      () => tblInvStorageBin.binId,
    ),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    batchNo: varchar('batch_no', { length: 100 }),
    heatNo: varchar('heat_no', { length: 100 }),
    qtyIn: numeric('qty_in', { precision: 14, scale: 3 }).notNull().default('0.000'),
    qtyOut: numeric('qty_out', { precision: 14, scale: 3 }).notNull().default('0.000'),
    unitCost: numeric('unit_cost', { precision: 14, scale: 4 }).default('0.0000'),
    totalCost: numeric('total_cost', { precision: 14, scale: 2 }).default('0.00'),
    closingBalance: numeric('closing_balance', { precision: 14, scale: 3 }).notNull().default('0.000'),
    remarks: varchar('remarks', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
);

export const tblPurInvoiceHeader = pgTable(
  'tbl_pur_invoice_header',
  {
    invoiceId: bigint('invoice_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_pur_invoice_id')`),
    compId: bigint('comp_id', { mode: 'number' })
      .notNull()
      .default(1001)
      .references(() => tblOrgCompany.compId),
    branchId: bigint('branch_id', { mode: 'number' })
      .notNull()
      .default(1001)
      .references(() => tblOrgBranch.branchId),
    fyearId: bigint('fyear_id', { mode: 'number' }).references(
      () => tblOrgFinancialYear.fyearId,
    ),
    invoiceNo: varchar('invoice_no', { length: 50 }).notNull(),
    invoiceDate: date('invoice_date').notNull().default(sql`CURRENT_DATE`),
    vendorId: bigint('vendor_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmParty.partyId),
    poId: bigint('po_id', { mode: 'number' }).references(
      () => tblPoHeader.poId,
    ),
    grnId: bigint('grn_id', { mode: 'number' }).references(
      () => tblInvGrnHeader.grnId,
    ),
    qcId: bigint('qc_id', { mode: 'number' }).references(
      () => tblQcInwardInspectionHeader.qcId,
    ),
    vendorInvoiceNo: varchar('vendor_invoice_no', { length: 100 }).notNull(),
    vendorInvoiceDate: date('vendor_invoice_date').notNull(),
    vendorGstin: varchar('vendor_gstin', { length: 20 }),
    paymentTermsDays: integer('payment_terms_days').notNull().default(30),
    dueDate: date('due_date').notNull(),
    subtotalAmount: numeric('subtotal_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    discountAmount: numeric('discount_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    taxableAmount: numeric('taxable_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    cgstAmount: numeric('cgst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    sgstAmount: numeric('sgst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    igstAmount: numeric('igst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalTaxAmount: numeric('total_tax_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    freightCharges: numeric('freight_charges', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    insuranceCharges: numeric('insurance_charges', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    packagingCharges: numeric('packaging_charges', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    tdsRate: numeric('tds_rate', { precision: 6, scale: 3 }).notNull().default('0.000'),
    tdsAmount: numeric('tds_amount', { precision: 14, scale: 2 }).notNull().default('0.00'),
    tcsRate: numeric('tcs_rate', { precision: 6, scale: 3 }).notNull().default('0.000'),
    tcsAmount: numeric('tcs_amount', { precision: 14, scale: 2 }).notNull().default('0.00'),
    roundOff: numeric('round_off', { precision: 8, scale: 2 }).notNull().default('0.00'),
    netPayableAmount: numeric('net_payable_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    paidAmount: numeric('paid_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    balanceAmount: numeric('balance_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    matchingStatus: varchar('matching_status', { length: 30 })
      .notNull()
      .default('MATCHED'),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'),
    paymentStatus: varchar('payment_status', { length: 25 })
      .notNull()
      .default('UNPAID'),
    approvedBy: bigint('approved_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    approvedDate: timestamp('approved_date', { withTimezone: true }),
    approvalRemarks: varchar('approval_remarks', { length: 350 }),
    cancelReason: varchar('cancel_reason', { length: 350 }),
    remarks: varchar('remarks', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqPurInvoiceNo: unique('uq_pur_invoice_no').on(table.compId, table.invoiceNo),
    uqPurVendorBill: unique('uq_pur_vendor_bill').on(
      table.compId,
      table.vendorId,
      table.vendorInvoiceNo,
    ),
  }),
);

export const tblPurInvoiceItem = pgTable(
  'tbl_pur_invoice_item',
  {
    invoiceItemId: bigint('invoice_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_pur_invoice_item_id')`),
    invoiceId: bigint('invoice_id', { mode: 'number' })
      .notNull()
      .references(() => tblPurInvoiceHeader.invoiceId),
    poItemId: bigint('po_item_id', { mode: 'number' }).references(
      () => tblPoItem.poItemId,
    ),
    grnItemId: bigint('grn_item_id', { mode: 'number' }).references(
      () => tblInvGrnItem.grnItemId,
    ),
    qcItemId: bigint('qc_item_id', { mode: 'number' }).references(
      () => tblQcInwardInspectionItem.qcItemId,
    ),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    itemDescription: varchar('item_description', { length: 250 }),
    hsnCode: varchar('hsn_code', { length: 20 }),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    poQty: numeric('po_qty', { precision: 14, scale: 3 }).notNull().default('0.000'),
    receivedQty: numeric('received_qty', { precision: 14, scale: 3 }).notNull().default('0.000'),
    acceptedQty: numeric('accepted_qty', { precision: 14, scale: 3 }).notNull().default('0.000'),
    billedQty: numeric('billed_qty', { precision: 14, scale: 3 }).notNull().default('0.000'),
    poRate: numeric('po_rate', { precision: 14, scale: 4 }).notNull().default('0.0000'),
    invoicedRate: numeric('invoiced_rate', { precision: 14, scale: 4 }).notNull().default('0.0000'),
    rateVariance: numeric('rate_variance', { precision: 14, scale: 4 }).notNull().default('0.0000'),
    itemAmount: numeric('item_amount', { precision: 14, scale: 2 }).notNull().default('0.00'),
    discountPercent: numeric('discount_percent', { precision: 6, scale: 2 }).notNull().default('0.00'),
    discountAmount: numeric('discount_amount', { precision: 14, scale: 2 }).notNull().default('0.00'),
    taxableAmount: numeric('taxable_amount', { precision: 14, scale: 2 }).notNull().default('0.00'),
    gstRate: numeric('gst_rate', { precision: 6, scale: 2 }).notNull().default('18.00'),
    cgstRate: numeric('cgst_rate', { precision: 6, scale: 2 }).notNull().default('9.00'),
    cgstAmount: numeric('cgst_amount', { precision: 14, scale: 2 }).notNull().default('0.00'),
    sgstRate: numeric('sgst_rate', { precision: 6, scale: 2 }).notNull().default('9.00'),
    sgstAmount: numeric('sgst_amount', { precision: 14, scale: 2 }).notNull().default('0.00'),
    igstRate: numeric('igst_rate', { precision: 6, scale: 2 }).notNull().default('0.00'),
    igstAmount: numeric('igst_amount', { precision: 14, scale: 2 }).notNull().default('0.00'),
    totalItemAmount: numeric('total_item_amount', { precision: 14, scale: 2 }).notNull().default('0.00'),
    batchNo: varchar('batch_no', { length: 100 }),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
);

// ============================================================================
// 19. Manufacturing Bill of Materials (BOM) & Multi-Level Assembly (Step 6.1)
// ============================================================================

export const tblMfgBomHeader = pgTable(
  'tbl_mfg_bom_header',
  {
    bomId: bigint('bom_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_bom_id')`),
    bomCode: varchar('bom_code', { length: 50 }).notNull(),
    bomName: varchar('bom_name', { length: 150 }).notNull(),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    outputQty: numeric('output_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('1.000'),
    versionNo: varchar('version_no', { length: 20 }).notNull().default('1.0'),
    bomType: varchar('bom_type', { length: 30 })
      .notNull()
      .default('MANUFACTURING'),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'),
    isDefault: boolean('is_default').notNull().default(true),
    effectiveFrom: date('effective_from').notNull().default(sql`CURRENT_DATE`),
    effectiveTo: date('effective_to'),
    routingId: bigint('routing_id', { mode: 'number' }),
    totalMaterialCost: numeric('total_material_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalLabourCost: numeric('total_labour_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalOverheadCost: numeric('total_overhead_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalByproductRecovery: numeric('total_byproduct_recovery', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    netUnitCost: numeric('net_unit_cost', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    approvedBy: bigint('approved_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    approvedDate: timestamp('approved_date', { withTimezone: true }),
    approvalRemarks: varchar('approval_remarks', { length: 350 }),
    remarks: varchar('remarks', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqMfgBomCode: unique('uq_mfg_bom_code').on(table.compId, table.bomCode),
    uqMfgBomVersion: unique('uq_mfg_bom_version').on(
      table.compId,
      table.itemId,
      table.versionNo,
    ),
  }),
);

export const tblMfgBomItem = pgTable(
  'tbl_mfg_bom_item',
  {
    bomItemId: bigint('bom_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_bom_item_id')`),
    bomId: bigint('bom_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgBomHeader.bomId),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    itemDescription: varchar('item_description', { length: 250 }),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    quantity: numeric('quantity', { precision: 14, scale: 4 })
      .notNull()
      .default('1.0000'),
    scrapFactorPercent: numeric('scrap_factor_percent', { precision: 6, scale: 2 })
      .notNull()
      .default('0.00'),
    grossQuantity: numeric('gross_quantity', { precision: 14, scale: 4 })
      .notNull()
      .default('1.0000'),
    childBomId: bigint('child_bom_id', { mode: 'number' }).references(
      () => tblMfgBomHeader.bomId,
    ),
    unitCost: numeric('unit_cost', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    lineCost: numeric('line_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    sourceType: varchar('source_type', { length: 30 })
      .notNull()
      .default('PURCHASED'),
    operationSeq: integer('operation_seq').notNull().default(10),
    operationName: varchar('operation_name', { length: 100 }).default(
      'Component Assembly',
    ),
    isCritical: boolean('is_critical').notNull().default(false),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
);

export const tblMfgBomByproduct = pgTable(
  'tbl_mfg_bom_byproduct',
  {
    bomByproductId: bigint('bom_byproduct_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_bom_byproduct_id')`),
    bomId: bigint('bom_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgBomHeader.bomId),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    itemDescription: varchar('item_description', { length: 250 }),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    quantity: numeric('quantity', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    productType: varchar('product_type', { length: 30 })
      .notNull()
      .default('RECOVERABLE_SCRAP'),
    costAllocationPercent: numeric('cost_allocation_percent', { precision: 6, scale: 2 })
      .notNull()
      .default('0.00'),
    estimatedRecoveryRate: numeric('estimated_recovery_rate', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    estimatedRecoveryValue: numeric('estimated_recovery_value', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
);

// ============================================================================
// 19. Manufacturing Work Centers, Capacity & Shifts (Step 6.2)
// ============================================================================

export const tblMfgShift = pgTable(
  'tbl_mfg_shift',
  {
    shiftId: bigint('shift_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_shift_id')`),
    shiftCode: varchar('shift_code', { length: 30 }).notNull(),
    shiftName: varchar('shift_name', { length: 100 }).notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    breakDurationMins: integer('break_duration_mins').notNull().default(30),
    effectiveWorkingHours: numeric('effective_working_hours', { precision: 5, scale: 2 })
      .notNull()
      .default('8.00'),
    isNightShift: boolean('is_night_shift').notNull().default(false),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqMfgShiftCode: unique('uq_mfg_shift_code').on(
      table.compId,
      table.branchId,
      table.shiftCode,
    ),
  }),
);

export const tblMfgWorkCenter = pgTable(
  'tbl_mfg_work_center',
  {
    workCenterId: bigint('work_center_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_work_center_id')`),
    workCenterCode: varchar('work_center_code', { length: 50 }).notNull(),
    workCenterName: varchar('work_center_name', { length: 250 }).notNull(),
    workCenterType: varchar('work_center_type', { length: 30 })
      .notNull()
      .default('MACHINE'),
    deptId: bigint('dept_id', { mode: 'number' }).references(
      () => tblHrDepartment.deptId,
    ),
    locationDesc: varchar('location_desc', { length: 200 }),
    capacityPerDayHours: numeric('capacity_per_day_hours', { precision: 6, scale: 2 })
      .notNull()
      .default('8.00'),
    efficiencyPercent: numeric('efficiency_percent', { precision: 5, scale: 2 })
      .notNull()
      .default('85.00'),
    capacityUom: varchar('capacity_uom', { length: 20 })
      .notNull()
      .default('HOURS'),
    costPerHour: numeric('cost_per_hour', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    labourCostPerHour: numeric('labour_cost_per_hour', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    overheadCostPerHour: numeric('overhead_cost_per_hour', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalHourlyRate: numeric('total_hourly_rate', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    status: varchar('status', { length: 30 }).notNull().default('ACTIVE'),
    remarks: varchar('remarks', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqMfgWorkCenterCode: unique('uq_mfg_work_center_code').on(
      table.compId,
      table.branchId,
      table.workCenterCode,
    ),
  }),
);

export const tblMfgWorkCenterMachine = pgTable(
  'tbl_mfg_work_center_machine',
  {
    wcMachineId: bigint('wc_machine_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_wc_machine_id')`),
    workCenterId: bigint('work_center_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgWorkCenter.workCenterId),
    machineCode: varchar('machine_code', { length: 50 }).notNull(),
    machineName: varchar('machine_name', { length: 200 }).notNull(),
    modelNo: varchar('model_no', { length: 100 }),
    serialNo: varchar('serial_no', { length: 100 }),
    manufacturer: varchar('manufacturer', { length: 150 }),
    installationDate: date('installation_date'),
    warrantyExpiryDate: date('warranty_expiry_date'),
    powerRatingKw: numeric('power_rating_kw', { precision: 8, scale: 2 }).default('0.00'),
    status: varchar('status', { length: 30 }).notNull().default('OPERATIONAL'),
    lastMaintenanceDate: date('last_maintenance_date'),
    nextMaintenanceDue: date('next_maintenance_due'),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqMfgWcMachineCode: unique('uq_mfg_wc_machine_code').on(
      table.compId,
      table.branchId,
      table.machineCode,
    ),
  }),
);

export const tblMfgWorkCenterShift = pgTable(
  'tbl_mfg_work_center_shift',
  {
    wcShiftId: bigint('wc_shift_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_wc_shift_id')`),
    workCenterId: bigint('work_center_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgWorkCenter.workCenterId),
    shiftId: bigint('shift_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgShift.shiftId),
    daysOfWeek: varchar('days_of_week', { length: 50 }).default('MON,TUE,WED,THU,FRI,SAT'),
    operatorCount: integer('operator_count').notNull().default(1),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqMfgWcShift: unique('uq_mfg_wc_shift').on(
      table.workCenterId,
      table.shiftId,
    ),
  }),
);

export const tblMfgRoutingHeader = pgTable(
  'tbl_mfg_routing_header',
  {
    routingId: bigint('routing_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_routing_id')`),
    routingCode: varchar('routing_code', { length: 50 }).notNull(),
    routingName: varchar('routing_name', { length: 200 }).notNull(),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    versionNo: varchar('version_no', { length: 20 }).notNull().default('1.0'),
    status: varchar('status', { length: 30 }).notNull().default('DRAFT'),
    isDefault: boolean('is_default').notNull().default(true),
    effectiveFrom: date('effective_from').notNull().default(sql`CURRENT_DATE`),
    effectiveTo: date('effective_to'),
    batchSize: numeric('batch_size', { precision: 14, scale: 3 })
      .notNull()
      .default('1.000'),
    totalSetupTimeMins: numeric('total_setup_time_mins', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    totalRunTimeMins: numeric('total_run_time_mins', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    totalLeadTimeDays: numeric('total_lead_time_days', { precision: 6, scale: 2 })
      .notNull()
      .default('1.00'),
    totalMachineCost: numeric('total_machine_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalLaborCost: numeric('total_labor_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalOverheadCost: numeric('total_overhead_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalCostPerUnit: numeric('total_cost_per_unit', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    approvedBy: bigint('approved_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    approvedDate: timestamp('approved_date', { withTimezone: true }),
    approvalRemarks: varchar('approval_remarks', { length: 350 }),
    remarks: varchar('remarks', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqMfgRoutingCode: unique('uq_mfg_routing_code').on(
      table.compId,
      table.routingCode,
    ),
    uqMfgRoutingVersion: unique('uq_mfg_routing_version').on(
      table.compId,
      table.itemId,
      table.versionNo,
    ),
  }),
);

export const tblMfgRoutingOperation = pgTable(
  'tbl_mfg_routing_operation',
  {
    routingOpId: bigint('routing_op_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_routing_op_id')`),
    routingId: bigint('routing_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgRoutingHeader.routingId),
    opSequence: integer('op_sequence').notNull().default(10),
    opCode: varchar('op_code', { length: 30 }).notNull(),
    opName: varchar('op_name', { length: 200 }).notNull(),
    workCenterId: bigint('work_center_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgWorkCenter.workCenterId),
    machineId: bigint('machine_id', { mode: 'number' }).references(
      () => tblMfgWorkCenterMachine.wcMachineId,
    ),
    setupTimeMins: numeric('setup_time_mins', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    runTimeMins: numeric('run_time_mins', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    overlapPercent: numeric('overlap_percent', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    machineHourlyRate: numeric('machine_hourly_rate', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    laborHourlyRate: numeric('labor_hourly_rate', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    overheadHourlyRate: numeric('overhead_hourly_rate', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalHourlyRate: numeric('total_hourly_rate', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    machineCostPerUnit: numeric('machine_cost_per_unit', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    laborCostPerUnit: numeric('labor_cost_per_unit', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    overheadCostPerUnit: numeric('overhead_cost_per_unit', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    totalCostPerUnit: numeric('total_cost_per_unit', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    toolingDescription: varchar('tooling_description', { length: 300 }),
    fixtureNo: varchar('fixture_no', { length: 100 }),
    isInspectionRequired: boolean('is_inspection_required').notNull().default(false),
    qcCheckpoints: varchar('qc_checkpoints', { length: 350 }),
    isSubcontracted: boolean('is_subcontracted').notNull().default(false),
    subcontractVendorId: bigint('subcontract_vendor_id', { mode: 'number' }).references(
      () => tblCrmParty.partyId,
    ),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqMfgRoutingOpSeq: unique('uq_mfg_routing_op_seq').on(
      table.routingId,
      table.opSequence,
    ),
  }),
);

export const tblMfgMrpRunHeader = pgTable(
  'tbl_mfg_mrp_run_header',
  {
    mrpRunId: bigint('mrp_run_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_mrp_run_id')`),
    mrpRunNo: varchar('mrp_run_no', { length: 50 }).notNull(),
    runDate: timestamp('run_date', { withTimezone: true })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    planningHorizonDays: integer('planning_horizon_days').notNull().default(30),
    demandSource: varchar('demand_source', { length: 30 })
      .notNull()
      .default('BUFFER_DEFICIT'),
    status: varchar('status', { length: 25 }).notNull().default('COMPLETED'),
    totalItemsAnalyzed: integer('total_items_analyzed').notNull().default(0),
    totalPlannedOrders: integer('total_planned_orders').notNull().default(0),
    totalPlannedBuyQty: numeric('total_planned_buy_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    totalPlannedMakeQty: numeric('total_planned_make_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    totalEstimatedSpend: numeric('total_estimated_spend', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    executionTimeMs: integer('execution_time_ms').default(0),
    runBy: bigint('run_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    remarks: varchar('remarks', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqMfgMrpRunNo: unique('uq_mfg_mrp_run_no').on(
      table.compId,
      table.branchId,
      table.mrpRunNo,
    ),
  }),
);

export const tblMfgMrpPlannedOrder = pgTable(
  'tbl_mfg_mrp_planned_order',
  {
    plannedOrderId: bigint('planned_order_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_mrp_planned_order_id')`),
    mrpRunId: bigint('mrp_run_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgMrpRunHeader.mrpRunId),
    plannedOrderNo: varchar('planned_order_no', { length: 50 }).notNull(),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    bomId: bigint('bom_id', { mode: 'number' }).references(
      () => tblMfgBomHeader.bomId,
    ),
    routingId: bigint('routing_id', { mode: 'number' }).references(
      () => tblMfgRoutingHeader.routingId,
    ),
    orderType: varchar('order_type', { length: 25 }).notNull().default('BUY'),
    sourceDemandType: varchar('source_demand_type', { length: 35 })
      .notNull()
      .default('BUFFER_DEFICIT'),
    parentPlannedOrderId: bigint('parent_planned_order_id', { mode: 'number' }),
    bomLevel: integer('bom_level').notNull().default(0),
    grossRequirementQty: numeric('gross_requirement_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    onHandStockQty: numeric('on_hand_stock_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    scheduledReceiptsQty: numeric('scheduled_receipts_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    safetyStockQty: numeric('safety_stock_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    netRequirementQty: numeric('net_requirement_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    plannedOrderQty: numeric('planned_order_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    leadTimeDays: integer('lead_time_days').notNull().default(1),
    requiredByDate: date('required_by_date').notNull(),
    orderReleaseDate: date('order_release_date').notNull(),
    estimatedUnitCost: numeric('estimated_unit_cost', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    estimatedTotalCost: numeric('estimated_total_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    status: varchar('status', { length: 25 }).notNull().default('SUGGESTED'),
    convertedPrId: bigint('converted_pr_id', { mode: 'number' }).references(
      () => tblPrHeader.prId,
    ),
    convertedWoId: bigint('converted_wo_id', { mode: 'number' }),
    remarks: varchar('remarks', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
);

// ============================================================================
// 53. Work Order Header
// ============================================================================
export const tblMfgWoHeader = pgTable(
  'tbl_mfg_wo_header',
  {
    woId: bigint('wo_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_wo_id')`),
    woNo: varchar('wo_no', { length: 50 }).notNull(),
    woDate: date('wo_date').notNull(),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    bomId: bigint('bom_id', { mode: 'number' }).references(
      () => tblMfgBomHeader.bomId,
    ),
    routingId: bigint('routing_id', { mode: 'number' }).references(
      () => tblMfgRoutingHeader.routingId,
    ),
    targetWarehouseId: bigint('target_warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    wipWarehouseId: bigint('wip_warehouse_id', { mode: 'number' }).references(
      () => tblInvWarehouse.warehouseId,
    ),
    plannedQty: numeric('planned_qty', { precision: 14, scale: 3 }).notNull(),
    completedQty: numeric('completed_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    scrappedQty: numeric('scrapped_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    scheduledStartDate: date('scheduled_start_date').notNull(),
    scheduledEndDate: date('scheduled_end_date').notNull(),
    actualStartDate: timestamp('actual_start_date', { withTimezone: true }),
    actualEndDate: timestamp('actual_end_date', { withTimezone: true }),
    priority: varchar('priority', { length: 20 })
      .notNull()
      .default('MEDIUM'), // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL_URGENT'
    status: varchar('status', { length: 25 })
      .notNull()
      .default('DRAFT'), // 'DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED'
    salesOrderId: bigint('sales_order_id', { mode: 'number' }),
    mrpPlannedOrderId: bigint('mrp_planned_order_id', { mode: 'number' }).references(
      () => tblMfgMrpPlannedOrder.plannedOrderId,
    ),
    batchNo: varchar('batch_no', { length: 100 }),
    estimatedMaterialCost: numeric('estimated_material_cost', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    estimatedOperationCost: numeric('estimated_operation_cost', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    estimatedTotalCost: numeric('estimated_total_cost', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    actualMaterialCost: numeric('actual_material_cost', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    actualOperationCost: numeric('actual_operation_cost', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    actualTotalCost: numeric('actual_total_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    releasedBy: bigint('released_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    releasedDate: timestamp('released_date', { withTimezone: true }),
    remarks: varchar('remarks', { length: 350 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqMfgWoNo: unique('uq_mfg_wo_no').on(table.compId, table.branchId, table.woNo),
  }),
);

// ============================================================================
// 54. Work Order BOM Component Snapshot
// ============================================================================
export const tblMfgWoBomItem = pgTable(
  'tbl_mfg_wo_bom_item',
  {
    woBomItemId: bigint('wo_bom_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_wo_bom_item_id')`),
    woId: bigint('wo_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgWoHeader.woId, { onDelete: 'cascade' }),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    itemDescription: varchar('item_description', { length: 250 }),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    standardQtyPerUnit: numeric('standard_qty_per_unit', {
      precision: 14,
      scale: 4,
    }).notNull(),
    scrapFactorPercent: numeric('scrap_factor_percent', {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    requiredQty: numeric('required_qty', { precision: 14, scale: 3 }).notNull(),
    issuedQty: numeric('issued_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    consumedQty: numeric('consumed_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    returnedQty: numeric('returned_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    unitCost: numeric('unit_cost', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    estimatedCost: numeric('estimated_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    actualCost: numeric('actual_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    sourceType: varchar('source_type', { length: 25 })
      .notNull()
      .default('PURCHASED'),
    operationSeq: integer('operation_seq'),
    isCritical: boolean('is_critical').notNull().default(false),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqMfgWoBomItem: unique('uq_mfg_wo_bom_item').on(table.woId, table.itemId),
  }),
);

// ============================================================================
// 55. Work Order Routing Operations Snapshot
// ============================================================================
export const tblMfgWoRoutingOp = pgTable(
  'tbl_mfg_wo_routing_op',
  {
    woRoutingOpId: bigint('wo_routing_op_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_wo_routing_op_id')`),
    woId: bigint('wo_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgWoHeader.woId, { onDelete: 'cascade' }),
    opSequence: integer('op_sequence').notNull(),
    opCode: varchar('op_code', { length: 30 }).notNull(),
    opName: varchar('op_name', { length: 200 }).notNull(),
    workCenterId: bigint('work_center_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgWorkCenter.workCenterId),
    machineId: bigint('machine_id', { mode: 'number' }).references(
      () => tblMfgWorkCenterMachine.wcMachineId,
    ),
    plannedSetupTimeMins: numeric('planned_setup_time_mins', {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    plannedRunTimeMins: numeric('planned_run_time_mins', {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    actualSetupTimeMins: numeric('actual_setup_time_mins', {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    actualRunTimeMins: numeric('actual_run_time_mins', {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    plannedCost: numeric('planned_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    actualCost: numeric('actual_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    plannedQty: numeric('planned_qty', { precision: 14, scale: 3 }).notNull(),
    completedQty: numeric('completed_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    scrappedQty: numeric('scrapped_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    reworkQty: numeric('rework_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    status: varchar('status', { length: 25 })
      .notNull()
      .default('PENDING'), // 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'SKIPPED'
    scheduledStartDate: date('scheduled_start_date'),
    scheduledEndDate: date('scheduled_end_date'),
    isInspectionRequired: boolean('is_inspection_required')
      .notNull()
      .default(false),
    isSubcontracted: boolean('is_subcontracted').notNull().default(false),
    subcontractVendorId: bigint('subcontract_vendor_id', {
      mode: 'number',
    }).references(() => tblCrmParty.partyId),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqMfgWoOpSeq: unique('uq_mfg_wo_op_seq').on(table.woId, table.opSequence),
  }),
);

// ============================================================================
// 56. Shopfloor Material Issue Header
// ============================================================================
export const tblMfgMaterialIssueHeader = pgTable(
  'tbl_mfg_material_issue_header',
  {
    issueId: bigint('issue_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_material_issue_id')`),
    issueNo: varchar('issue_no', { length: 50 }).notNull(),
    issueDate: date('issue_date').notNull().default(sql`CURRENT_DATE`),
    woId: bigint('wo_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgWoHeader.woId),
    issueType: varchar('issue_type', { length: 30 })
      .notNull()
      .default('STANDARD_ISSUE'), // 'STANDARD_ISSUE', 'RETURN_TO_STORE', 'SCRAP_ADJUSTMENT', 'LINESIDE_TRANSFER'
    fromWarehouseId: bigint('from_warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    toWarehouseId: bigint('to_warehouse_id', { mode: 'number' }).references(
      () => tblInvWarehouse.warehouseId,
    ),
    status: varchar('status', { length: 25 })
      .notNull()
      .default('DRAFT'), // 'DRAFT', 'SUBMITTED', 'POSTED', 'CANCELLED'
    totalItems: integer('total_items').notNull().default(0),
    totalQuantity: numeric('total_quantity', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    totalCost: numeric('total_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    issuedBy: bigint('issued_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    receivedBy: bigint('received_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    remarks: varchar('remarks', { length: 400 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqMfgMaterialIssueNo: unique('uq_mfg_material_issue_no').on(
      table.compId,
      table.branchId,
      table.issueNo,
    ),
  }),
);

// ============================================================================
// 57. Shopfloor Material Issue Items
// ============================================================================
export const tblMfgMaterialIssueItem = pgTable(
  'tbl_mfg_material_issue_item',
  {
    issueItemId: bigint('issue_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_material_issue_item_id')`),
    issueId: bigint('issue_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgMaterialIssueHeader.issueId, {
        onDelete: 'cascade',
      }),
    woBomItemId: bigint('wo_bom_item_id', { mode: 'number' }).references(
      () => tblMfgWoBomItem.woBomItemId,
    ),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    requiredQty: numeric('required_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    previouslyIssuedQty: numeric('previously_issued_qty', {
      precision: 14,
      scale: 3,
    })
      .notNull()
      .default('0.000'),
    issueQty: numeric('issue_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    unitCost: numeric('unit_cost', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    totalCost: numeric('total_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    batchNo: varchar('batch_no', { length: 100 }),
    heatNo: varchar('heat_no', { length: 100 }),
    binLocation: varchar('bin_location', { length: 60 }),
    remarks: varchar('remarks', { length: 255 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
);



// ============================================================================
// 58. Production Job Cards
// ============================================================================
export const tblMfgJobCard = pgTable(
  'tbl_mfg_job_card',
  {
    jobCardId: bigint('job_card_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_job_card_id')`),
    jobCardNo: varchar('job_card_no', { length: 50 }).notNull(),
    jobCardDate: date('job_card_date', { mode: 'string' })
      .notNull()
      .default(sql`CURRENT_DATE`),
    woId: bigint('wo_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgWoHeader.woId),
    woRoutingOpId: bigint('wo_routing_op_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgWoRoutingOp.woRoutingOpId),
    opSequence: integer('op_sequence').notNull(),
    opCode: varchar('op_code', { length: 50 }).notNull(),
    opName: varchar('op_name', { length: 200 }).notNull(),
    workCenterId: bigint('work_center_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgWorkCenter.workCenterId),
    machineId: bigint('machine_id', { mode: 'number' }).references(
      () => tblMfgWorkCenterMachine.wcMachineId,
    ),
    assignedOperatorId: bigint('assigned_operator_id', {
      mode: 'number',
    }).references(() => tblSecUser.userId),
    plannedQty: numeric('planned_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    inputQty: numeric('input_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    completedQty: numeric('completed_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    scrappedQty: numeric('scrapped_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    reworkQty: numeric('rework_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    status: varchar('status', { length: 25 }).notNull().default('PENDING'),
    scheduledStartDate: date('scheduled_start_date', { mode: 'string' }),
    scheduledEndDate: date('scheduled_end_date', { mode: 'string' }),
    actualStartTime: timestamp('actual_start_time', { withTimezone: true }),
    actualEndTime: timestamp('actual_end_time', { withTimezone: true }),
    plannedSetupMins: numeric('planned_setup_mins', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    plannedRunMins: numeric('planned_run_mins', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    actualSetupMins: numeric('actual_setup_mins', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    actualRunMins: numeric('actual_run_mins', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    downtimeMins: numeric('downtime_mins', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    downtimeReason: varchar('downtime_reason', { length: 250 }),
    hourlyRate: numeric('hourly_rate', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    actualCost: numeric('actual_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    isInspectionRequired: boolean('is_inspection_required')
      .notNull()
      .default(false),
    inProcessQcStatus: varchar('in_process_qc_status', { length: 30 })
      .notNull()
      .default('NA'),
    qcInspectorId: bigint('qc_inspector_id', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    qcInspectedAt: timestamp('qc_inspected_at', { withTimezone: true }),
    qcSampleSize: integer('qc_sample_size').default(0),
    qcAcceptedQty: numeric('qc_accepted_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    qcRejectedQty: numeric('qc_rejected_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    qcRemarks: varchar('qc_remarks', { length: 400 }),
    batchNo: varchar('batch_no', { length: 100 }),
    heatNo: varchar('heat_no', { length: 100 }),
    remarks: varchar('remarks', { length: 400 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqMfgJobCardNo: unique('uq_mfg_job_card_no').on(
      table.compId,
      table.branchId,
      table.jobCardNo,
    ),
  }),
);

// ============================================================================
// 59. Production Job Card Time & Output Logs
// ============================================================================
export const tblMfgJobCardTimeLog = pgTable(
  'tbl_mfg_job_card_time_log',
  {
    logId: bigint('log_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_job_card_time_log_id')`),
    jobCardId: bigint('job_card_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgJobCard.jobCardId, { onDelete: 'cascade' }),
    operatorId: bigint('operator_id', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    machineId: bigint('machine_id', { mode: 'number' }).references(
      () => tblMfgWorkCenterMachine.wcMachineId,
    ),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }),
    setupMins: numeric('setup_mins', { precision: 8, scale: 2 })
      .notNull()
      .default('0.00'),
    runMins: numeric('run_mins', { precision: 8, scale: 2 })
      .notNull()
      .default('0.00'),
    downtimeMins: numeric('downtime_mins', { precision: 8, scale: 2 })
      .notNull()
      .default('0.00'),
    downtimeReason: varchar('downtime_reason', { length: 250 }),
    completedQty: numeric('completed_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    scrappedQty: numeric('scrapped_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    reworkQty: numeric('rework_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
);

// ============================================================================
// 60. Subcontractor Job-Work Outward Delivery Challan (tbl_mfg_job_work_challan)
// ============================================================================
export const tblMfgJobWorkChallan = pgTable(
  'tbl_mfg_job_work_challan',
  {
    challanId: bigint('challan_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_job_work_challan_id')`),
    challanNo: varchar('challan_no', { length: 50 }).notNull(),
    challanDate: date('challan_date').notNull().default(sql`CURRENT_DATE`),
    vendorId: bigint('vendor_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmParty.partyId),
    woId: bigint('wo_id', { mode: 'number' }).references(
      () => tblMfgWoHeader.woId,
    ),
    woRoutingOpId: bigint('wo_routing_op_id', { mode: 'number' }).references(
      () => tblMfgWoRoutingOp.woRoutingOpId,
    ),
    jobCardId: bigint('job_card_id', { mode: 'number' }).references(
      () => tblMfgJobCard.jobCardId,
    ),
    natureOfProcessing: varchar('nature_of_processing', { length: 250 }).notNull(),
    fromWarehouseId: bigint('from_warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    expectedReturnDate: date('expected_return_date'),
    transporterName: varchar('transporter_name', { length: 150 }),
    vehicleNo: varchar('vehicle_no', { length: 50 }),
    ewayBillNo: varchar('eway_bill_no', { length: 60 }),
    status: varchar('status', { length: 30 }).notNull().default('DRAFT'),
    totalItems: integer('total_items').notNull().default(0),
    totalSentQty: numeric('total_sent_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    totalEstimatedValue: numeric('total_estimated_value', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    dispatchedBy: bigint('dispatched_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    remarks: varchar('remarks', { length: 400 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqMfgJwChallanNo: unique('uq_mfg_jw_challan_no').on(
      table.compId,
      table.branchId,
      table.challanNo,
    ),
  }),
);

// ============================================================================
// 61. Subcontractor Job-Work Challan Items (tbl_mfg_job_work_challan_item)
// ============================================================================
export const tblMfgJobWorkChallanItem = pgTable(
  'tbl_mfg_job_work_challan_item',
  {
    challanItemId: bigint('challan_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_job_work_challan_item_id')`),
    challanId: bigint('challan_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgJobWorkChallan.challanId, { onDelete: 'cascade' }),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    itemDescription: varchar('item_description', { length: 250 }),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    sentQty: numeric('sent_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    unitRate: numeric('unit_rate', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    totalValue: numeric('total_value', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    hsnCode: varchar('hsn_code', { length: 30 }),
    batchNo: varchar('batch_no', { length: 100 }),
    heatNo: varchar('heat_no', { length: 100 }),
    receivedQty: numeric('received_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    scrapReturnedQty: numeric('scrap_returned_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    lossQty: numeric('loss_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    pendingQty: numeric('pending_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
);

// ============================================================================
// 62. Subcontractor Job-Work Inward Receipt (tbl_mfg_job_work_receipt)
// ============================================================================
export const tblMfgJobWorkReceipt = pgTable(
  'tbl_mfg_job_work_receipt',
  {
    receiptId: bigint('receipt_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_job_work_receipt_id')`),
    receiptNo: varchar('receipt_no', { length: 50 }).notNull(),
    receiptDate: date('receipt_date').notNull().default(sql`CURRENT_DATE`),
    challanId: bigint('challan_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgJobWorkChallan.challanId),
    vendorId: bigint('vendor_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmParty.partyId),
    woId: bigint('wo_id', { mode: 'number' }).references(
      () => tblMfgWoHeader.woId,
    ),
    vendorDcNo: varchar('vendor_dc_no', { length: 60 }),
    vendorDcDate: date('vendor_dc_date'),
    vendorInvoiceNo: varchar('vendor_invoice_no', { length: 60 }),
    toWarehouseId: bigint('to_warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    serviceCharges: numeric('service_charges', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    taxAmount: numeric('tax_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    status: varchar('status', { length: 30 }).notNull().default('SUBMITTED'),
    receivedBy: bigint('received_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    qcInspectedBy: bigint('qc_inspected_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    qcStatus: varchar('qc_status', { length: 30 }).notNull().default('PENDING'),
    remarks: varchar('remarks', { length: 400 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqMfgJwReceiptNo: unique('uq_mfg_jw_receipt_no').on(
      table.compId,
      table.branchId,
      table.receiptNo,
    ),
  }),
);

// ============================================================================
// 63. Subcontractor Job-Work Receipt Items (tbl_mfg_job_work_receipt_item)
// ============================================================================
export const tblMfgJobWorkReceiptItem = pgTable(
  'tbl_mfg_job_work_receipt_item',
  {
    receiptItemId: bigint('receipt_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_job_work_receipt_item_id')`),
    receiptId: bigint('receipt_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgJobWorkReceipt.receiptId, { onDelete: 'cascade' }),
    challanItemId: bigint('challan_item_id', { mode: 'number' }).references(
      () => tblMfgJobWorkChallanItem.challanItemId,
    ),
    receivedItemId: bigint('received_item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    receivedQty: numeric('received_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    acceptedQty: numeric('accepted_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    rejectedQty: numeric('rejected_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    reworkQty: numeric('rework_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    scrapQty: numeric('scrap_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    lossQty: numeric('loss_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    processingRate: numeric('processing_rate', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    processingAmount: numeric('processing_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    batchNo: varchar('batch_no', { length: 100 }),
    heatNo: varchar('heat_no', { length: 100 }),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
);

// ============================================================================
// 64. Finished Goods (FG) Production Receipt Header (tbl_mfg_fg_receipt_header)
// ============================================================================
export const tblMfgFgReceiptHeader = pgTable(
  'tbl_mfg_fg_receipt_header',
  {
    fgReceiptId: bigint('fg_receipt_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_fg_receipt_id')`),
    receiptNo: varchar('receipt_no', { length: 50 }).notNull(),
    receiptDate: date('receipt_date').notNull().default(sql`CURRENT_DATE`),
    woId: bigint('wo_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgWoHeader.woId),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    toWarehouseId: bigint('to_warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    toBinId: bigint('to_bin_id', { mode: 'number' }).references(
      () => tblInvStorageBin.binId,
    ),
    batchNo: varchar('batch_no', { length: 100 }),
    heatNo: varchar('heat_no', { length: 100 }),
    manufacturingDate: date('manufacturing_date').notNull().default(sql`CURRENT_DATE`),
    expiryDate: date('expiry_date'),
    receivedQty: numeric('received_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    acceptedQty: numeric('accepted_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    rejectedQty: numeric('rejected_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    reworkQty: numeric('rework_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    qcStatus: varchar('qc_status', { length: 30 }).notNull().default('PENDING'),
    qcInspectedBy: bigint('qc_inspected_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    qcInspectedAt: timestamp('qc_inspected_at', { withTimezone: true }),
    qcRemarks: varchar('qc_remarks', { length: 350 }),
    materialCost: numeric('material_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    operationCost: numeric('operation_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    byproductCredit: numeric('byproduct_credit', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalCost: numeric('total_cost', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    unitCost: numeric('unit_cost', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'),
    postedBy: bigint('posted_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    remarks: varchar('remarks', { length: 400 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqMfgFgReceiptNo: unique('uq_mfg_fg_receipt_no').on(
      table.compId,
      table.branchId,
      table.receiptNo,
    ),
  }),
);

// ============================================================================
// 65. FG Receipt Scrap & By-Product Accounting (tbl_mfg_fg_receipt_byproduct)
// ============================================================================
export const tblMfgFgReceiptByproduct = pgTable(
  'tbl_mfg_fg_receipt_byproduct',
  {
    receiptByproductId: bigint('receipt_byproduct_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_fg_receipt_byproduct_id')`),
    fgReceiptId: bigint('fg_receipt_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgFgReceiptHeader.fgReceiptId, { onDelete: 'cascade' }),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    productType: varchar('product_type', { length: 30 })
      .notNull()
      .default('RECOVERABLE_SCRAP'),
    quantity: numeric('quantity', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    recoveryRate: numeric('recovery_rate', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    totalRecoveryValue: numeric('total_recovery_value', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    toWarehouseId: bigint('to_warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    toBinId: bigint('to_bin_id', { mode: 'number' }).references(
      () => tblInvStorageBin.binId,
    ),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
);

// ============================================================================
// 66. Customer Inquiry & Sales Quotation Header (tbl_sales_quotation_header)
// ============================================================================
export const tblSalesQuotationHeader = pgTable(
  'tbl_sales_quotation_header',
  {
    quotationId: bigint('quotation_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_quotation_id')`),
    quotationNo: varchar('quotation_no', { length: 50 }).notNull(),
    quotationDate: date('quotation_date').notNull().default(sql`CURRENT_DATE`),
    inquiryRefNo: varchar('inquiry_ref_no', { length: 80 }),
    inquiryDate: date('inquiry_date'),
    customerId: bigint('customer_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmParty.partyId),
    customerName: varchar('customer_name', { length: 150 }).notNull(),
    contactPerson: varchar('contact_person', { length: 100 }),
    contactEmail: varchar('contact_email', { length: 150 }),
    contactPhone: varchar('contact_phone', { length: 25 }),
    billingAddressId: bigint('billing_address_id', { mode: 'number' }).references(
      () => tblCrmPartyAddress.addressId,
    ),
    billingAddress: text('billing_address'),
    shippingAddressId: bigint('shipping_address_id', { mode: 'number' }).references(
      () => tblCrmPartyAddress.addressId,
    ),
    shippingAddress: text('shipping_address'),
    shippingStateCode: varchar('shipping_state_code', { length: 10 })
      .notNull()
      .default('24'),
    shippingStateName: varchar('shipping_state_name', { length: 100 })
      .notNull()
      .default('Gujarat'),
    customerGstin: varchar('customer_gstin', { length: 20 }),
    priceListId: bigint('price_list_id', { mode: 'number' }).references(
      () => tblCrmPriceList.priceListId,
    ),
    currencyCode: varchar('currency_code', { length: 10 })
      .notNull()
      .default('INR'),
    exchangeRate: numeric('exchange_rate', { precision: 10, scale: 4 })
      .notNull()
      .default('1.0000'),
    validUntil: date('valid_until').notNull(),
    deliveryLeadTimeDays: integer('delivery_lead_time_days')
      .notNull()
      .default(14),
    paymentTerms: varchar('payment_terms', { length: 100 })
      .notNull()
      .default('NET_30'),
    deliveryTerms: varchar('delivery_terms', { length: 100 })
      .notNull()
      .default('EX_WORKS'),
    subtotalAmount: numeric('subtotal_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    discountPercent: numeric('discount_percent', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    discountAmount: numeric('discount_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    taxableAmount: numeric('taxable_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    cgstAmount: numeric('cgst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    sgstAmount: numeric('sgst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    igstAmount: numeric('igst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalTaxAmount: numeric('total_tax_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    freightCharges: numeric('freight_charges', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    packagingCharges: numeric('packaging_charges', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    roundOff: numeric('round_off', { precision: 8, scale: 2 })
      .notNull()
      .default('0.00'),
    grandTotal: numeric('grand_total', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    revisionNo: integer('revision_no').notNull().default(0),
    revisionDate: date('revision_date'),
    revisionReason: varchar('revision_reason', { length: 255 }),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'),
    submittedBy: bigint('submitted_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    convertedToSoId: bigint('converted_to_so_id', { mode: 'number' }),
    convertedAt: timestamp('converted_at', { withTimezone: true }),
    remarks: varchar('remarks', { length: 500 }),
    termsAndConditions: text('terms_and_conditions'),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqSalesQuotationNo: unique('uq_sales_quotation_no').on(
      table.compId,
      table.branchId,
      table.quotationNo,
      table.revisionNo,
    ),
  }),
);

// ============================================================================
// 67. Customer Inquiry & Sales Quotation Items (tbl_sales_quotation_item)
// ============================================================================
export const tblSalesQuotationItem = pgTable(
  'tbl_sales_quotation_item',
  {
    quotationItemId: bigint('quotation_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_quotation_item_id')`),
    quotationId: bigint('quotation_id', { mode: 'number' })
      .notNull()
      .references(() => tblSalesQuotationHeader.quotationId, {
        onDelete: 'cascade',
      }),
    itemSequence: integer('item_sequence').notNull().default(1),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    itemCode: varchar('item_code', { length: 50 }).notNull(),
    itemName: varchar('item_name', { length: 150 }).notNull(),
    description: varchar('description', { length: 400 }),
    hsnSacCode: varchar('hsn_sac_code', { length: 20 }),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    quantity: numeric('quantity', { precision: 14, scale: 3 })
      .notNull()
      .default('1.000'),
    unitRate: numeric('unit_rate', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    grossAmount: numeric('gross_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    discountPercent: numeric('discount_percent', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    discountAmount: numeric('discount_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    taxableAmount: numeric('taxable_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    gstRate: numeric('gst_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('18.00'),
    cgstRate: numeric('cgst_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    cgstAmount: numeric('cgst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    sgstRate: numeric('sgst_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    sgstAmount: numeric('sgst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    igstRate: numeric('igst_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    igstAmount: numeric('igst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalTaxAmount: numeric('total_tax_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    deliveryLeadTimeDays: integer('delivery_lead_time_days').default(14),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
);

// ============================================================================
// 68. Sales Orders & Credit Exposure Management (tbl_sales_order_header)
// ============================================================================
export const tblSalesOrderHeader = pgTable(
  'tbl_sales_order_header',
  {
    soId: bigint('so_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_sales_order_id')`),
    soNo: varchar('so_no', { length: 50 }).notNull(),
    soDate: date('so_date').notNull().default(sql`CURRENT_DATE`),
    quotationId: bigint('quotation_id', { mode: 'number' }).references(
      () => tblSalesQuotationHeader.quotationId,
    ),
    customerId: bigint('customer_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmParty.partyId),
    customerName: varchar('customer_name', { length: 150 }).notNull(),
    customerPoNo: varchar('customer_po_no', { length: 80 }),
    customerPoDate: date('customer_po_date'),
    contactPerson: varchar('contact_person', { length: 100 }),
    contactEmail: varchar('contact_email', { length: 150 }),
    contactPhone: varchar('contact_phone', { length: 25 }),
    billingAddressId: bigint('billing_address_id', { mode: 'number' }).references(
      () => tblCrmPartyAddress.addressId,
    ),
    billingAddress: text('billing_address'),
    shippingAddressId: bigint('shipping_address_id', { mode: 'number' }).references(
      () => tblCrmPartyAddress.addressId,
    ),
    shippingAddress: text('shipping_address'),
    shippingStateCode: varchar('shipping_state_code', { length: 10 })
      .notNull()
      .default('24'),
    shippingStateName: varchar('shipping_state_name', { length: 100 })
      .notNull()
      .default('Gujarat'),
    customerGstin: varchar('customer_gstin', { length: 20 }),
    priceListId: bigint('price_list_id', { mode: 'number' }).references(
      () => tblCrmPriceList.priceListId,
    ),
    currencyCode: varchar('currency_code', { length: 10 })
      .notNull()
      .default('INR'),
    exchangeRate: numeric('exchange_rate', { precision: 10, scale: 4 })
      .notNull()
      .default('1.0000'),
    targetDeliveryDate: date('target_delivery_date')
      .notNull()
      .default(sql`(CURRENT_DATE + INTERVAL '21 days')`),
    paymentTerms: varchar('payment_terms', { length: 100 })
      .notNull()
      .default('NET_30'),
    deliveryTerms: varchar('delivery_terms', { length: 100 })
      .notNull()
      .default('EX_WORKS'),
    customerCreditLimit: numeric('customer_credit_limit', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    currentCreditExposure: numeric('current_credit_exposure', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    isCreditLimitExceeded: boolean('is_credit_limit_exceeded')
      .notNull()
      .default(false),
    creditOverrideBy: bigint('credit_override_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    creditOverrideAt: timestamp('credit_override_at', { withTimezone: true }),
    creditOverrideReason: varchar('credit_override_reason', { length: 255 }),
    subtotalAmount: numeric('subtotal_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    discountPercent: numeric('discount_percent', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    discountAmount: numeric('discount_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    taxableAmount: numeric('taxable_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    cgstAmount: numeric('cgst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    sgstAmount: numeric('sgst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    igstAmount: numeric('igst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalTaxAmount: numeric('total_tax_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    freightCharges: numeric('freight_charges', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    packagingCharges: numeric('packaging_charges', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    roundOff: numeric('round_off', { precision: 8, scale: 2 })
      .notNull()
      .default('0.00'),
    grandTotal: numeric('grand_total', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'),
    atpReservationStatus: varchar('atp_reservation_status', { length: 25 })
      .notNull()
      .default('PENDING'),
    confirmedBy: bigint('confirmed_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    holdReason: varchar('hold_reason', { length: 255 }),
    remarks: varchar('remarks', { length: 500 }),
    termsAndConditions: text('terms_and_conditions'),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqSalesOrderNo: unique('uq_sales_order_no').on(
      table.compId,
      table.branchId,
      table.soNo,
    ),
  }),
);

// ============================================================================
// 69. Sales Order Items & ATP Reservation (tbl_sales_order_item)
// ============================================================================
export const tblSalesOrderItem = pgTable(
  'tbl_sales_order_item',
  {
    soItemId: bigint('so_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_so_item_id')`),
    soId: bigint('so_id', { mode: 'number' })
      .notNull()
      .references(() => tblSalesOrderHeader.soId, { onDelete: 'cascade' }),
    itemSequence: integer('item_sequence').notNull().default(1),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    itemCode: varchar('item_code', { length: 50 }).notNull(),
    itemName: varchar('item_name', { length: 150 }).notNull(),
    description: varchar('description', { length: 400 }),
    hsnSacCode: varchar('hsn_sac_code', { length: 20 }),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    orderedQty: numeric('ordered_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('1.000'),
    reservedQty: numeric('reserved_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    deliveredQty: numeric('delivered_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    invoicedQty: numeric('invoiced_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    cancelledQty: numeric('cancelled_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    unitRate: numeric('unit_rate', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    grossAmount: numeric('gross_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    discountPercent: numeric('discount_percent', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    discountAmount: numeric('discount_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    taxableAmount: numeric('taxable_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    gstRate: numeric('gst_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('18.00'),
    cgstRate: numeric('cgst_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    cgstAmount: numeric('cgst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    sgstRate: numeric('sgst_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    sgstAmount: numeric('sgst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    igstRate: numeric('igst_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    igstAmount: numeric('igst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalTaxAmount: numeric('total_tax_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    targetDeliveryDate: date('target_delivery_date'),
    reservationStatus: varchar('reservation_status', { length: 25 })
      .notNull()
      .default('PENDING'),
    workOrderId: bigint('work_order_id', { mode: 'number' }).references(
      () => tblMfgWoHeader.woId,
    ),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
);




// ============================================================================
// 27. Sales Delivery Challan Header & Items (Step 7.3)
// ============================================================================

export const tblSalesDeliveryChallanHeader = pgTable(
  'tbl_sales_delivery_challan_header',
  {
    challanId: bigint('challan_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_delivery_challan_id')`),
    challanNo: varchar('challan_no', { length: 50 }).notNull(),
    challanDate: date('challan_date').notNull().defaultNow(),
    soId: bigint('so_id', { mode: 'number' }).references(
      () => tblSalesOrderHeader.soId,
    ),
    soNo: varchar('so_no', { length: 50 }),
    customerId: bigint('customer_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmParty.partyId),
    customerName: varchar('customer_name', { length: 150 }).notNull(),
    contactPerson: varchar('contact_person', { length: 100 }),
    contactPhone: varchar('contact_phone', { length: 25 }),
    billingAddressId: bigint('billing_address_id', { mode: 'number' }).references(
      () => tblCrmPartyAddress.addressId,
    ),
    billingAddress: text('billing_address'),
    shippingAddressId: bigint('shipping_address_id', { mode: 'number' }).references(
      () => tblCrmPartyAddress.addressId,
    ),
    shippingAddress: text('shipping_address'),
    shippingStateCode: varchar('shipping_state_code', { length: 10 })
      .notNull()
      .default('24'),
    shippingStateName: varchar('shipping_state_name', { length: 100 })
      .notNull()
      .default('Gujarat'),
    customerGstin: varchar('customer_gstin', { length: 20 }),
    dispatchPurpose: varchar('dispatch_purpose', { length: 50 })
      .notNull()
      .default('SUPPLY_ON_SALE'),
    transporterId: bigint('transporter_id', { mode: 'number' }).references(
      () => tblCrmParty.partyId,
    ),
    transporterName: varchar('transporter_name', { length: 150 }),
    vehicleNo: varchar('vehicle_no', { length: 50 }),
    lrRrNo: varchar('lr_rr_no', { length: 80 }),
    lrRrDate: date('lr_rr_date'),
    eWayBillNo: varchar('e_way_bill_no', { length: 50 }),
    eWayBillDate: date('e_way_bill_date'),
    deliveryTerms: varchar('delivery_terms', { length: 100 })
      .notNull()
      .default('EX_WORKS'),
    totalPackages: integer('total_packages').notNull().default(1),
    packageType: varchar('package_type', { length: 80 }).default('Corrugated Boxes'),
    grossWeightKg: numeric('gross_weight_kg', { precision: 10, scale: 3 }).default('0.000'),
    netWeightKg: numeric('net_weight_kg', { precision: 10, scale: 3 }).default('0.000'),
    warehouseId: bigint('warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    totalQuantity: numeric('total_quantity', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    totalValue: numeric('total_value', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'),
    pickedBy: bigint('picked_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    pickedAt: timestamp('picked_at', { withTimezone: true }),
    packedBy: bigint('packed_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    packedAt: timestamp('packed_at', { withTimezone: true }),
    dispatchedBy: bigint('dispatched_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    remarks: varchar('remarks', { length: 500 }),
    termsAndConditions: text('terms_and_conditions'),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqSalesDcNo: unique('uq_sales_delivery_challan_no').on(
      table.compId,
      table.branchId,
      table.challanNo,
    ),
  }),
);

export const tblSalesDeliveryChallanItem = pgTable(
  'tbl_sales_delivery_challan_item',
  {
    challanItemId: bigint('challan_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_challan_item_id')`),
    challanId: bigint('challan_id', { mode: 'number' })
      .notNull()
      .references(() => tblSalesDeliveryChallanHeader.challanId, {
        onDelete: 'cascade',
      }),
    soItemId: bigint('so_item_id', { mode: 'number' }).references(
      () => tblSalesOrderItem.soItemId,
    ),
    itemSequence: integer('item_sequence').notNull().default(1),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    itemCode: varchar('item_code', { length: 50 }).notNull(),
    itemName: varchar('item_name', { length: 150 }).notNull(),
    description: varchar('description', { length: 400 }),
    hsnSacCode: varchar('hsn_sac_code', { length: 20 }),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    orderedQty: numeric('ordered_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    dispatchedQty: numeric('dispatched_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('1.000'),
    warehouseId: bigint('warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    binId: bigint('bin_id', { mode: 'number' }).references(
      () => tblInvStorageBin.binId,
    ),
    batchNo: varchar('batch_no', { length: 100 }),
    heatNo: varchar('heat_no', { length: 100 }),
    unitRate: numeric('unit_rate', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
);

export const tblSalesInvoiceHeader = pgTable(
  'tbl_sales_invoice_header',
  {
    invoiceId: bigint('invoice_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_sales_invoice_id')`),
    invoiceNo: varchar('invoice_no', { length: 50 }).notNull(),
    invoiceDate: date('invoice_date').notNull().defaultNow(),
    invoiceType: varchar('invoice_type', { length: 30 })
      .notNull()
      .default('TAX_INVOICE'),
    challanId: bigint('challan_id', { mode: 'number' }).references(
      () => tblSalesDeliveryChallanHeader.challanId,
    ),
    soId: bigint('so_id', { mode: 'number' }).references(
      () => tblSalesOrderHeader.soId,
    ),
    customerId: bigint('customer_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmParty.partyId),
    customerName: varchar('customer_name', { length: 150 }).notNull(),
    contactPerson: varchar('contact_person', { length: 100 }),
    contactPhone: varchar('contact_phone', { length: 25 }),
    billingAddressId: bigint('billing_address_id', { mode: 'number' }).references(
      () => tblCrmPartyAddress.addressId,
    ),
    billingAddress: text('billing_address'),
    shippingAddressId: bigint('shipping_address_id', { mode: 'number' }).references(
      () => tblCrmPartyAddress.addressId,
    ),
    shippingAddress: text('shipping_address'),
    placeOfSupply: varchar('place_of_supply', { length: 100 })
      .notNull()
      .default('24 - Gujarat'),
    customerGstin: varchar('customer_gstin', { length: 20 }),
    customerPan: varchar('customer_pan', { length: 15 }),
    supplyType: varchar('supply_type', { length: 30 })
      .notNull()
      .default('INTRA_STATE'),
    reverseChargeApplicable: boolean('reverse_charge_applicable')
      .notNull()
      .default(false),
    transporterName: varchar('transporter_name', { length: 150 }),
    vehicleNo: varchar('vehicle_no', { length: 50 }),
    lrRrNo: varchar('lr_rr_no', { length: 80 }),
    lrRrDate: date('lr_rr_date'),
    irnStatus: varchar('irn_status', { length: 25 })
      .notNull()
      .default('NOT_GENERATED'),
    irnNo: varchar('irn_no', { length: 64 }),
    ackNo: varchar('ack_no', { length: 30 }),
    ackDate: timestamp('ack_date', { withTimezone: true }),
    signedQrCode: text('signed_qr_code'),
    eWayBillNo: varchar('e_way_bill_no', { length: 50 }),
    eWayBillDate: date('e_way_bill_date'),
    paymentTermsDays: integer('payment_terms_days').notNull().default(30),
    dueDate: date('due_date').notNull(),
    currencyCode: varchar('currency_code', { length: 5 })
      .notNull()
      .default('INR'),
    subtotalAmount: numeric('subtotal_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    discountAmount: numeric('discount_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    taxableAmount: numeric('taxable_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    cgstAmount: numeric('cgst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    sgstAmount: numeric('sgst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    igstAmount: numeric('igst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalTaxAmount: numeric('total_tax_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    freightCharges: numeric('freight_charges', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    insuranceCharges: numeric('insurance_charges', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    packagingCharges: numeric('packaging_charges', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    tcsRate: numeric('tcs_rate', { precision: 6, scale: 3 })
      .notNull()
      .default('0.000'),
    tcsAmount: numeric('tcs_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    roundOff: numeric('round_off', { precision: 8, scale: 2 })
      .notNull()
      .default('0.00'),
    totalInvoiceAmount: numeric('total_invoice_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    paidAmount: numeric('paid_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    balanceAmount: numeric('balance_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'),
    paymentStatus: varchar('payment_status', { length: 25 })
      .notNull()
      .default('UNPAID'),
    postedBy: bigint('posted_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    cancelledBy: bigint('cancelled_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancellationReason: varchar('cancellation_reason', { length: 350 }),
    remarks: varchar('remarks', { length: 500 }),
    termsAndConditions: text('terms_and_conditions'),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqSalesInvoiceNo: unique('uq_sales_invoice_no').on(
      table.compId,
      table.branchId,
      table.invoiceNo,
    ),
  }),
);

export const tblSalesInvoiceItem = pgTable(
  'tbl_sales_invoice_item',
  {
    invoiceItemId: bigint('invoice_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_sales_invoice_item_id')`),
    invoiceId: bigint('invoice_id', { mode: 'number' })
      .notNull()
      .references(() => tblSalesInvoiceHeader.invoiceId, {
        onDelete: 'cascade',
      }),
    soItemId: bigint('so_item_id', { mode: 'number' }).references(
      () => tblSalesOrderItem.soItemId,
    ),
    challanItemId: bigint('challan_item_id', { mode: 'number' }).references(
      () => tblSalesDeliveryChallanItem.challanItemId,
    ),
    itemSequence: integer('item_sequence').notNull().default(1),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    itemCode: varchar('item_code', { length: 50 }).notNull(),
    itemName: varchar('item_name', { length: 150 }).notNull(),
    description: varchar('description', { length: 400 }),
    hsnSacCode: varchar('hsn_sac_code', { length: 20 }),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    quantity: numeric('quantity', { precision: 14, scale: 3 })
      .notNull()
      .default('1.000'),
    unitRate: numeric('unit_rate', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    grossAmount: numeric('gross_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    discountPercent: numeric('discount_percent', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    discountAmount: numeric('discount_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    taxableAmount: numeric('taxable_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    gstRate: numeric('gst_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('18.00'),
    cgstRate: numeric('cgst_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    cgstAmount: numeric('cgst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    sgstRate: numeric('sgst_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    sgstAmount: numeric('sgst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    igstRate: numeric('igst_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('0.00'),
    igstAmount: numeric('igst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalTaxAmount: numeric('total_tax_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalItemAmount: numeric('total_item_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    batchNo: varchar('batch_no', { length: 100 }),
    heatNo: varchar('heat_no', { length: 100 }),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
);

export const tblSalesArPaymentReceipt = pgTable(
  'tbl_sales_ar_payment_receipt',
  {
    paymentId: bigint('payment_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_ar_payment_id')`),
    receiptNo: varchar('receipt_no', { length: 50 }).notNull(),
    receiptDate: date('receipt_date').notNull().defaultNow(),
    invoiceId: bigint('invoice_id', { mode: 'number' })
      .notNull()
      .references(() => tblSalesInvoiceHeader.invoiceId),
    customerId: bigint('customer_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmParty.partyId),
    paymentMode: varchar('payment_mode', { length: 30 })
      .notNull()
      .default('NEFT_RTGS'),
    referenceNo: varchar('reference_no', { length: 100 }),
    paymentAmount: numeric('payment_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    tdsAmount: numeric('tds_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalAllocatedAmount: numeric('total_allocated_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    bankName: varchar('bank_name', { length: 100 }),
    chequeDate: date('cheque_date'),
    remarks: varchar('remarks', { length: 350 }),
    recordedBy: bigint('recorded_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqSalesArReceiptNo: unique('uq_sales_ar_receipt_no').on(
      table.compId,
      table.branchId,
      table.receiptNo,
    ),
  }),
);

export const tblSalesReturnHeader = pgTable(
  'tbl_sales_return_header',
  {
    returnId: bigint('return_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_sales_return_id')`),
    returnNo: varchar('return_no', { length: 50 }).notNull(),
    returnDate: date('return_date').notNull().defaultNow(),
    returnType: varchar('return_type', { length: 30 })
      .notNull()
      .default('COMMERCIAL_RETURN'),
    creditNoteNo: varchar('credit_note_no', { length: 50 }),
    creditNoteDate: date('credit_note_date'),
    invoiceId: bigint('invoice_id', { mode: 'number' })
      .notNull()
      .references(() => tblSalesInvoiceHeader.invoiceId),
    invoiceNo: varchar('invoice_no', { length: 50 }).notNull(),
    invoiceDate: date('invoice_date').notNull(),
    customerId: bigint('customer_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmParty.partyId),
    customerName: varchar('customer_name', { length: 150 }).notNull(),
    customerGstin: varchar('customer_gstin', { length: 15 }),
    customerPan: varchar('customer_pan', { length: 10 }),
    billingAddress: varchar('billing_address', { length: 400 }).notNull(),
    billingCity: varchar('billing_city', { length: 50 }),
    billingState: varchar('billing_state', { length: 50 }),
    billingPincode: varchar('billing_pincode', { length: 10 }),
    billingStateCode: varchar('billing_state_code', { length: 2 })
      .notNull()
      .default('24'),
    placeOfSupply: varchar('place_of_supply', { length: 50 })
      .notNull()
      .default('Gujarat (24)'),
    posStateCode: varchar('pos_state_code', { length: 2 })
      .notNull()
      .default('24'),
    rmaReferenceNo: varchar('rma_reference_no', { length: 50 }),
    rmaReferenceDate: date('rma_reference_date'),
    gateEntryNo: varchar('gate_entry_no', { length: 50 }),
    gateEntryDate: date('gate_entry_date'),
    vehicleNo: varchar('vehicle_no', { length: 50 }),
    transporterName: varchar('transporter_name', { length: 100 }),
    lrNo: varchar('lr_no', { length: 50 }),
    lrDate: date('lr_date'),
    currencyCode: varchar('currency_code', { length: 10 })
      .notNull()
      .default('INR'),
    exchangeRate: numeric('exchange_rate', { precision: 10, scale: 4 })
      .notNull()
      .default('1.0000'),
    subtotalAmount: numeric('subtotal_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    discountAmount: numeric('discount_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    taxableAmount: numeric('taxable_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    cgstAmount: numeric('cgst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    sgstAmount: numeric('sgst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    igstAmount: numeric('igst_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    roundOffAmount: numeric('round_off_amount', { precision: 8, scale: 2 })
      .notNull()
      .default('0.00'),
    totalCreditAmount: numeric('total_credit_amount', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    arAdjustedAmount: numeric('ar_adjusted_amount', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    irnStatus: varchar('irn_status', { length: 20 })
      .notNull()
      .default('NOT_APPLICABLE'),
    irnNo: varchar('irn_no', { length: 64 }),
    ackNo: varchar('ack_no', { length: 50 }),
    ackDate: timestamp('ack_date', { withTimezone: true }),
    signedQrCode: text('signed_qr_code'),
    returnReason: varchar('return_reason', { length: 300 }).notNull(),
    qcStatus: varchar('qc_status', { length: 20 })
      .notNull()
      .default('PENDING'),
    qcInspectedBy: bigint('qc_inspected_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    qcInspectedAt: timestamp('qc_inspected_at', { withTimezone: true }),
    qcRemarks: varchar('qc_remarks', { length: 400 }),
    restockStatus: varchar('restock_status', { length: 20 })
      .notNull()
      .default('PENDING'),
    restockedBy: bigint('restocked_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    restockedAt: timestamp('restocked_at', { withTimezone: true }),
    creditNoteStatus: varchar('credit_note_status', { length: 20 })
      .notNull()
      .default('DRAFT'),
    creditPostedBy: bigint('credit_posted_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    creditPostedAt: timestamp('credit_posted_at', { withTimezone: true }),
    status: varchar('status', { length: 20 })
      .notNull()
      .default('DRAFT'),
    remarks: varchar('remarks', { length: 500 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqSalesReturnNo: unique('uq_sales_return_no').on(
      table.compId,
      table.branchId,
      table.returnNo,
    ),
  }),
);

export const tblSalesReturnItem = pgTable('tbl_sales_return_item', {
  returnItemId: bigint('return_item_id', { mode: 'number' })
    .primaryKey()
    .default(sql`nextval('seq_sales_return_item_id')`),
  returnId: bigint('return_id', { mode: 'number' })
    .notNull()
    .references(() => tblSalesReturnHeader.returnId, { onDelete: 'cascade' }),
  invoiceItemId: bigint('invoice_item_id', { mode: 'number' }).references(
    () => tblSalesInvoiceItem.invoiceItemId,
  ),
  itemSequence: integer('item_sequence').notNull().default(1),
  itemId: bigint('item_id', { mode: 'number' })
    .notNull()
    .references(() => tblInvItem.itemId),
  itemCode: varchar('item_code', { length: 50 }).notNull(),
  itemName: varchar('item_name', { length: 150 }).notNull(),
  description: varchar('description', { length: 400 }),
  hsnSacCode: varchar('hsn_sac_code', { length: 20 }).notNull(),
  uomId: bigint('uom_id', { mode: 'number' })
    .notNull()
    .references(() => tblInvUom.uomId),
  invoicedQty: numeric('invoiced_qty', { precision: 14, scale: 3 })
    .notNull()
    .default('0.000'),
  returnedQty: numeric('returned_qty', { precision: 14, scale: 3 })
    .notNull()
    .default('1.000'),
  acceptedQty: numeric('accepted_qty', { precision: 14, scale: 3 })
    .notNull()
    .default('0.000'),
  rejectedScrapQty: numeric('rejected_scrap_qty', { precision: 14, scale: 3 })
    .notNull()
    .default('0.000'),
  unitPrice: numeric('unit_price', { precision: 14, scale: 4 })
    .notNull()
    .default('0.0000'),
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 })
    .notNull()
    .default('0.00'),
  discountAmount: numeric('discount_amount', { precision: 14, scale: 2 })
    .notNull()
    .default('0.00'),
  taxableAmount: numeric('taxable_amount', { precision: 14, scale: 2 })
    .notNull()
    .default('0.00'),
  gstRate: numeric('gst_rate', { precision: 5, scale: 2 })
    .notNull()
    .default('18.00'),
  cgstRate: numeric('cgst_rate', { precision: 5, scale: 2 })
    .notNull()
    .default('9.00'),
  cgstAmount: numeric('cgst_amount', { precision: 14, scale: 2 })
    .notNull()
    .default('0.00'),
  sgstRate: numeric('sgst_rate', { precision: 5, scale: 2 })
    .notNull()
    .default('9.00'),
  sgstAmount: numeric('sgst_amount', { precision: 14, scale: 2 })
    .notNull()
    .default('0.00'),
  igstRate: numeric('igst_rate', { precision: 5, scale: 2 })
    .notNull()
    .default('0.00'),
  igstAmount: numeric('igst_amount', { precision: 14, scale: 2 })
    .notNull()
    .default('0.00'),
  lineTotal: numeric('line_total', { precision: 14, scale: 2 })
    .notNull()
    .default('0.00'),
  targetWarehouseId: bigint('target_warehouse_id', { mode: 'number' }).references(
    () => tblInvWarehouse.warehouseId,
  ),
  targetBinId: bigint('target_bin_id', { mode: 'number' }).references(
    () => tblInvStorageBin.binId,
  ),
  batchNo: varchar('batch_no', { length: 100 }),
  heatNo: varchar('heat_no', { length: 100 }),
  defectType: varchar('defect_type', { length: 100 }),
  qcVerdict: varchar('qc_verdict', { length: 30 })
    .notNull()
    .default('PENDING'),
  actionTaken: varchar('action_taken', { length: 100 }),
  remarks: varchar('remarks', { length: 250 }),
  isActive: boolean('is_active').notNull().default(true),
  ...standardAuditColumns,
});

// ============================================================================
// 77. Physical Stock Verification & Adjustment Header (tbl_inv_adjustment_header)
// ============================================================================
export const tblInvAdjustmentHeader = pgTable(
  'tbl_inv_adjustment_header',
  {
    adjustmentId: bigint('adjustment_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_inv_adjustment_id')`),
    adjustmentNo: varchar('adjustment_no', { length: 50 }).notNull(),
    adjustmentDate: date('adjustment_date').notNull().default(sql`CURRENT_DATE`),
    adjustmentType: varchar('adjustment_type', { length: 40 })
      .notNull()
      .default('CYCLE_COUNT'),
    warehouseId: bigint('warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    auditedBy: bigint('audited_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    auditedAt: timestamp('audited_at', { withTimezone: true }),
    approvedBy: bigint('approved_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    approvalDate: timestamp('approval_date', { withTimezone: true }),
    totalItems: integer('total_items').notNull().default(0),
    totalBookValue: numeric('total_book_value', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    totalPhysicalValue: numeric('total_physical_value', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    netVarianceValue: numeric('net_variance_value', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'),
    cancellationReason: varchar('cancellation_reason', { length: 350 }),
    remarks: varchar('remarks', { length: 500 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqInvAdjustmentNo: unique('uq_inv_adjustment_no').on(
      table.compId,
      table.branchId,
      table.adjustmentNo,
    ),
  }),
);

// ============================================================================
// 78. Physical Stock Verification & Adjustment Item (tbl_inv_adjustment_item)
// ============================================================================
export const tblInvAdjustmentItem = pgTable('tbl_inv_adjustment_item', {
  adjustmentItemId: bigint('adjustment_item_id', { mode: 'number' })
    .primaryKey()
    .default(sql`nextval('seq_inv_adjustment_item_id')`),
  adjustmentId: bigint('adjustment_id', { mode: 'number' })
    .notNull()
    .references(() => tblInvAdjustmentHeader.adjustmentId, {
      onDelete: 'cascade',
    }),
  itemSequence: integer('item_sequence').notNull().default(1),
  itemId: bigint('item_id', { mode: 'number' })
    .notNull()
    .references(() => tblInvItem.itemId),
  itemCode: varchar('item_code', { length: 50 }).notNull(),
  itemName: varchar('item_name', { length: 150 }).notNull(),
  binId: bigint('bin_id', { mode: 'number' })
    .notNull()
    .references(() => tblInvStorageBin.binId),
  uomId: bigint('uom_id', { mode: 'number' })
    .notNull()
    .references(() => tblInvUom.uomId),
  batchNo: varchar('batch_no', { length: 100 }),
  heatNo: varchar('heat_no', { length: 100 }),
  bookQty: numeric('book_qty', { precision: 14, scale: 3 })
    .notNull()
    .default('0.000'),
  physicalQty: numeric('physical_qty', { precision: 14, scale: 3 })
    .notNull()
    .default('0.000'),
  varianceQty: numeric('variance_qty', { precision: 14, scale: 3 })
    .notNull()
    .default('0.000'),
  unitCost: numeric('unit_cost', { precision: 14, scale: 4 })
    .notNull()
    .default('0.0000'),
  bookValue: numeric('book_value', { precision: 14, scale: 2 })
    .notNull()
    .default('0.00'),
  physicalValue: numeric('physical_value', { precision: 14, scale: 2 })
    .notNull()
    .default('0.00'),
  varianceValue: numeric('variance_value', { precision: 14, scale: 2 })
    .notNull()
    .default('0.00'),
  varianceDirection: varchar('variance_direction', { length: 20 })
    .notNull()
    .default('NONE'),
  discrepancyReason: varchar('discrepancy_reason', { length: 300 }),
  remarks: varchar('remarks', { length: 250 }),
  isActive: boolean('is_active').notNull().default(true),
  ...standardAuditColumns,
});

// ============================================================================
// 79. Warehouse Stock Transfer Order & Movement Header (tbl_inv_transfer_header)
// ============================================================================
export const tblInvTransferHeader = pgTable(
  'tbl_inv_transfer_header',
  {
    transferId: bigint('transfer_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_inv_transfer_id')`),
    transferNo: varchar('transfer_no', { length: 50 }).notNull(),
    transferDate: date('transfer_date').notNull().default(sql`CURRENT_DATE`),
    transferType: varchar('transfer_type', { length: 30 })
      .notNull()
      .default('BIN_TO_BIN'), // 'BIN_TO_BIN', 'INTER_WAREHOUSE', 'INTER_BRANCH_STO'
    fromWarehouseId: bigint('from_warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    toWarehouseId: bigint('to_warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    toBranchId: bigint('to_branch_id', { mode: 'number' })
      .notNull()
      .default(1001)
      .references(() => tblOrgBranch.branchId),
    transporterName: varchar('transporter_name', { length: 150 }),
    vehicleNo: varchar('vehicle_no', { length: 50 }),
    lrNo: varchar('lr_no', { length: 50 }),
    lrDate: date('lr_date'),
    ewayBillNo: varchar('eway_bill_no', { length: 60 }),
    challanNo: varchar('challan_no', { length: 50 }),
    challanDate: date('challan_date'),
    totalItems: integer('total_items').notNull().default(0),
    totalTransferQty: numeric('total_transfer_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    totalTransferValue: numeric('total_transfer_value', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'), // 'DRAFT', 'DISPATCHED', 'RECEIVED', 'CANCELLED'
    dispatchedBy: bigint('dispatched_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    receivedBy: bigint('received_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    cancellationReason: varchar('cancellation_reason', { length: 350 }),
    remarks: varchar('remarks', { length: 500 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqInvTransferNo: unique('uq_inv_transfer_no').on(
      table.compId,
      table.branchId,
      table.transferNo,
    ),
  }),
);

// ============================================================================
// 80. Warehouse Stock Transfer Order & Movement Item (tbl_inv_transfer_item)
// ============================================================================
export const tblInvTransferItem = pgTable('tbl_inv_transfer_item', {
  transferItemId: bigint('transfer_item_id', { mode: 'number' })
    .primaryKey()
    .default(sql`nextval('seq_inv_transfer_item_id')`),
  transferId: bigint('transfer_id', { mode: 'number' })
    .notNull()
    .references(() => tblInvTransferHeader.transferId, {
      onDelete: 'cascade',
    }),
  itemSequence: integer('item_sequence').notNull().default(1),
  itemId: bigint('item_id', { mode: 'number' })
    .notNull()
    .references(() => tblInvItem.itemId),
  itemCode: varchar('item_code', { length: 50 }).notNull(),
  itemName: varchar('item_name', { length: 150 }).notNull(),
  uomId: bigint('uom_id', { mode: 'number' })
    .notNull()
    .references(() => tblInvUom.uomId),
  fromBinId: bigint('from_bin_id', { mode: 'number' })
    .notNull()
    .references(() => tblInvStorageBin.binId),
  toBinId: bigint('to_bin_id', { mode: 'number' })
    .notNull()
    .references(() => tblInvStorageBin.binId),
  batchNo: varchar('batch_no', { length: 100 }),
  heatNo: varchar('heat_no', { length: 100 }),
  availableQty: numeric('available_qty', { precision: 14, scale: 3 })
    .notNull()
    .default('0.000'),
  transferQty: numeric('transfer_qty', { precision: 14, scale: 3 })
    .notNull()
    .default('1.000'),
  receivedQty: numeric('received_qty', { precision: 14, scale: 3 })
    .notNull()
    .default('0.000'),
  unitCost: numeric('unit_cost', { precision: 14, scale: 4 })
    .notNull()
    .default('0.0000'),
  lineTotal: numeric('line_total', { precision: 14, scale: 2 })
    .notNull()
    .default('0.00'),
  remarks: varchar('remarks', { length: 250 }),
  isActive: boolean('is_active').notNull().default(true),
  ...standardAuditColumns,
});






// ============================================================================
// 81. Batch, Heat & Metallurgical Quality Passport (tbl_inv_batch_master)
// ============================================================================
export const tblInvBatchMaster = pgTable(
  'tbl_inv_batch_master',
  {
    batchId: bigint('batch_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_inv_batch_id')`),
    batchNo: varchar('batch_no', { length: 100 }).notNull(),
    heatNo: varchar('heat_no', { length: 100 }),
    lotNo: varchar('lot_no', { length: 100 }),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    itemCode: varchar('item_code', { length: 50 }).notNull(),
    itemName: varchar('item_name', { length: 200 }).notNull(),
    supplierId: bigint('supplier_id', { mode: 'number' }).references(
      () => tblCrmParty.partyId,
    ),
    grnId: bigint('grn_id', { mode: 'number' }).references(
      () => tblInvGrnHeader.grnId,
    ),
    workOrderId: bigint('work_order_id', { mode: 'number' }).references(
      () => tblMfgWoHeader.woId,
    ),
    manufactureDate: date('manufacture_date'),
    expiryDate: date('expiry_date'),
    retestDate: date('retest_date'),
    initialQty: numeric('initial_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    currentQty: numeric('current_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    qcStatus: varchar('qc_status', { length: 30 }).notNull().default('APPROVED'),
    mtcNo: varchar('mtc_no', { length: 100 }),
    mtcDate: date('mtc_date'),
    mtcUrl: varchar('mtc_url', { length: 255 }),
    chemC: numeric('chem_c', { precision: 6, scale: 4 }),
    chemMn: numeric('chem_mn', { precision: 6, scale: 4 }),
    chemSi: numeric('chem_si', { precision: 6, scale: 4 }),
    chemP: numeric('chem_p', { precision: 6, scale: 4 }),
    chemS: numeric('chem_s', { precision: 6, scale: 4 }),
    chemCr: numeric('chem_cr', { precision: 6, scale: 4 }),
    chemNi: numeric('chem_ni', { precision: 6, scale: 4 }),
    chemMo: numeric('chem_mo', { precision: 6, scale: 4 }),
    yieldStrengthMpa: numeric('yield_strength_mpa', { precision: 8, scale: 2 }),
    tensileStrengthMpa: numeric('tensile_strength_mpa', { precision: 8, scale: 2 }),
    elongationPct: numeric('elongation_pct', { precision: 5, scale: 2 }),
    hardnessVal: numeric('hardness_val', { precision: 6, scale: 2 }),
    hardnessScale: varchar('hardness_scale', { length: 20 }).default('BHN'),
    impactJoules: numeric('impact_joules', { precision: 6, scale: 2 }),
    ultrasonicTestStatus: varchar('ultrasonic_test_status', { length: 50 }).default('PASSED'),
    radiographyStatus: varchar('radiography_status', { length: 50 }).default('NOT_APPLICABLE'),
    remarks: varchar('remarks', { length: 500 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqInvBatchCompItemBatch: unique('uq_inv_batch_comp_item_batch').on(
      table.compId,
      table.itemId,
      table.batchNo,
    ),
  }),
);

// ============================================================================
// 82. Bi-directional Batch Genealogy Linkage (tbl_inv_batch_genealogy)
// ============================================================================
export const tblInvBatchGenealogy = pgTable('tbl_inv_batch_genealogy', {
  genealogyId: bigint('genealogy_id', { mode: 'number' })
    .primaryKey()
    .default(sql`nextval('seq_inv_genealogy_id')`),
  parentBatchId: bigint('parent_batch_id', { mode: 'number' }).references(
    () => tblInvBatchMaster.batchId,
    { onDelete: 'cascade' },
  ),
  parentBatchNo: varchar('parent_batch_no', { length: 100 }).notNull(),
  parentItemId: bigint('parent_item_id', { mode: 'number' })
    .notNull()
    .references(() => tblInvItem.itemId),
  childBatchId: bigint('child_batch_id', { mode: 'number' }).references(
    () => tblInvBatchMaster.batchId,
    { onDelete: 'cascade' },
  ),
  childBatchNo: varchar('child_batch_no', { length: 100 }).notNull(),
  childItemId: bigint('child_item_id', { mode: 'number' })
    .notNull()
    .references(() => tblInvItem.itemId),
  workOrderId: bigint('work_order_id', { mode: 'number' }).references(
    () => tblMfgWoHeader.woId,
  ),
  jobCardId: bigint('job_card_id', { mode: 'number' }).references(
    () => tblMfgJobCard.jobCardId,
  ),
  consumedQty: numeric('consumed_qty', { precision: 14, scale: 3 })
    .notNull()
    .default('1.000'),
  uomId: bigint('uom_id', { mode: 'number' })
    .notNull()
    .references(() => tblInvUom.uomId),
  transformationType: varchar('transformation_type', { length: 50 })
    .notNull()
    .default('WORK_ORDER_ASSEMBLY'),
  linkDate: timestamp('link_date', { withTimezone: true })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  remarks: varchar('remarks', { length: 250 }),
  isActive: boolean('is_active').notNull().default(true),
  ...standardAuditColumns,
});

// ============================================================================
// 83. Unit Serial Number Lifecycle & Asset Registry (tbl_inv_serial_master)
// ============================================================================
export const tblInvSerialMaster = pgTable(
  'tbl_inv_serial_master',
  {
    serialId: bigint('serial_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_inv_serial_id')`),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    itemCode: varchar('item_code', { length: 50 }).notNull(),
    itemName: varchar('item_name', { length: 200 }).notNull(),
    batchId: bigint('batch_id', { mode: 'number' }).references(
      () => tblInvBatchMaster.batchId,
    ),
    batchNo: varchar('batch_no', { length: 100 }),
    heatNo: varchar('heat_no', { length: 100 }),
    serialNo: varchar('serial_no', { length: 100 }).notNull(),
    barcode: varchar('barcode', { length: 100 }),
    rfidTag: varchar('rfid_tag', { length: 100 }),
    currentWarehouseId: bigint('current_warehouse_id', { mode: 'number' }).references(
      () => tblInvWarehouse.warehouseId,
    ),
    currentBinId: bigint('current_bin_id', { mode: 'number' }).references(
      () => tblInvStorageBin.binId,
    ),
    status: varchar('status', { length: 30 }).notNull().default('AVAILABLE'),
    grnId: bigint('grn_id', { mode: 'number' }).references(
      () => tblInvGrnHeader.grnId,
    ),
    workOrderId: bigint('work_order_id', { mode: 'number' }).references(
      () => tblMfgWoHeader.woId,
    ),
    jobCardId: bigint('job_card_id', { mode: 'number' }).references(
      () => tblMfgJobCard.jobCardId,
    ),
    challanId: bigint('challan_id', { mode: 'number' }).references(
      () => tblSalesDeliveryChallanHeader.challanId,
    ),
    invoiceId: bigint('invoice_id', { mode: 'number' }).references(
      () => tblSalesInvoiceHeader.invoiceId,
    ),
    customerId: bigint('customer_id', { mode: 'number' }).references(
      () => tblCrmParty.partyId,
    ),
    warrantyStartDate: date('warranty_start_date'),
    warrantyEndDate: date('warranty_end_date'),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqInvSerialCompItemSerial: unique('uq_inv_serial_comp_item_serial').on(
      table.compId,
      table.itemId,
      table.serialNo,
    ),
  }),
);


// ============================================================================
// 84. Inventory Aging & Valuation Provisioning Header (tbl_inv_stock_provision_header)
// ============================================================================
export const tblInvStockProvisionHeader = pgTable(
  'tbl_inv_stock_provision_header',
  {
    provisionId: bigint('provision_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_inv_provision_id')`),
    provisionNo: varchar('provision_no', { length: 50 }).notNull(),
    provisionDate: date('provision_date').notNull(),
    valuationDate: date('valuation_date').notNull(),
    warehouseId: bigint('warehouse_id', { mode: 'number' }).references(
      () => tblInvWarehouse.warehouseId,
    ),
    categoryId: bigint('category_id', { mode: 'number' }).references(
      () => tblInvItemCategory.categoryId,
    ),
    totalItemsEvaluated: integer('total_items_evaluated').notNull().default(0),
    totalGrossValuation: numeric('total_gross_valuation', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    freshStockValue: numeric('fresh_stock_value', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    normalStockValue: numeric('normal_stock_value', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    slowMovingValue: numeric('slow_moving_value', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    stagnantStockValue: numeric('stagnant_stock_value', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    dormantStockValue: numeric('dormant_stock_value', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    deadStockValue: numeric('dead_stock_value', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    recommendedProvisionAmount: numeric('recommended_provision_amount', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    approvedProvisionAmount: numeric('approved_provision_amount', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'),
    reviewedBy: bigint('reviewed_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    approvedBy: bigint('approved_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    auditStandardCitation: varchar('audit_standard_citation', {
      length: 150,
    })
      .notNull()
      .default('Ind AS 2 (Inventories) & CARO 2020 Clause 3(ii)'),
    provisionPolicyMatrix: jsonb('provision_policy_matrix'),
    remarks: varchar('remarks', { length: 500 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqInvProvisionHeaderNo: unique('uq_inv_provision_header_no').on(
      table.compId,
      table.branchId,
      table.provisionNo,
    ),
  }),
);

// ============================================================================
// 85. Inventory Item-Level Aging & NRV Provisioning Line Items (tbl_inv_stock_provision_item)
// ============================================================================
export const tblInvStockProvisionItem = pgTable(
  'tbl_inv_stock_provision_item',
  {
    provisionItemId: bigint('provision_item_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_inv_provision_item_id')`),
    provisionId: bigint('provision_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvStockProvisionHeader.provisionId, {
        onDelete: 'cascade',
      }),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    warehouseId: bigint('warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    binId: bigint('bin_id', { mode: 'number' }).references(
      () => tblInvStorageBin.binId,
    ),
    batchNo: varchar('batch_no', { length: 100 }),
    heatNo: varchar('heat_no', { length: 100 }),
    itemCode: varchar('item_code', { length: 50 }).notNull(),
    itemName: varchar('item_name', { length: 200 }).notNull(),
    uomId: bigint('uom_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvUom.uomId),
    onHandQty: numeric('on_hand_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    unitCost: numeric('unit_cost', { precision: 14, scale: 4 })
      .notNull()
      .default('0.0000'),
    grossValuation: numeric('gross_valuation', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    firstInwardDate: date('first_inward_date'),
    lastMovementDate: date('last_movement_date'),
    ageInDays: integer('age_in_days').notNull().default(0),
    agingBracket: varchar('aging_bracket', { length: 30 })
      .notNull()
      .default('0_30'),
    fsnClassification: varchar('fsn_classification', { length: 20 })
      .notNull()
      .default('FAST'),
    provisionRatePercent: numeric('provision_rate_percent', {
      precision: 5,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    provisionAmount: numeric('provision_amount', { precision: 14, scale: 2 })
      .notNull()
      .default('0.00'),
    netRealizableValue: numeric('net_realizable_value', {
      precision: 14,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    justification: varchar('justification', { length: 250 }),
    remarks: varchar('remarks', { length: 250 }),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqInvProvisionItem: unique('uq_inv_provision_item').on(
      table.provisionId,
      table.itemId,
      table.warehouseId,
      table.batchNo,
    ),
  }),
);

// ============================================================================
// 86. In-Process & Stage-Wise QC Inspection Header
// ============================================================================
export const tblQcInProcessHeader = pgTable(
  'tbl_qc_in_process_header',
  {
    ipqcId: bigint('ipqc_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_qc_in_process_id')`),
    ipqcNo: varchar('ipqc_no', { length: 50 }).notNull(),
    ipqcDate: date('ipqc_date').notNull().defaultNow(),
    woId: bigint('wo_id', { mode: 'number' })
      .notNull()
      .references(() => tblMfgWoHeader.woId),
    jobCardId: bigint('job_card_id', { mode: 'number' }).references(
      () => tblMfgJobCard.jobCardId,
    ),
    woRoutingOpId: bigint('wo_routing_op_id', { mode: 'number' }).references(
      () => tblMfgWoRoutingOp.woRoutingOpId,
    ),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    workCenterId: bigint('work_center_id', { mode: 'number' }).references(
      () => tblMfgWorkCenter.workCenterId,
    ),
    machineId: bigint('machine_id', { mode: 'number' }).references(
      () => tblMfgWorkCenterMachine.wcMachineId,
    ),
    assignedOperatorId: bigint('assigned_operator_id', {
      mode: 'number',
    }).references(() => tblSecUser.userId),
    inspectorId: bigint('inspector_id', { mode: 'number' })
      .notNull()
      .references(() => tblSecUser.userId),
    inspectionStage: varchar('inspection_stage', { length: 40 })
      .notNull()
      .default('STAGE_COMPLETION'),
    shiftName: varchar('shift_name', { length: 30 })
      .notNull()
      .default('Shift A'),
    batchNo: varchar('batch_no', { length: 100 }),
    heatNo: varchar('heat_no', { length: 100 }),
    lotQty: numeric('lot_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    sampleSize: integer('sample_size').notNull().default(5),
    acceptedQty: numeric('accepted_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    rejectedQty: numeric('rejected_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    reworkQty: numeric('rework_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    overallResult: varchar('overall_result', { length: 30 })
      .notNull()
      .default('PENDING'),
    dispositionType: varchar('disposition_type', { length: 50 }).default(
      'DIRECT_ACCEPT',
    ),
    deviationReason: varchar('deviation_reason', { length: 500 }),
    approverId: bigint('approver_id', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    approvalDate: timestamp('approval_date', { withTimezone: true }),
    isCapaRequired: boolean('is_capa_required').notNull().default(false),
    ncrNo: varchar('ncr_no', { length: 50 }),
    remarks: varchar('remarks', { length: 500 }),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqQcInProcessHeaderNo: unique('uq_qc_in_process_header_no').on(
      table.compId,
      table.branchId,
      table.ipqcNo,
    ),
  }),
);

// ============================================================================
// 87. In-Process QC Inspection Characteristic / Parameter Observations
// ============================================================================
export const tblQcInProcessParam = pgTable('tbl_qc_in_process_param', {
  ipqcParamId: bigint('ipqc_param_id', { mode: 'number' })
    .primaryKey()
    .default(sql`nextval('seq_qc_in_process_param_id')`),
  ipqcId: bigint('ipqc_id', { mode: 'number' })
    .notNull()
    .references(() => tblQcInProcessHeader.ipqcId, { onDelete: 'cascade' }),
  paramSequence: integer('param_sequence').notNull().default(1),
  paramName: varchar('param_name', { length: 150 }).notNull(),
  paramCategory: varchar('param_category', { length: 50 })
    .notNull()
    .default('DIMENSIONAL'),
  instrumentName: varchar('instrument_name', { length: 150 }),
  nominalVal: numeric('nominal_val', { precision: 12, scale: 4 }),
  minTolerance: numeric('min_tolerance', { precision: 12, scale: 4 }),
  maxTolerance: numeric('max_tolerance', { precision: 12, scale: 4 }),
  uomCode: varchar('uom_code', { length: 20 }).default('mm'),
  obsVal1: numeric('obs_val_1', { precision: 12, scale: 4 }),
  obsVal2: numeric('obs_val_2', { precision: 12, scale: 4 }),
  obsVal3: numeric('obs_val_3', { precision: 12, scale: 4 }),
  obsVal4: numeric('obs_val_4', { precision: 12, scale: 4 }),
  obsVal5: numeric('obs_val_5', { precision: 12, scale: 4 }),
  meanVal: numeric('mean_val', { precision: 12, scale: 4 }),
  visualResult: varchar('visual_result', { length: 20 }).default('PASS'),
  paramResult: varchar('param_result', { length: 20 }).notNull().default('PASS'),
  deviationRemarks: varchar('deviation_remarks', { length: 250 }),
  isActive: boolean('is_active').notNull().default(true),
  ...standardAuditColumns,
});

// ============================================================================
// 88. Final Pre-Dispatch Inspection (PDI) Header
// ============================================================================
export const tblQcPdiHeader = pgTable(
  'tbl_qc_pdi_header',
  {
    pdiId: bigint('pdi_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_qc_pdi_id')`),
    pdiNo: varchar('pdi_no', { length: 50 }).notNull(),
    pdiDate: date('pdi_date').notNull().defaultNow(),
    salesOrderId: bigint('sales_order_id', { mode: 'number' }).references(
      () => tblSalesOrderHeader.soId,
    ),
    customerId: bigint('customer_id', { mode: 'number' })
      .notNull()
      .references(() => tblCrmParty.partyId),
    woId: bigint('wo_id', { mode: 'number' }).references(
      () => tblMfgWoHeader.woId,
    ),
    challanId: bigint('challan_id', { mode: 'number' }).references(
      () => tblSalesDeliveryChallanHeader.challanId,
    ),
    itemId: bigint('item_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvItem.itemId),
    warehouseId: bigint('warehouse_id', { mode: 'number' })
      .notNull()
      .references(() => tblInvWarehouse.warehouseId),
    batchNo: varchar('batch_no', { length: 100 }),
    heatNo: varchar('heat_no', { length: 100 }),
    lotQty: numeric('lot_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    sampleSize: integer('sample_size').notNull().default(5),
    acceptedQty: numeric('accepted_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    rejectedQty: numeric('rejected_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    reworkQty: numeric('rework_qty', { precision: 14, scale: 3 })
      .notNull()
      .default('0.000'),
    overallVerdict: varchar('overall_verdict', { length: 30 })
      .notNull()
      .default('PENDING'),
    disposition: varchar('disposition', { length: 50 }).default(
      'CLEAR_FOR_INVOICE',
    ),
    inspectorId: bigint('inspector_id', { mode: 'number' })
      .notNull()
      .references(() => tblSecUser.userId),
    approverId: bigint('approver_id', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    approvalDate: timestamp('approval_date', { withTimezone: true }),
    coaNo: varchar('coa_no', { length: 50 }),
    coaDate: date('coa_date'),
    mtcNo: varchar('mtc_no', { length: 100 }),
    standardSpecification: varchar('standard_specification', { length: 150 }),
    packagingCondition: varchar('packaging_condition', { length: 30 }).default(
      'ACCEPTABLE',
    ),
    labelingVerification: varchar('labeling_verification', {
      length: 20,
    }).default('PASS'),
    preservationCoating: varchar('preservation_coating', { length: 100 }),
    customerWitnessRequired: boolean('customer_witness_required')
      .notNull()
      .default(false),
    customerWitnessName: varchar('customer_witness_name', { length: 100 }),
    customerWitnessDate: date('customer_witness_date'),
    isCoaReleased: boolean('is_coa_released').notNull().default(false),
    coaReleasedBy: bigint('coa_released_by', { mode: 'number' }).references(
      () => tblSecUser.userId,
    ),
    coaReleasedAt: timestamp('coa_released_at', { withTimezone: true }),
    remarks: varchar('remarks', { length: 500 }),
    deviationReason: varchar('deviation_reason', { length: 500 }),
    status: varchar('status', { length: 25 }).notNull().default('DRAFT'),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqQcPdiHeaderNo: unique('uq_qc_pdi_header_no').on(
      table.compId,
      table.branchId,
      table.pdiNo,
    ),
  }),
);

// ============================================================================
// 89. Final PDI Characteristic & Functional Test Observations
// ============================================================================
export const tblQcPdiParam = pgTable('tbl_qc_pdi_param', {
  pdiParamId: bigint('pdi_param_id', { mode: 'number' })
    .primaryKey()
    .default(sql`nextval('seq_qc_pdi_param_id')`),
  pdiId: bigint('pdi_id', { mode: 'number' })
    .notNull()
    .references(() => tblQcPdiHeader.pdiId, { onDelete: 'cascade' }),
  paramSequence: integer('param_sequence').notNull().default(1),
  paramName: varchar('param_name', { length: 150 }).notNull(),
  paramCategory: varchar('param_category', { length: 50 })
    .notNull()
    .default('FUNCTIONAL'),
  instrumentName: varchar('instrument_name', { length: 150 }),
  nominalVal: numeric('nominal_val', { precision: 12, scale: 4 }),
  minTolerance: numeric('min_tolerance', { precision: 12, scale: 4 }),
  maxTolerance: numeric('max_tolerance', { precision: 12, scale: 4 }),
  uomCode: varchar('uom_code', { length: 20 }).default('mm'),
  observedVal1: numeric('observed_val_1', { precision: 12, scale: 4 }),
  observedVal2: numeric('observed_val_2', { precision: 12, scale: 4 }),
  observedVal3: numeric('observed_val_3', { precision: 12, scale: 4 }),
  observedVal4: numeric('observed_val_4', { precision: 12, scale: 4 }),
  observedVal5: numeric('observed_val_5', { precision: 12, scale: 4 }),
  meanVal: numeric('mean_val', { precision: 12, scale: 4 }),
  visualResult: varchar('visual_result', { length: 20 }).default('PASS'),
  paramResult: varchar('param_result', { length: 20 }).notNull().default('PASS'),
  notes: varchar('notes', { length: 250 }),
  isActive: boolean('is_active').notNull().default(true),
  ...standardAuditColumns,
});

// ============================================================================
// 90. Certificate of Analysis Chemical & Mechanical Matrix
// ============================================================================
export const tblQcPdiCoaSpec = pgTable(
  'tbl_qc_pdi_coa_spec',
  {
    coaSpecId: bigint('coa_spec_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_qc_pdi_coa_spec_id')`),
    pdiId: bigint('pdi_id', { mode: 'number' })
      .notNull()
      .references(() => tblQcPdiHeader.pdiId, { onDelete: 'cascade' }),
    elemCPct: numeric('elem_c_pct', { precision: 6, scale: 4 }).default(
      '0.0300',
    ),
    elemMnPct: numeric('elem_mn_pct', { precision: 6, scale: 4 }).default(
      '1.4500',
    ),
    elemSiPct: numeric('elem_si_pct', { precision: 6, scale: 4 }).default(
      '0.4200',
    ),
    elemPPct: numeric('elem_p_pct', { precision: 6, scale: 4 }).default(
      '0.0250',
    ),
    elemSPct: numeric('elem_s_pct', { precision: 6, scale: 4 }).default(
      '0.0120',
    ),
    elemCrPct: numeric('elem_cr_pct', { precision: 6, scale: 4 }).default(
      '17.2000',
    ),
    elemNiPct: numeric('elem_ni_pct', { precision: 6, scale: 4 }).default(
      '11.1000',
    ),
    elemMoPct: numeric('elem_mo_pct', { precision: 6, scale: 4 }).default(
      '2.1500',
    ),
    yieldStrengthMpa: numeric('yield_strength_mpa', {
      precision: 8,
      scale: 2,
    }).default('285.00'),
    tensileStrengthMpa: numeric('tensile_strength_mpa', {
      precision: 8,
      scale: 2,
    }).default('580.00'),
    elongationPct: numeric('elongation_pct', {
      precision: 6,
      scale: 2,
    }).default('42.00'),
    hardnessVal: varchar('hardness_val', { length: 30 }).default('185 HBW'),
    impactEnergyJoules: numeric('impact_energy_joules', {
      precision: 8,
      scale: 2,
    }).default('95.00'),
    hydroShellTestBar: numeric('hydro_shell_test_bar', {
      precision: 8,
      scale: 2,
    }).default('31.00'),
    hydroSeatTestBar: numeric('hydro_seat_test_bar', {
      precision: 8,
      scale: 2,
    }).default('22.00'),
    airSeatTestBar: numeric('air_seat_test_bar', {
      precision: 8,
      scale: 2,
    }).default('6.00'),
    ndeTestType: varchar('nde_test_type', { length: 100 }).default(
      '100% Visual + Dye Penetrant (PT) Flange Faces',
    ),
    ndeResult: varchar('nde_result', { length: 20 }).default('ACCEPTED'),
    labName: varchar('lab_name', { length: 150 }).default(
      'Kashvira Metallurgical Testing Laboratory (NABL Accredited)',
    ),
    certifiedEngineer: varchar('certified_engineer', { length: 100 }).default(
      'Er. R. K. Patel (Level-II NDT / ASNT)',
    ),
    certificationStandard: varchar('certification_standard', {
      length: 100,
    }).default('EN 10204:2004 Type 3.1 / ISO 10474'),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  },
  (table) => ({
    uqQcPdiCoaSpec: unique('uq_qc_pdi_coa_spec').on(table.pdiId),
  }),
);


// ============================================================================
// 91. Non-Conformance Reports (NCR) Header Table
// ============================================================================
export const tblQcNcrHeader = pgTable(
  'tbl_qc_ncr_header',
  {
    ncrId: bigint('ncr_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_qc_ncr_id')`),
    ncrNo: varchar('ncr_no', { length: 50 }).notNull().unique(),
    ncrDate: date('ncr_date').notNull().default(sql`CURRENT_DATE`),
    ncrType: varchar('ncr_type', { length: 40 }).notNull().default('IN_PROCESS_DEFECT'),
    sourceDocType: varchar('source_doc_type', { length: 40 }).notNull().default('IN_PROCESS_QC'),
    sourceDocId: bigint('source_doc_id', { mode: 'number' }),
    sourceDocNo: varchar('source_doc_no', { length: 50 }),
    sourceDocDate: date('source_doc_date'),
    itemId: bigint('item_id', { mode: 'number' }).notNull().references(() => tblInvItem.itemId),
    itemCode: varchar('item_code', { length: 50 }).notNull(),
    itemName: varchar('item_name', { length: 150 }).notNull(),
    batchNo: varchar('batch_no', { length: 50 }),
    heatNo: varchar('heat_no', { length: 50 }),
    defectSeverity: varchar('defect_severity', { length: 20 }).notNull().default('MAJOR'),
    defectCategory: varchar('defect_category', { length: 50 }).notNull().default('DIMENSIONAL'),
    defectDescription: text('defect_description').notNull(),
    inspectedQty: numeric('inspected_qty', { precision: 14, scale: 4 }).notNull().default('1.0000'),
    rejectedQty: numeric('rejected_qty', { precision: 14, scale: 4 }).notNull().default('1.0000'),
    uomId: bigint('uom_id', { mode: 'number' }).notNull().references(() => tblInvUom.uomId),
    uomCode: varchar('uom_code', { length: 20 }),
    containmentAction: text('containment_action'),
    quarantineLocation: varchar('quarantine_location', { length: 100 }).default('Quarantine Bay A1 (Red Tagged)'),
    redTagNo: varchar('red_tag_no', { length: 50 }),
    mrbDisposition: varchar('mrb_disposition', { length: 40 }).notNull().default('PENDING'),
    mrbApproverId: bigint('mrb_approver_id', { mode: 'number' }).references(() => tblSecUser.userId),
    mrbApproverName: varchar('mrb_approver_name', { length: 100 }),
    mrbApprovalDate: timestamp('mrb_approval_date', { withTimezone: true }),
    mrbNotes: text('mrb_notes'),
    isCapaRequired: boolean('is_capa_required').notNull().default(true),
    capaStatus: varchar('capa_status', { length: 30 }).notNull().default('NOT_INITIATED'),
    status: varchar('status', { length: 30 }).notNull().default('DRAFT'),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  }
);

// ============================================================================
// 92. Material Review Board (MRB) Member Votes & Dispositions
// ============================================================================
export const tblQcNcrMrbVote = pgTable(
  'tbl_qc_ncr_mrb_vote',
  {
    voteId: bigint('vote_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_qc_ncr_mrb_vote_id')`),
    ncrId: bigint('ncr_id', { mode: 'number' })
      .notNull()
      .references(() => tblQcNcrHeader.ncrId, { onDelete: 'cascade' }),
    voterId: bigint('voter_id', { mode: 'number' })
      .notNull()
      .references(() => tblSecUser.userId),
    voterName: varchar('voter_name', { length: 100 }).notNull(),
    voterRole: varchar('voter_role', { length: 50 }).notNull(),
    recommendedDisposition: varchar('recommended_disposition', { length: 40 }).notNull(),
    voteComments: text('vote_comments'),
    votedAt: timestamp('voted_at', { withTimezone: true }).notNull().defaultNow(),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  }
);

// ============================================================================
// 93. 8D Corrective and Preventive Action (CAPA) Engine
// ============================================================================
export const tblQcCapaAction = pgTable(
  'tbl_qc_capa_action',
  {
    capaId: bigint('capa_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_qc_capa_id')`),
    capaNo: varchar('capa_no', { length: 50 }).notNull().unique(),
    ncrId: bigint('ncr_id', { mode: 'number' })
      .notNull()
      .references(() => tblQcNcrHeader.ncrId, { onDelete: 'cascade' }),
    initiationDate: date('initiation_date').notNull().default(sql`CURRENT_DATE`),
    targetCompletionDate: date('target_completion_date').notNull(),
    actualClosureDate: date('actual_closure_date'),
    rootCauseMethod: varchar('root_cause_method', { length: 50 }).notNull().default('5_WHY'),
    rootCauseAnalysis: text('root_cause_analysis').notNull(),
    containmentActionPlan: text('containment_action_plan'),
    correctiveActionPlan: text('corrective_action_plan').notNull(),
    preventiveActionPlan: text('preventive_action_plan').notNull(),
    assignedToId: bigint('assigned_to_id', { mode: 'number' })
      .notNull()
      .references(() => tblSecUser.userId),
    assignedToName: varchar('assigned_to_name', { length: 100 }).notNull(),
    verifierId: bigint('verifier_id', { mode: 'number' }).references(() => tblSecUser.userId),
    verifierName: varchar('verifier_name', { length: 100 }),
    verificationRemarks: text('verification_remarks'),
    effectivenessStatus: varchar('effectiveness_status', { length: 30 }).notNull().default('PENDING'),
    status: varchar('status', { length: 25 }).notNull().default('OPEN'),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  }
);

// ============================================================================
// 94. Measuring Equipment & Gauge Calibration Master
// ============================================================================
export const tblQcGaugeMaster = pgTable(
  'tbl_qc_gauge_master',
  {
    gaugeId: bigint('gauge_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_qc_gauge_id')`),
    gaugeCode: varchar('gauge_code', { length: 50 }).notNull().unique(),
    gaugeName: varchar('gauge_name', { length: 150 }).notNull(),
    gaugeType: varchar('gauge_type', { length: 50 }).notNull().default('MICROMETER'),
    makeManufacturer: varchar('make_manufacturer', { length: 100 }).notNull(),
    modelNo: varchar('model_no', { length: 50 }),
    serialNo: varchar('serial_no', { length: 100 }).notNull(),
    rangeMin: numeric('range_min', { precision: 10, scale: 4 }).notNull().default('0.0000'),
    rangeMax: numeric('range_max', { precision: 10, scale: 4 }).notNull().default('25.0000'),
    uom: varchar('uom', { length: 20 }).notNull().default('mm'),
    leastCount: numeric('least_count', { precision: 10, scale: 5 }).notNull().default('0.00100'),
    maxPermissibleError: numeric('max_permissible_error', { precision: 10, scale: 5 }).notNull().default('0.00200'),
    locationCustody: varchar('location_custody', { length: 100 })
      .notNull()
      .default('CNC Machining Cell 01 - Quality Inspection Station'),
    custodianId: bigint('custodian_id', { mode: 'number' }).references(() => tblSecUser.userId),
    custodianName: varchar('custodian_name', { length: 100 }),
    calibrationFrequencyDays: integer('calibration_frequency_days').notNull().default(180),
    lastCalibrationDate: date('last_calibration_date').notNull(),
    nextCalibrationDueDate: date('next_calibration_due_date').notNull(),
    calibrationAgencyType: varchar('calibration_agency_type', { length: 30 })
      .notNull()
      .default('NABL_EXTERNAL_LAB'),
    agencyName: varchar('agency_name', { length: 150 })
      .notNull()
      .default('Central Metallurgical & Gauge Metrology Lab (NABL Cert #CC-2914)'),
    calibrationCertificateNo: varchar('calibration_certificate_no', { length: 100 })
      .notNull()
      .default('NABL-CAL-2026-9912'),
    currentStatus: varchar('current_status', { length: 30 }).notNull().default('VALID'),
    remarks: text('remarks'),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  }
);

// ============================================================================
// 95. Periodic Calibration Verification Events & MTC History
// ============================================================================
export const tblQcGaugeCalibrationHistory = pgTable(
  'tbl_qc_gauge_calibration_history',
  {
    historyId: bigint('history_id', { mode: 'number' })
      .primaryKey()
      .default(sql`nextval('seq_qc_gauge_cal_hist_id')`),
    gaugeId: bigint('gauge_id', { mode: 'number' })
      .notNull()
      .references(() => tblQcGaugeMaster.gaugeId, { onDelete: 'cascade' }),
    calibrationEventNo: varchar('calibration_event_no', { length: 50 }).notNull(),
    calibrationDate: date('calibration_date').notNull(),
    certificateNo: varchar('certificate_no', { length: 100 }).notNull(),
    calibratedByAgency: varchar('calibrated_by_agency', { length: 150 }).notNull(),
    calibratorName: varchar('calibrator_name', { length: 100 }).notNull(),
    masterInstrumentTraceability: varchar('master_instrument_traceability', { length: 200 })
      .notNull()
      .default('Grade-0 Ceramic Gauge Block Set (NPL / NIST Traceable)'),
    nominalValue: numeric('nominal_value', { precision: 10, scale: 5 }).notNull().default('10.00000'),
    observedValue: numeric('observed_value', { precision: 10, scale: 5 }).notNull().default('10.00050'),
    errorVal: numeric('error_val', { precision: 10, scale: 5 }).notNull().default('0.00050'),
    permissibleTolerance: numeric('permissible_tolerance', { precision: 10, scale: 5 }).notNull().default('0.00200'),
    calibrationResult: varchar('calibration_result', { length: 30 }).notNull().default('PASS'),
    nextDueDate: date('next_due_date').notNull(),
    environmentalConditions: varchar('environmental_conditions', { length: 150 })
      .default('Temp: 20.0 ± 0.5 °C, Humidity: 50 ± 5% RH'),
    certificateUrl: varchar('certificate_url', { length: 255 }),
    verifiedByUserId: bigint('verified_by_user_id', { mode: 'number' }).references(() => tblSecUser.userId),
    verifiedByName: varchar('verified_by_name', { length: 100 }),
    remarks: text('remarks'),
    isActive: boolean('is_active').notNull().default(true),
    ...standardAuditColumns,
  }
);
