import {
  pgTable,
  bigint,
  varchar,
  text,
  boolean,
  date,
  integer,
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
