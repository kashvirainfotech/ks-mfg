import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { DependencyCheckService } from '../../../common/services/dependency-check.service';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import type {
  CreateRoleDto,
  UpdateRoleDto,
  UpdateRoleMatrixDto,
} from './role.dto';

export interface RoleRecord {
  roleId: number;
  roleCode: string;
  roleName: string;
  roleDescription: string | null;
  isSystemRole: boolean;
  isActive: boolean;
  grantedScreenCount: number;
  totalScreenCount: number;
  grantedActionCount: number;
  assignedUserCount: number;
  createdDate: string;
  updatedDate: string | null;
}

export interface RoleActionPermissionItem {
  actionId: number;
  screenId: number;
  actionCode: string;
  actionName: string;
  isAllowed: boolean;
}

export interface RoleScreenPermissionItem {
  screenId: number;
  screenCode: string;
  screenName: string;
  moduleName: string;
  routePath: string | null;
  displayOrder: number;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  actions: RoleActionPermissionItem[];
}

export interface RolePermissionMatrixResponse {
  role: RoleRecord;
  screens: RoleScreenPermissionItem[];
}

@Injectable()
export class RoleService implements OnModuleInit {
  private readonly logger = new Logger(RoleService.name);

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
            (1012, 1005, 'EXPORT', 'Export Departments & Designations', TRUE, 1001, 1001, 1001, 1001),
            (1013, 1005, 'PRINT',  'Print HR Organization Directory',   TRUE, 1001, 1001, 1001, 1001),
            (1014, 1006, 'EXPORT', 'Export Employee Master Directory',  TRUE, 1001, 1001, 1001, 1001),
            (1015, 1006, 'PRINT',  'Print Employee Register',           TRUE, 1001, 1001, 1001, 1001),
            (1016, 1007, 'EXPORT', 'Export Global Roles & Matrix',      TRUE, 1001, 1001, 1001, 1001),
            (1017, 1007, 'PRINT',  'Print Role Permission Matrix',      TRUE, 1001, 1001, 1001, 1001)
        ON CONFLICT (screen_id, action_code) DO NOTHING;

        SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1017) FROM tbl_sec_action), 1017));

        INSERT INTO tbl_sec_role_action_permission (
            role_id, screen_id, action_id, is_allowed,
            comp_id, branch_id, fyear_id, created_by
        )
        SELECT 1001, a.screen_id, a.action_id, TRUE, 1001, 1001, 1001, 1001
        FROM tbl_sec_action a
        ON CONFLICT (role_id, action_id) DO NOTHING;
      `);
    } catch (err: any) {
      this.logger.warn(
        `Unable to sync baseline role actions on startup: ${err?.message || err}`,
      );
    }
  }

  async findAllRoles(): Promise<RoleRecord[]> {
    const res = await this.pool.query(`
      SELECT
        r.role_id,
        r.role_code,
        r.role_name,
        r.role_description,
        r.is_system_role,
        r.is_active,
        r.created_date,
        r.updated_date,
        (
          SELECT COUNT(*)::int
          FROM tbl_sec_role_permission rp
          INNER JOIN tbl_sec_screen s ON s.screen_id = rp.screen_id AND s.is_active = TRUE
          WHERE rp.role_id = r.role_id AND rp.can_view = TRUE
        ) AS granted_screen_count,
        (
          SELECT COUNT(*)::int
          FROM tbl_sec_screen s
          WHERE s.is_active = TRUE
        ) AS total_screen_count,
        (
          SELECT COUNT(*)::int
          FROM tbl_sec_role_action_permission rap
          INNER JOIN tbl_sec_action a ON a.action_id = rap.action_id AND a.is_active = TRUE
          WHERE rap.role_id = r.role_id AND rap.is_allowed = TRUE
        ) AS granted_action_count,
        (
          SELECT COUNT(DISTINCT u_id)::int
          FROM (
            SELECT ucr.user_id AS u_id
            FROM tbl_sec_user_company_role ucr
            WHERE ucr.role_id = r.role_id AND ucr.is_active = TRUE
            UNION
            SELECT ubr.user_id AS u_id
            FROM tbl_sec_user_branch_role ubr
            WHERE ubr.role_id = r.role_id AND ubr.is_active = TRUE
          ) mapped_users
        ) AS assigned_user_count
      FROM tbl_sec_role r
      ORDER BY r.is_system_role DESC, r.role_id ASC
    `);

    return res.rows.map((row) => this.mapRoleRow(row));
  }

  async findRoleById(roleId: number): Promise<RoleRecord> {
    const res = await this.pool.query(
      `
      SELECT
        r.role_id,
        r.role_code,
        r.role_name,
        r.role_description,
        r.is_system_role,
        r.is_active,
        r.created_date,
        r.updated_date,
        (
          SELECT COUNT(*)::int
          FROM tbl_sec_role_permission rp
          INNER JOIN tbl_sec_screen s ON s.screen_id = rp.screen_id AND s.is_active = TRUE
          WHERE rp.role_id = r.role_id AND rp.can_view = TRUE
        ) AS granted_screen_count,
        (
          SELECT COUNT(*)::int
          FROM tbl_sec_screen s
          WHERE s.is_active = TRUE
        ) AS total_screen_count,
        (
          SELECT COUNT(*)::int
          FROM tbl_sec_role_action_permission rap
          INNER JOIN tbl_sec_action a ON a.action_id = rap.action_id AND a.is_active = TRUE
          WHERE rap.role_id = r.role_id AND rap.is_allowed = TRUE
        ) AS granted_action_count,
        (
          SELECT COUNT(DISTINCT u_id)::int
          FROM (
            SELECT ucr.user_id AS u_id
            FROM tbl_sec_user_company_role ucr
            WHERE ucr.role_id = r.role_id AND ucr.is_active = TRUE
            UNION
            SELECT ubr.user_id AS u_id
            FROM tbl_sec_user_branch_role ubr
            WHERE ubr.role_id = r.role_id AND ubr.is_active = TRUE
          ) mapped_users
        ) AS assigned_user_count
      FROM tbl_sec_role r
      WHERE r.role_id = $1
      LIMIT 1
      `,
      [roleId],
    );

    if (res.rowCount === 0) {
      throw new NotFoundException(`Role #${roleId} not found.`);
    }
    return this.mapRoleRow(res.rows[0]);
  }

  async createRole(
    dto: CreateRoleDto,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<RoleRecord> {
    const roleCode = (dto.roleCode || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
    const roleName = (dto.roleName || '').trim();

    if (!roleCode || !roleName) {
      throw new BadRequestException('Role Code and Role Name are required.');
    }

    const dupCheck = await this.pool.query(
      `SELECT role_id FROM tbl_sec_role WHERE UPPER(role_code) = $1 LIMIT 1`,
      [roleCode],
    );
    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(`Role Code "${roleCode}" already exists.`);
    }

    const client = await this.pool.connect();
    let newRoleId = 0;

    try {
      await client.query('BEGIN');

      const insertRes = await client.query(
        `
        INSERT INTO tbl_sec_role (
          role_code, role_name, role_description, is_system_role, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3, FALSE, $4,
          $5, $6, $7, $8
        )
        RETURNING role_id
        `,
        [
          roleCode,
          roleName,
          dto.roleDescription?.trim() || null,
          dto.isActive !== undefined ? Boolean(dto.isActive) : true,
          user.compId || 1001,
          user.branchId || 1001,
          user.fyearId || 1001,
          user.userId,
        ],
      );

      newRoleId = Number(insertRes.rows[0].role_id);

      // Optional permission cloning from an existing template role
      if (dto.cloneFromRoleId) {
        const sourceRoleId = Number(dto.cloneFromRoleId);
        await client.query(
          `
          INSERT INTO tbl_sec_role_permission (
            role_id, screen_id, can_view, can_add, can_edit, can_delete,
            comp_id, branch_id, fyear_id, created_by
          )
          SELECT
            $1, rp.screen_id, rp.can_view, rp.can_add, rp.can_edit, rp.can_delete,
            $2, $3, $4, $5
          FROM tbl_sec_role_permission rp
          WHERE rp.role_id = $6
          ON CONFLICT (role_id, screen_id) DO NOTHING
          `,
          [
            newRoleId,
            user.compId || 1001,
            user.branchId || 1001,
            user.fyearId || 1001,
            user.userId,
            sourceRoleId,
          ],
        );

        await client.query(
          `
          INSERT INTO tbl_sec_role_action_permission (
            role_id, screen_id, action_id, is_allowed,
            comp_id, branch_id, fyear_id, created_by
          )
          SELECT
            $1, rap.screen_id, rap.action_id, rap.is_allowed,
            $2, $3, $4, $5
          FROM tbl_sec_role_action_permission rap
          WHERE rap.role_id = $6
          ON CONFLICT (role_id, action_id) DO NOTHING
          `,
          [
            newRoleId,
            user.compId || 1001,
            user.branchId || 1001,
            user.fyearId || 1001,
            user.userId,
            sourceRoleId,
          ],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const created = await this.findRoleById(newRoleId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'ROLE_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_sec_role',
      recordId: newRoleId,
      newValue: {
        ...created,
        clonedFromRoleId: dto.cloneFromRoleId || null,
      } as unknown as Record<string, unknown>,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });

    return created;
  }

  async updateRole(
    roleId: number,
    dto: UpdateRoleDto,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<RoleRecord> {
    const existing = await this.findRoleById(roleId);

    const requestedCode = dto.roleCode
      ? dto.roleCode.trim().toUpperCase().replace(/\s+/g, '_')
      : existing.roleCode;

    if (existing.isSystemRole && requestedCode !== existing.roleCode) {
      throw new BadRequestException(
        `System role code "${existing.roleCode}" is protected and cannot be renamed.`,
      );
    }

    if (
      existing.roleCode === 'SUPER_ADMIN' &&
      dto.isActive !== undefined &&
      !dto.isActive
    ) {
      throw new BadRequestException(
        'The SUPER_ADMIN role cannot be deactivated.',
      );
    }

    const dupCheck = await this.pool.query(
      `
      SELECT role_id
      FROM tbl_sec_role
      WHERE UPPER(role_code) = $1 AND role_id <> $2
      LIMIT 1
      `,
      [requestedCode, roleId],
    );
    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Role Code "${requestedCode}" already exists.`,
      );
    }

    const roleName = (dto.roleName ?? existing.roleName).trim();
    if (!roleName) {
      throw new BadRequestException('Role Name cannot be empty.');
    }

    await this.pool.query(
      `
      UPDATE tbl_sec_role
      SET
        role_code = $1,
        role_name = $2,
        role_description = $3,
        is_active = $4,
        updated_by = $5,
        updated_date = CURRENT_TIMESTAMP
      WHERE role_id = $6
      `,
      [
        requestedCode,
        roleName,
        dto.roleDescription !== undefined
          ? dto.roleDescription?.trim() || null
          : existing.roleDescription,
        dto.isActive !== undefined ? Boolean(dto.isActive) : existing.isActive,
        user.userId,
        roleId,
      ],
    );

    const updated = await this.findRoleById(roleId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'ROLE_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_sec_role',
      recordId: roleId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });

    return updated;
  }

  async deleteRole(
    roleId: number,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<{ deletedId: number }> {
    const existing = await this.findRoleById(roleId);

    if (existing.isSystemRole) {
      throw new ConflictException({
        code: 'SYSTEM_ROLE_PROTECTED',
        message: `Role "${existing.roleName}" (${existing.roleCode}) is a built-in System Role and cannot be deleted.`,
        details: {
          dependencies: [
            {
              table: 'tbl_sec_role',
              label: 'Built-In System Role Protection Flag (is_system_role)',
              count: 1,
            },
          ],
        },
      });
    }

    // Verify no users are assigned to this role at company or branch level
    await this.dependencyCheckService.verifyCanDelete({
      entity: 'ROLE',
      entityId: roleId,
      relations: [
        {
          table: 'tbl_sec_user_company_role',
          column: 'role_id',
          label: 'Company-Level User Role Assignments',
        },
        {
          table: 'tbl_sec_user_branch_role',
          column: 'role_id',
          label: 'Plant / Branch-Level User Role Assignments',
        },
      ],
    });

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM tbl_sec_role_action_permission WHERE role_id = $1`,
        [roleId],
      );
      await client.query(
        `DELETE FROM tbl_sec_role_permission WHERE role_id = $1`,
        [roleId],
      );
      await client.query(`DELETE FROM tbl_sec_role WHERE role_id = $1`, [
        roleId,
      ]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'ROLE_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_sec_role',
      recordId: roleId,
      oldValue: existing as unknown as Record<string, unknown>,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });

    return { deletedId: roleId };
  }

  // ==========================================================================
  // Granular Screen & Action Permissions Matrix (`tbl_sec_role_permission` & `tbl_sec_role_action_permission`)
  // ==========================================================================

  async getRoleMatrix(roleId: number): Promise<RolePermissionMatrixResponse> {
    const role = await this.findRoleById(roleId);

    const screensRes = await this.pool.query(
      `
      SELECT
        s.screen_id,
        s.screen_code,
        s.screen_name,
        s.module_name,
        s.route_path,
        s.display_order,
        COALESCE(rp.can_view, FALSE) AS can_view,
        COALESCE(rp.can_add, FALSE) AS can_add,
        COALESCE(rp.can_edit, FALSE) AS can_edit,
        COALESCE(rp.can_delete, FALSE) AS can_delete
      FROM tbl_sec_screen s
      LEFT JOIN tbl_sec_role_permission rp
        ON rp.screen_id = s.screen_id AND rp.role_id = $1
      WHERE s.is_active = TRUE
      ORDER BY s.display_order ASC, s.screen_id ASC
      `,
      [roleId],
    );

    const actionsRes = await this.pool.query(
      `
      SELECT
        a.action_id,
        a.screen_id,
        a.action_code,
        a.action_name,
        COALESCE(rap.is_allowed, FALSE) AS is_allowed
      FROM tbl_sec_action a
      LEFT JOIN tbl_sec_role_action_permission rap
        ON rap.action_id = a.action_id AND rap.role_id = $1
      WHERE a.is_active = TRUE
      ORDER BY a.screen_id ASC, a.action_code ASC
      `,
      [roleId],
    );

    const actionsByScreen = new Map<number, RoleActionPermissionItem[]>();
    for (const row of actionsRes.rows) {
      const sId = Number(row.screen_id);
      const list = actionsByScreen.get(sId) || [];
      list.push({
        actionId: Number(row.action_id),
        screenId: sId,
        actionCode: row.action_code,
        actionName: row.action_name,
        isAllowed: Boolean(row.is_allowed),
      });
      actionsByScreen.set(sId, list);
    }

    const screens: RoleScreenPermissionItem[] = screensRes.rows.map((r) => {
      const sId = Number(r.screen_id);
      return {
        screenId: sId,
        screenCode: r.screen_code,
        screenName: r.screen_name,
        moduleName: r.module_name,
        routePath: r.route_path || null,
        displayOrder: Number(r.display_order),
        canView: Boolean(r.can_view),
        canAdd: Boolean(r.can_add),
        canEdit: Boolean(r.can_edit),
        canDelete: Boolean(r.can_delete),
        actions: actionsByScreen.get(sId) || [],
      };
    });

    return { role, screens };
  }

  async updateRoleMatrix(
    roleId: number,
    dto: UpdateRoleMatrixDto,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<RolePermissionMatrixResponse> {
    const beforeMatrix = await this.getRoleMatrix(roleId);
    const isSuperAdminRole = beforeMatrix.role.roleCode === 'SUPER_ADMIN';

    if (!Array.isArray(dto.screens)) {
      throw new BadRequestException('Screens permission matrix array is required.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const item of dto.screens) {
        const screenId = Number(item.screenId);
        const anyActionAllowed = Array.isArray(item.actions)
          ? item.actions.some((a) => Boolean(a.isAllowed))
          : false;

        let canAdd = Boolean(item.canAdd);
        let canEdit = Boolean(item.canEdit);
        let canDelete = Boolean(item.canDelete);
        let canView =
          Boolean(item.canView) ||
          canAdd ||
          canEdit ||
          canDelete ||
          anyActionAllowed;

        // Prevent SUPER_ADMIN from accidentally revoking its own access to ROLE_MASTER / USER_MASTER
        if (isSuperAdminRole && (screenId === 1007 || screenId === 1008)) {
          canView = true;
          canAdd = true;
          canEdit = true;
          canDelete = true;
        }

        await client.query(
          `
          INSERT INTO tbl_sec_role_permission (
            role_id, screen_id, can_view, can_add, can_edit, can_delete,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10
          )
          ON CONFLICT (role_id, screen_id)
          DO UPDATE SET
            can_view = EXCLUDED.can_view,
            can_add = EXCLUDED.can_add,
            can_edit = EXCLUDED.can_edit,
            can_delete = EXCLUDED.can_delete,
            updated_by = $10,
            updated_date = CURRENT_TIMESTAMP
          `,
          [
            roleId,
            screenId,
            canView,
            canAdd,
            canEdit,
            canDelete,
            user.compId || 1001,
            user.branchId || 1001,
            user.fyearId || 1001,
            user.userId,
          ],
        );

        if (Array.isArray(item.actions)) {
          for (const act of item.actions) {
            const actionId = Number(act.actionId);
            const isAllowed = canView ? Boolean(act.isAllowed) : false;

            await client.query(
              `
              INSERT INTO tbl_sec_role_action_permission (
                role_id, screen_id, action_id, is_allowed,
                comp_id, branch_id, fyear_id, created_by
              ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7, $8
              )
              ON CONFLICT (role_id, action_id)
              DO UPDATE SET
                is_allowed = EXCLUDED.is_allowed,
                updated_by = $8,
                updated_date = CURRENT_TIMESTAMP
              `,
              [
                roleId,
                screenId,
                actionId,
                isAllowed,
                user.compId || 1001,
                user.branchId || 1001,
                user.fyearId || 1001,
                user.userId,
              ],
            );
          }
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updatedMatrix = await this.getRoleMatrix(roleId);

    // Compact summary for audit trail delta
    const summarizeMatrix = (m: RolePermissionMatrixResponse) => ({
      roleCode: m.role.roleCode,
      grantedScreenCount: m.role.grantedScreenCount,
      grantedActionCount: m.role.grantedActionCount,
      permissions: m.screens
        .filter((s) => s.canView)
        .map((s) => ({
          screenCode: s.screenCode,
          rights: [
            s.canView ? 'VIEW' : null,
            s.canAdd ? 'ADD' : null,
            s.canEdit ? 'EDIT' : null,
            s.canDelete ? 'DELETE' : null,
            ...s.actions.filter((a) => a.isAllowed).map((a) => a.actionCode),
          ].filter(Boolean),
        })),
    });

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'ROLE_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_sec_role_permission',
      recordId: roleId,
      oldValue: summarizeMatrix(beforeMatrix) as unknown as Record<
        string,
        unknown
      >,
      newValue: summarizeMatrix(updatedMatrix) as unknown as Record<
        string,
        unknown
      >,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });

    return updatedMatrix;
  }

  async recordScreenAction(
    actionType: 'PRINT' | 'EXPORT',
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<void> {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'ROLE_MASTER',
      actionType,
      entityTable: 'tbl_sec_role',
      recordId: 0,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });
  }

  private mapRoleRow(row: any): RoleRecord {
    return {
      roleId: Number(row.role_id),
      roleCode: row.role_code,
      roleName: row.role_name,
      roleDescription: row.role_description || null,
      isSystemRole: Boolean(row.is_system_role),
      isActive: Boolean(row.is_active),
      grantedScreenCount: Number(row.granted_screen_count || 0),
      totalScreenCount: Number(row.total_screen_count || 0),
      grantedActionCount: Number(row.granted_action_count || 0),
      assignedUserCount: Number(row.assigned_user_count || 0),
      createdDate: row.created_date,
      updatedDate: row.updated_date || null,
    };
  }
}
