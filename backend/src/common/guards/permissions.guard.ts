import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Pool } from 'pg';
import { PG_POOL } from '../../database/database.module';
import {
  AuthenticatedUserContext,
  PERMISSION_KEY,
  RequiredPermissionMeta,
} from '../decorators/auth.decorators';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPerm =
      this.reflector.getAllAndOverride<RequiredPermissionMeta>(PERMISSION_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    if (!requiredPerm) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUserContext | undefined;

    if (!user) {
      throw new ForbiddenException('User context is missing for permission check.');
    }

    // Super Admin has unrestricted permissions across all screens and actions
    if (user.isSuperAdmin) {
      return true;
    }

    const { screenCode, action } = requiredPerm;

    // Resolve user's active roleIds for current company and branch
    const rolesResult = await this.pool.query<{ role_id: number }>(
      `
      SELECT DISTINCT role_id FROM (
        SELECT role_id FROM tbl_sec_user_branch_role
        WHERE user_id = $1 AND mapped_branch_id = $2 AND is_active = TRUE
        UNION
        SELECT role_id FROM tbl_sec_user_company_role
        WHERE user_id = $1 AND mapped_comp_id = $3 AND is_active = TRUE
      ) r
      `,
      [user.userId, user.branchId, user.compId],
    );

    const roleIds = rolesResult.rows.map((r) => Number(r.role_id));
    if (roleIds.length === 0) {
      throw new ForbiddenException(
        `No active role assigned for Branch #${user.branchId} / Company #${user.compId}.`,
      );
    }

    if (
      action === 'VIEW' ||
      action === 'ADD' ||
      action === 'EDIT' ||
      action === 'DELETE'
    ) {
      const colMap: Record<string, string> = {
        VIEW: 'can_view',
        ADD: 'can_add',
        EDIT: 'can_edit',
        DELETE: 'can_delete',
      };
      const col = colMap[action];
      const permCheck = await this.pool.query<{ allowed: boolean }>(
        `
        SELECT BOOL_OR(rp.${col}) AS allowed
        FROM tbl_sec_role_permission rp
        INNER JOIN tbl_sec_screen s ON s.screen_id = rp.screen_id
        WHERE rp.role_id = ANY($1::bigint[])
          AND s.screen_code = $2
          AND s.is_active = TRUE
        `,
        [roleIds, screenCode],
      );

      if (!permCheck.rows[0]?.allowed) {
        throw new ForbiddenException(
          `Permission denied: [${screenCode} -> ${action}] is not granted to your role.`,
        );
      }
      return true;
    }

    // Custom Action Item check (PRINT, EXPORT, AUTHORIZE, CANCEL, REOPEN)
    const actionCheck = await this.pool.query<{ allowed: boolean }>(
      `
      SELECT BOOL_OR(rap.is_allowed) AS allowed
      FROM tbl_sec_role_action_permission rap
      INNER JOIN tbl_sec_screen s ON s.screen_id = rap.screen_id
      INNER JOIN tbl_sec_action a ON a.action_id = rap.action_id
      WHERE rap.role_id = ANY($1::bigint[])
        AND s.screen_code = $2
        AND a.action_code = $3
        AND a.is_active = TRUE
      `,
      [roleIds, screenCode, action],
    );

    if (!actionCheck.rows[0]?.allowed) {
      throw new ForbiddenException(
        `Action permission denied: [${screenCode} -> ${action}] is not allowed for your role.`,
      );
    }

    return true;
  }
}
