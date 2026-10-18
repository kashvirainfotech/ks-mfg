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
