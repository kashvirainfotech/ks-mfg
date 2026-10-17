import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import * as bcrypt from 'bcrypt';
import { PG_POOL } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { DependencyCheckService } from '../../../common/services/dependency-check.service';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import type {
  CreateUserDto,
  ResetUserPasswordDto,
  UpdateUserDto,
  UpdateUserRoleAssignmentsDto,
  UserBranchRoleInput,
  UserCategory,
  UserCompanyRoleInput,
} from './user.dto';

export interface UserCompanyRoleMapping {
  userCompanyRoleId: number;
  userId: number;
  mappedCompId: number;
  compCode: string;
  compName: string;
  roleId: number;
  roleCode: string;
  roleName: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface UserBranchRoleMapping {
  userBranchRoleId: number;
  userId: number;
  mappedCompId: number;
  compCode: string;
  compName: string;
  mappedBranchId: number;
  branchCode: string;
  branchName: string;
  branchType: string;
  roleId: number;
  roleCode: string;
  roleName: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface UserRecord {
  userId: number;
  username: string;
  email: string;
  mobile: string | null;
  fullName: string;
  userCategory: UserCategory;
  linkedEntityId: number | null;
  linkedEmpCode: string | null;
  linkedEmpName: string | null;
  linkedDeptName: string | null;
  linkedDesigName: string | null;
  isSuperAdmin: boolean;
  isActive: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  companyRoles: UserCompanyRoleMapping[];
  branchRoles: UserBranchRoleMapping[];
  createdDate: string;
  updatedDate: string | null;
}

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO tbl_sec_action (
            action_id, screen_id, action_code, action_name, is_active,
            comp_id, branch_id, fyear_id, created_by
        ) VALUES
            (1018, 1008, 'EXPORT', 'Export User Directory & Role Mappings', TRUE, 1001, 1001, 1001, 1001),
            (1019, 1008, 'PRINT',  'Print User & Role Matrix Register',     TRUE, 1001, 1001, 1001, 1001)
        ON CONFLICT (screen_id, action_code) DO NOTHING;

        SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1019) FROM tbl_sec_action), 1019));

        INSERT INTO tbl_sec_role_action_permission (
            role_id, screen_id, action_id, is_allowed,
            comp_id, branch_id, fyear_id, created_by
        )
        SELECT 1001, a.screen_id, a.action_id, TRUE, 1001, 1001, 1001, 1001
        FROM tbl_sec_action a
        WHERE a.screen_id = 1008
        ON CONFLICT (role_id, action_id) DO NOTHING;
      `);
    } catch (err: any) {
      this.logger.warn(
        `Unable to sync USER_MASTER action seeds on startup: ${err?.message || err}`,
      );
    }
  }

  async findAllUsers(): Promise<UserRecord[]> {
    const usersRes = await this.pool.query(`
      SELECT
        u.user_id,
        u.username,
        u.email,
        u.mobile,
        u.full_name,
        u.user_category,
        u.linked_entity_id,
        e.emp_code AS linked_emp_code,
        e.full_name AS linked_emp_name,
        d.dept_name AS linked_dept_name,
        dg.desig_name AS linked_desig_name,
        u.is_super_admin,
        u.is_active,
        u.failed_login_count,
        u.locked_until,
        u.last_login_at,
        u.created_date,
        u.updated_date
      FROM tbl_sec_user u
      LEFT JOIN tbl_hr_employee e
        ON u.user_category = 'EMPLOYEE' AND e.employee_id = u.linked_entity_id
      LEFT JOIN tbl_hr_department d
        ON d.dept_id = e.dept_id
      LEFT JOIN tbl_hr_designation dg
        ON dg.desig_id = e.desig_id
      ORDER BY u.is_super_admin DESC, u.user_id ASC
    `);

    const compRolesRes = await this.pool.query(`
      SELECT
        ucr.user_company_role_id,
        ucr.user_id,
        ucr.mapped_comp_id,
        c.comp_code,
        c.comp_name,
        ucr.role_id,
        r.role_code,
        r.role_name,
        ucr.is_default,
        ucr.is_active
      FROM tbl_sec_user_company_role ucr
      INNER JOIN tbl_org_company c ON c.comp_id = ucr.mapped_comp_id
      INNER JOIN tbl_sec_role r ON r.role_id = ucr.role_id
      ORDER BY ucr.is_default DESC, c.comp_code ASC, r.role_code ASC
    `);

    const branchRolesRes = await this.pool.query(`
      SELECT
        ubr.user_branch_role_id,
        ubr.user_id,
        ubr.mapped_comp_id,
        c.comp_code,
        c.comp_name,
        ubr.mapped_branch_id,
        b.branch_code,
        b.branch_name,
        b.branch_type,
        ubr.role_id,
        r.role_code,
        r.role_name,
        ubr.is_default,
        ubr.is_active
      FROM tbl_sec_user_branch_role ubr
      INNER JOIN tbl_org_company c ON c.comp_id = ubr.mapped_comp_id
      INNER JOIN tbl_org_branch b ON b.branch_id = ubr.mapped_branch_id
      INNER JOIN tbl_sec_role r ON r.role_id = ubr.role_id
      ORDER BY ubr.is_default DESC, c.comp_code ASC, b.branch_code ASC, r.role_code ASC
    `);

    const compRoleMap = new Map<number, UserCompanyRoleMapping[]>();
    for (const r of compRolesRes.rows) {
      const uId = Number(r.user_id);
      const list = compRoleMap.get(uId) || [];
      list.push({
        userCompanyRoleId: Number(r.user_company_role_id),
        userId: uId,
        mappedCompId: Number(r.mapped_comp_id),
        compCode: r.comp_code,
        compName: r.comp_name,
        roleId: Number(r.role_id),
        roleCode: r.role_code,
        roleName: r.role_name,
        isDefault: Boolean(r.is_default),
        isActive: Boolean(r.is_active),
      });
      compRoleMap.set(uId, list);
    }

    const branchRoleMap = new Map<number, UserBranchRoleMapping[]>();
    for (const r of branchRolesRes.rows) {
      const uId = Number(r.user_id);
      const list = branchRoleMap.get(uId) || [];
      list.push({
        userBranchRoleId: Number(r.user_branch_role_id),
        userId: uId,
        mappedCompId: Number(r.mapped_comp_id),
        compCode: r.comp_code,
        compName: r.comp_name,
        mappedBranchId: Number(r.mapped_branch_id),
        branchCode: r.branch_code,
        branchName: r.branch_name,
        branchType: r.branch_type,
        roleId: Number(r.role_id),
        roleCode: r.role_code,
        roleName: r.role_name,
        isDefault: Boolean(r.is_default),
        isActive: Boolean(r.is_active),
      });
      branchRoleMap.set(uId, list);
    }

    return usersRes.rows.map((u) => {
      const uId = Number(u.user_id);
      return this.mapUserRow(
        u,
        compRoleMap.get(uId) || [],
        branchRoleMap.get(uId) || [],
      );
    });
  }

  async findUserById(userId: number): Promise<UserRecord> {
    const all = await this.findAllUsers();
    const found = all.find((u) => u.userId === userId);
    if (!found) {
      throw new NotFoundException(`User #${userId} not found.`);
    }
    return found;
  }

  async createUser(
    dto: CreateUserDto,
    actor: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<UserRecord> {
    const username = (dto.username || '').trim().toLowerCase();
    const email = (dto.email || '').trim().toLowerCase();
    const fullName = (dto.fullName || '').trim();
    const password = dto.password || '';

    if (!username || !email || !fullName || !password) {
      throw new BadRequestException(
        'Username, Email, Full Name, and Password are required.',
      );
    }
    if (password.length < 6) {
      throw new BadRequestException(
        'Password must be at least 6 characters long.',
      );
    }

    const dupCheck = await this.pool.query(
      `
      SELECT user_id, username, email
      FROM tbl_sec_user
      WHERE LOWER(username) = $1 OR LOWER(email) = $2
      LIMIT 1
      `,
      [username, email],
    );
    if ((dupCheck.rowCount ?? 0) > 0) {
      const row = dupCheck.rows[0];
      if (row.username.toLowerCase() === username) {
        throw new ConflictException(`Username "${username}" is already taken.`);
      }
      throw new ConflictException(`Email "${email}" is already registered.`);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const client = await this.pool.connect();
    let newUserId = 0;

    try {
      await client.query('BEGIN');

      const insertRes = await client.query(
        `
        INSERT INTO tbl_sec_user (
          username, email, mobile, password_hash, full_name,
          user_category, linked_entity_id, is_super_admin, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13
        )
        RETURNING user_id
        `,
        [
          username,
          email,
          dto.mobile?.trim() || null,
          passwordHash,
          fullName,
          dto.userCategory || 'EMPLOYEE',
          dto.linkedEntityId ? Number(dto.linkedEntityId) : null,
          Boolean(dto.isSuperAdmin),
          dto.isActive !== undefined ? Boolean(dto.isActive) : true,
          actor.compId || 1001,
          actor.branchId || 1001,
          actor.fyearId || 1001,
          actor.userId,
        ],
      );

      newUserId = Number(insertRes.rows[0].user_id);

      if (Array.isArray(dto.companyRoles) || Array.isArray(dto.branchRoles)) {
        await this.syncRoleMappingsInTx(
          client,
          newUserId,
          dto.companyRoles || [],
          dto.branchRoles || [],
          actor,
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const created = await this.findUserById(newUserId);

    await this.auditLogService.logAction({
      userId: actor.userId,
      username: actor.username,
      screenCode: 'USER_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_sec_user',
      recordId: newUserId,
      newValue: created as unknown as Record<string, unknown>,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: actor.compId,
      branchId: actor.branchId,
      fyearId: actor.fyearId,
    });

    return created;
  }

  async updateUser(
    userId: number,
    dto: UpdateUserDto,
    actor: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<UserRecord> {
    const existing = await this.findUserById(userId);
    const username = (dto.username ?? existing.username).trim().toLowerCase();
    const email = (dto.email ?? existing.email).trim().toLowerCase();
    const fullName = (dto.fullName ?? existing.fullName).trim();

    if (userId === 1001) {
      if (dto.isActive === false) {
        throw new BadRequestException(
          'Root Super Admin account (user_id = 1001) cannot be deactivated.',
        );
      }
      if (dto.isSuperAdmin === false) {
        throw new BadRequestException(
          'Root Super Admin privilege cannot be removed from user_id = 1001.',
        );
      }
    }

    const dupCheck = await this.pool.query(
      `
      SELECT user_id, username, email
      FROM tbl_sec_user
      WHERE (LOWER(username) = $1 OR LOWER(email) = $2) AND user_id <> $3
      LIMIT 1
      `,
      [username, email, userId],
    );
    if ((dupCheck.rowCount ?? 0) > 0) {
      const row = dupCheck.rows[0];
      if (row.username.toLowerCase() === username) {
        throw new ConflictException(`Username "${username}" is already taken.`);
      }
      throw new ConflictException(`Email "${email}" is already registered.`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
        UPDATE tbl_sec_user
        SET
          username = $1,
          email = $2,
          mobile = $3,
          full_name = $4,
          user_category = $5,
          linked_entity_id = $6,
          is_super_admin = $7,
          is_active = $8,
          updated_by = $9,
          updated_date = CURRENT_TIMESTAMP
        WHERE user_id = $10
        `,
        [
          username,
          email,
          dto.mobile !== undefined
            ? dto.mobile?.trim() || null
            : existing.mobile,
          fullName,
          dto.userCategory ?? existing.userCategory,
          dto.linkedEntityId !== undefined
            ? dto.linkedEntityId
              ? Number(dto.linkedEntityId)
              : null
            : existing.linkedEntityId,
          dto.isSuperAdmin !== undefined
            ? Boolean(dto.isSuperAdmin)
            : existing.isSuperAdmin,
          dto.isActive !== undefined
            ? Boolean(dto.isActive)
            : existing.isActive,
          actor.userId,
          userId,
        ],
      );

      if (dto.companyRoles !== undefined || dto.branchRoles !== undefined) {
        await this.syncRoleMappingsInTx(
          client,
          userId,
          dto.companyRoles ??
            existing.companyRoles.map((cr) => ({
              mappedCompId: cr.mappedCompId,
              roleId: cr.roleId,
              isDefault: cr.isDefault,
              isActive: cr.isActive,
            })),
          dto.branchRoles ??
            existing.branchRoles.map((br) => ({
              mappedCompId: br.mappedCompId,
              mappedBranchId: br.mappedBranchId,
              roleId: br.roleId,
              isDefault: br.isDefault,
              isActive: br.isActive,
            })),
          actor,
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updated = await this.findUserById(userId);

    await this.auditLogService.logAction({
      userId: actor.userId,
      username: actor.username,
      screenCode: 'USER_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_sec_user',
      recordId: userId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: actor.compId,
      branchId: actor.branchId,
      fyearId: actor.fyearId,
    });

    return updated;
  }

  async updateRoleAssignments(
    userId: number,
    dto: UpdateUserRoleAssignmentsDto,
    actor: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<UserRecord> {
    const existing = await this.findUserById(userId);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await this.syncRoleMappingsInTx(
        client,
        userId,
        dto.companyRoles || [],
        dto.branchRoles || [],
        actor,
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updated = await this.findUserById(userId);

    await this.auditLogService.logAction({
      userId: actor.userId,
      username: actor.username,
      screenCode: 'USER_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_sec_user_branch_role',
      recordId: userId,
      oldValue: {
        username: existing.username,
        companyRoles: existing.companyRoles,
        branchRoles: existing.branchRoles,
      } as unknown as Record<string, unknown>,
      newValue: {
        username: updated.username,
        companyRoles: updated.companyRoles,
        branchRoles: updated.branchRoles,
      } as unknown as Record<string, unknown>,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: actor.compId,
      branchId: actor.branchId,
      fyearId: actor.fyearId,
    });

    return updated;
  }

  async resetPassword(
    userId: number,
    dto: ResetUserPasswordDto,
    actor: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<{ reset: boolean }> {
    const existing = await this.findUserById(userId);
    const newPassword = dto.newPassword || '';

    if (newPassword.length < 6) {
      throw new BadRequestException(
        'New password must be at least 6 characters long.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.pool.query(
      `
      UPDATE tbl_sec_user
      SET
        password_hash = $1,
        failed_login_count = 0,
        locked_until = NULL,
        updated_by = $2,
        updated_date = CURRENT_TIMESTAMP
      WHERE user_id = $3
      `,
      [passwordHash, actor.userId, userId],
    );

    await this.auditLogService.logAction({
      userId: actor.userId,
      username: actor.username,
      screenCode: 'USER_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_sec_user',
      recordId: userId,
      oldValue: { username: existing.username, passwordReset: false },
      newValue: { username: existing.username, passwordReset: true },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: actor.compId,
      branchId: actor.branchId,
      fyearId: actor.fyearId,
    });

    return { reset: true };
  }

  async unlockAccount(
    userId: number,
    actor: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<UserRecord> {
    const existing = await this.findUserById(userId);

    await this.pool.query(
      `
      UPDATE tbl_sec_user
      SET
        failed_login_count = 0,
        locked_until = NULL,
        updated_by = $1,
        updated_date = CURRENT_TIMESTAMP
      WHERE user_id = $2
      `,
      [actor.userId, userId],
    );

    const updated = await this.findUserById(userId);

    await this.auditLogService.logAction({
      userId: actor.userId,
      username: actor.username,
      screenCode: 'USER_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_sec_user',
      recordId: userId,
      oldValue: {
        failedLoginCount: existing.failedLoginCount,
        lockedUntil: existing.lockedUntil,
      },
      newValue: {
        failedLoginCount: 0,
        lockedUntil: null,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: actor.compId,
      branchId: actor.branchId,
      fyearId: actor.fyearId,
    });

    return updated;
  }

  async deleteUser(
    userId: number,
    actor: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<{ deletedId: number }> {
    const existing = await this.findUserById(userId);

    if (userId === 1001 || existing.username === 'admin') {
      throw new ConflictException({
        code: 'ROOT_ADMIN_PROTECTED',
        message:
          'Root Super Admin account ("admin") is a protected kernel account and cannot be deleted.',
        details: {
          dependencies: [
            {
              table: 'tbl_sec_user',
              label: 'Protected Kernel Super Administrator Account',
              count: 1,
            },
          ],
        },
      });
    }

    if (userId === actor.userId) {
      throw new ConflictException({
        code: 'SELF_DELETE_BLOCKED',
        message: 'You cannot delete your own active user session account.',
        details: {
          dependencies: [
            {
              table: 'tbl_sec_user',
              label: 'Currently Authenticated User Session',
              count: 1,
            },
          ],
        },
      });
    }

    await this.dependencyCheckService.verifyCanDelete({
      entity: 'USER',
      entityId: userId,
      relations: [
        {
          table: 'tbl_sec_user_company_role',
          column: 'user_id',
          label: 'Active Company Role Assignments',
        },
        {
          table: 'tbl_sec_user_branch_role',
          column: 'user_id',
          label: 'Active Plant / Branch Role Assignments',
        },
        {
          table: 'tbl_sys_audit_log',
          column: 'user_id',
          label: 'Historical Security & Transaction Audit Logs',
        },
      ],
    });

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM tbl_sec_user_preference WHERE user_id = $1`,
        [userId],
      );
      await client.query(`DELETE FROM tbl_sec_user WHERE user_id = $1`, [
        userId,
      ]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.auditLogService.logAction({
      userId: actor.userId,
      username: actor.username,
      screenCode: 'USER_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_sec_user',
      recordId: userId,
      oldValue: existing as unknown as Record<string, unknown>,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: actor.compId,
      branchId: actor.branchId,
      fyearId: actor.fyearId,
    });

    return { deletedId: userId };
  }

  async recordScreenAction(
    actionType: 'PRINT' | 'EXPORT',
    actor: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<void> {
    await this.auditLogService.logAction({
      userId: actor.userId,
      username: actor.username,
      screenCode: 'USER_MASTER',
      actionType,
      entityTable: 'tbl_sec_user',
      recordId: 0,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: actor.compId,
      branchId: actor.branchId,
      fyearId: actor.fyearId,
    });
  }

  private async syncRoleMappingsInTx(
    client: PoolClient,
    userId: number,
    companyRoles: UserCompanyRoleInput[],
    branchRoles: UserBranchRoleInput[],
    actor: AuthenticatedUserContext,
  ): Promise<void> {
    await client.query(
      `DELETE FROM tbl_sec_user_company_role WHERE user_id = $1`,
      [userId],
    );
    await client.query(
      `DELETE FROM tbl_sec_user_branch_role WHERE user_id = $1`,
      [userId],
    );

    // Deduplicate company role pairs (mappedCompId, roleId)
    const seenComp = new Set<string>();
    let hasCompDefault = false;

    for (const cr of companyRoles) {
      const compId = Number(cr.mappedCompId);
      const roleId = Number(cr.roleId);
      if (!compId || !roleId) continue;

      const key = `${compId}:${roleId}`;
      if (seenComp.has(key)) continue;
      seenComp.add(key);

      const isDefault = !hasCompDefault && Boolean(cr.isDefault);
      if (isDefault) hasCompDefault = true;

      await client.query(
        `
        INSERT INTO tbl_sec_user_company_role (
          user_id, mapped_comp_id, role_id, is_default, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          userId,
          compId,
          roleId,
          isDefault,
          cr.isActive !== undefined ? Boolean(cr.isActive) : true,
          actor.compId || 1001,
          actor.branchId || 1001,
          actor.fyearId || 1001,
          actor.userId,
        ],
      );
    }

    // Deduplicate branch role pairs (mappedBranchId, roleId)
    const seenBranch = new Set<string>();
    let hasBranchDefault = false;

    for (const br of branchRoles) {
      const compId = Number(br.mappedCompId);
      const branchId = Number(br.mappedBranchId);
      const roleId = Number(br.roleId);
      if (!compId || !branchId || !roleId) continue;

      const key = `${branchId}:${roleId}`;
      if (seenBranch.has(key)) continue;
      seenBranch.add(key);

      const isDefault = !hasBranchDefault && Boolean(br.isDefault);
      if (isDefault) hasBranchDefault = true;

      await client.query(
        `
        INSERT INTO tbl_sec_user_branch_role (
          user_id, mapped_comp_id, mapped_branch_id, role_id, is_default, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          userId,
          compId,
          branchId,
          roleId,
          isDefault,
          br.isActive !== undefined ? Boolean(br.isActive) : true,
          actor.compId || 1001,
          actor.branchId || 1001,
          actor.fyearId || 1001,
          actor.userId,
        ],
      );
    }
  }

  private mapUserRow(
    u: any,
    companyRoles: UserCompanyRoleMapping[],
    branchRoles: UserBranchRoleMapping[],
  ): UserRecord {
    return {
      userId: Number(u.user_id),
      username: u.username,
      email: u.email,
      mobile: u.mobile || null,
      fullName: u.full_name,
      userCategory: (u.user_category || 'EMPLOYEE') as UserCategory,
      linkedEntityId: u.linked_entity_id ? Number(u.linked_entity_id) : null,
      linkedEmpCode: u.linked_emp_code || null,
      linkedEmpName: u.linked_emp_name || null,
      linkedDeptName: u.linked_dept_name || null,
      linkedDesigName: u.linked_desig_name || null,
      isSuperAdmin: Boolean(u.is_super_admin),
      isActive: Boolean(u.is_active),
      failedLoginCount: Number(u.failed_login_count || 0),
      lockedUntil: u.locked_until || null,
      lastLoginAt: u.last_login_at || null,
      companyRoles,
      branchRoles,
      createdDate: u.created_date,
      updatedDate: u.updated_date || null,
    };
  }
}
