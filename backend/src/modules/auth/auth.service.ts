import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB, PG_POOL } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.module';
import {
  tblSecUser,
  tblSecUserPreference,
} from '../../database/schema';
import { RedisService } from '../../common/services/redis.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import {
  LoginDto,
  SwitchContextDto,
  UpdateUserPreferenceDto,
} from './auth.dto';
import { AuthenticatedUserContext } from '../../common/decorators/auth.decorators';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async login(
    dto: LoginDto,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const identifier = dto.usernameOrEmail.trim().toLowerCase();
    const userRes = await this.pool.query(
      `
      SELECT *
      FROM tbl_sec_user
      WHERE LOWER(username) = $1 OR LOWER(email) = $1
      LIMIT 1
      `,
      [identifier],
    );

    const user = userRes.rows[0];
    if (!user) {
      throw new UnauthorizedException('Invalid username/email or password.');
    }

    if (!user.is_active) {
      throw new ForbiddenException(
        'Your user account is inactive. Please contact the system administrator.',
      );
    }

    const passwordValid = await bcrypt.compare(
      dto.password,
      user.password_hash,
    );
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid username/email or password.');
    }

    const userId = Number(user.user_id);
    const isSuperAdmin = Boolean(user.is_super_admin);

    // Load user preferences
    const pref = await this.getOrCreateUserPreferences(userId);

    // Load allowed companies, branches, financial years
    const allowedContext = await this.resolveAllowedTenancy(
      userId,
      isSuperAdmin,
    );

    if (allowedContext.companies.length === 0) {
      throw new ForbiddenException(
        'No active company access mapped to this user account.',
      );
    }

    const activeCompId =
      dto.compId ||
      pref.defaultCompId ||
      allowedContext.companies[0]?.compId ||
      1001;
    const branchesForComp = allowedContext.branches.filter(
      (b) => b.compId === activeCompId,
    );
    const activeBranchId =
      dto.branchId ||
      (branchesForComp.some((b) => b.branchId === pref.defaultBranchId)
        ? pref.defaultBranchId
        : branchesForComp[0]?.branchId) ||
      allowedContext.branches[0]?.branchId ||
      1001;

    const fyearsForComp = allowedContext.financialYears.filter(
      (f) => f.compId === activeCompId,
    );
    const activeFyearId =
      dto.fyearId ||
      (fyearsForComp.some((f) => f.fyearId === pref.defaultFyearId)
        ? pref.defaultFyearId
        : fyearsForComp.find((f) => f.isCurrent)?.fyearId ||
          fyearsForComp[0]?.fyearId) ||
      1001;

    // Update last_login_at
    await this.db
      .update(tblSecUser)
      .set({ lastLoginAt: new Date(), failedLoginCount: 0 })
      .where(eq(tblSecUser.userId, userId));

    const tokens = await this.issueTokenPair({
      userId,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      userCategory: user.user_category,
      isSuperAdmin,
      compId: activeCompId,
      branchId: activeBranchId,
      fyearId: activeFyearId,
    });

    const permissions = await this.resolvePermissionsMatrix(
      userId,
      isSuperAdmin,
      activeCompId,
      activeBranchId,
    );

    // Record LOGIN audit trail
    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'AUTH',
      actionType: 'LOGIN',
      entityTable: 'tbl_sec_user',
      recordId: userId,
      newValue: {
        compId: activeCompId,
        branchId: activeBranchId,
        fyearId: activeFyearId,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: activeCompId,
      branchId: activeBranchId,
      fyearId: activeFyearId,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        userId,
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        fullName: user.full_name,
        userCategory: user.user_category,
        linkedEntityId: user.linked_entity_id
          ? Number(user.linked_entity_id)
          : null,
        isSuperAdmin,
      },
      activeContext: {
        compId: activeCompId,
        branchId: activeBranchId,
        fyearId: activeFyearId,
      },
      preferences: pref,
      allowedCompanies: allowedContext.companies,
      allowedBranches: allowedContext.branches,
      allowedFinancialYears: allowedContext.financialYears,
      permissions,
    };
  }

  async getMe(userCtx: AuthenticatedUserContext) {
    const userRes = await this.pool.query(
      `SELECT * FROM tbl_sec_user WHERE user_id = $1 LIMIT 1`,
      [userCtx.userId],
    );
    const user = userRes.rows[0];
    if (!user || !user.is_active) {
      throw new UnauthorizedException('User account not found or inactive.');
    }

    const isSuperAdmin = Boolean(user.is_super_admin);
    const pref = await this.getOrCreateUserPreferences(userCtx.userId);
    const allowedContext = await this.resolveAllowedTenancy(
      userCtx.userId,
      isSuperAdmin,
    );
    const permissions = await this.resolvePermissionsMatrix(
      userCtx.userId,
      isSuperAdmin,
      userCtx.compId,
      userCtx.branchId,
    );

    return {
      user: {
        userId: Number(user.user_id),
        username: user.username,
        email: user.email,
        mobile: user.mobile,
        fullName: user.full_name,
        userCategory: user.user_category,
        linkedEntityId: user.linked_entity_id
          ? Number(user.linked_entity_id)
          : null,
        isSuperAdmin,
      },
      activeContext: {
        compId: userCtx.compId,
        branchId: userCtx.branchId,
        fyearId: userCtx.fyearId,
      },
      preferences: pref,
      allowedCompanies: allowedContext.companies,
      allowedBranches: allowedContext.branches,
      allowedFinancialYears: allowedContext.financialYears,
      permissions,
    };
  }

  async switchContext(
    userCtx: AuthenticatedUserContext,
    dto: SwitchContextDto,
  ) {
    const allowedContext = await this.resolveAllowedTenancy(
      userCtx.userId,
      userCtx.isSuperAdmin,
    );

    const hasComp = allowedContext.companies.some(
      (c) => c.compId === dto.compId,
    );
    const hasBranch = allowedContext.branches.some(
      (b) => b.branchId === dto.branchId && b.compId === dto.compId,
    );
    const hasFyear = allowedContext.financialYears.some(
      (f) => f.fyearId === dto.fyearId && f.compId === dto.compId,
    );

    if (!hasComp || !hasBranch || !hasFyear) {
      throw new ForbiddenException(
        'You do not have access to the selected Company, Branch, or Financial Year.',
      );
    }

    const tokens = await this.issueTokenPair({
      userId: userCtx.userId,
      username: userCtx.username,
      fullName: userCtx.fullName,
      email: userCtx.email,
      userCategory: userCtx.userCategory,
      isSuperAdmin: userCtx.isSuperAdmin,
      compId: dto.compId,
      branchId: dto.branchId,
      fyearId: dto.fyearId,
    });

    const permissions = await this.resolvePermissionsMatrix(
      userCtx.userId,
      userCtx.isSuperAdmin,
      dto.compId,
      dto.branchId,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      activeContext: {
        compId: dto.compId,
        branchId: dto.branchId,
        fyearId: dto.fyearId,
      },
      permissions,
    };
  }

  async updatePreferences(
    userCtx: AuthenticatedUserContext,
    dto: UpdateUserPreferenceDto,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const before = await this.getOrCreateUserPreferences(userCtx.userId);

    await this.db
      .update(tblSecUserPreference)
      .set({
        themeMode: dto.themeMode ?? before.themeMode,
        themeColor: dto.themeColor ?? before.themeColor,
        sidebarCollapsed: dto.sidebarCollapsed ?? before.sidebarCollapsed,
        defaultCompId: dto.defaultCompId ?? before.defaultCompId,
        defaultBranchId: dto.defaultBranchId ?? before.defaultBranchId,
        defaultFyearId: dto.defaultFyearId ?? before.defaultFyearId,
        updatedBy: userCtx.userId,
        updatedDate: new Date(),
      })
      .where(eq(tblSecUserPreference.userId, userCtx.userId));

    const after = await this.getOrCreateUserPreferences(userCtx.userId);

    await this.auditLogService.logAction({
      userId: userCtx.userId,
      username: userCtx.username,
      screenCode: 'USER_PROFILE',
      actionType: 'EDIT',
      entityTable: 'tbl_sec_user_preference',
      recordId: after.userPreferenceId,
      oldValue: before,
      newValue: after,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: userCtx.compId,
      branchId: userCtx.branchId,
      fyearId: userCtx.fyearId,
    });

    return after;
  }

  async refreshTokens(refreshToken?: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token.');
    }

    try {
      const secret =
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        'ks-mfg-erp-super-secret-refresh-key-2026';
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret,
      });

      const blacklisted = await this.redisService.isTokenBlacklisted(
        payload.jti || refreshToken,
      );
      if (blacklisted) {
        throw new UnauthorizedException('Refresh token has been revoked.');
      }

      // Rotate old refresh token
      if (payload.jti) {
        await this.redisService.blacklistToken(payload.jti, 7 * 86400);
      }

      return this.issueTokenPair({
        userId: Number(payload.sub),
        username: payload.username,
        fullName: payload.fullName,
        email: payload.email,
        userCategory: payload.userCategory,
        isSuperAdmin: Boolean(payload.isSuperAdmin),
        compId: Number(payload.compId || 1001),
        branchId: Number(payload.branchId || 1001),
        fyearId: Number(payload.fyearId || 1001),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token.');
    }
  }

  async logout(
    userCtx: AuthenticatedUserContext,
    refreshToken?: string,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    if (userCtx.jti) {
      await this.redisService.blacklistToken(userCtx.jti, 900);
    }
    if (refreshToken) {
      await this.redisService.blacklistToken(refreshToken, 7 * 86400);
    }

    await this.auditLogService.logAction({
      userId: userCtx.userId,
      username: userCtx.username,
      screenCode: 'AUTH',
      actionType: 'LOGOUT',
      entityTable: 'tbl_sec_user',
      recordId: userCtx.userId,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
      compId: userCtx.compId,
      branchId: userCtx.branchId,
      fyearId: userCtx.fyearId,
    });

    return { loggedOut: true };
  }

  private async issueTokenPair(payload: {
    userId: number;
    username: string;
    fullName: string;
    email: string;
    userCategory: string;
    isSuperAdmin: boolean;
    compId: number;
    branchId: number;
    fyearId: number;
  }) {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();

    const accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'ks-mfg-erp-super-secret-access-key-2026';
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'ks-mfg-erp-super-secret-refresh-key-2026';

    const accessToken = await this.jwtService.signAsync(
      {
        sub: payload.userId,
        username: payload.username,
        fullName: payload.fullName,
        email: payload.email,
        userCategory: payload.userCategory,
        isSuperAdmin: payload.isSuperAdmin,
        compId: payload.compId,
        branchId: payload.branchId,
        fyearId: payload.fyearId,
        jti: accessJti,
      },
      {
        secret: accessSecret,
        expiresIn: (this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ||
          '15m') as any,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: payload.userId,
        username: payload.username,
        fullName: payload.fullName,
        email: payload.email,
        userCategory: payload.userCategory,
        isSuperAdmin: payload.isSuperAdmin,
        compId: payload.compId,
        branchId: payload.branchId,
        fyearId: payload.fyearId,
        jti: refreshJti,
      },
      {
        secret: refreshSecret,
        expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ||
          '7d') as any,
      },
    );

    return { accessToken, refreshToken };
  }

  private async getOrCreateUserPreferences(userId: number) {
    const existing = await this.db
      .select()
      .from(tblSecUserPreference)
      .where(eq(tblSecUserPreference.userId, userId))
      .limit(1);

    if (existing[0]) {
      return existing[0];
    }

    const inserted = await this.db
      .insert(tblSecUserPreference)
      .values({
        userId,
        themeMode: 'light',
        themeColor: 'indigo',
        sidebarCollapsed: false,
        defaultCompId: 1001,
        defaultBranchId: 1001,
        defaultFyearId: 1001,
        compId: 1001,
        branchId: 1001,
        fyearId: 1001,
        createdBy: userId,
      })
      .returning();

    return inserted[0];
  }

  private async resolveAllowedTenancy(userId: number, isSuperAdmin: boolean) {
    const companiesQuery = isSuperAdmin
      ? `SELECT comp_id, comp_code, comp_name, legal_name, gstin, state_code, base_currency_code
         FROM tbl_org_company WHERE is_active = TRUE ORDER BY comp_id ASC`
      : `SELECT DISTINCT c.comp_id, c.comp_code, c.comp_name, c.legal_name, c.gstin, c.state_code, c.base_currency_code
         FROM tbl_org_company c
         INNER JOIN tbl_sec_user_company_role ucr ON ucr.mapped_comp_id = c.comp_id
         WHERE c.is_active = TRUE AND ucr.user_id = $1 AND ucr.is_active = TRUE
         ORDER BY c.comp_id ASC`;

    const branchesQuery = isSuperAdmin
      ? `SELECT branch_id, comp_id, branch_code, branch_name, branch_type, city, state_code, is_head_office
         FROM tbl_org_branch WHERE is_active = TRUE ORDER BY comp_id ASC, branch_id ASC`
      : `SELECT DISTINCT b.branch_id, b.comp_id, b.branch_code, b.branch_name, b.branch_type, b.city, b.state_code, b.is_head_office
         FROM tbl_org_branch b
         INNER JOIN tbl_sec_user_branch_role ubr ON ubr.mapped_branch_id = b.branch_id
         WHERE b.is_active = TRUE AND ubr.user_id = $1 AND ubr.is_active = TRUE
         ORDER BY b.comp_id ASC, b.branch_id ASC`;

    const compRows = await this.pool.query(
      companiesQuery,
      isSuperAdmin ? [] : [userId],
    );
    const branchRows = await this.pool.query(
      branchesQuery,
      isSuperAdmin ? [] : [userId],
    );

    const fyRows = await this.pool.query(
      `
      SELECT
        fy.fyear_id,
        fy.comp_id,
        fy.fyear_code,
        fy.fyear_name,
        fy.start_date,
        fy.end_date,
        fy.is_current,
        fy.is_closed,
        COALESCE(bfy.is_locked, FALSE) AS is_locked,
        bfy.branch_id AS mapped_branch_id
      FROM tbl_org_financial_year fy
      LEFT JOIN tbl_org_branch_fyear bfy
        ON bfy.fyear_id = fy.fyear_id AND bfy.comp_id = fy.comp_id
      WHERE fy.is_active = TRUE
      ORDER BY fy.start_date DESC
      `,
    );

    return {
      companies: compRows.rows.map((r) => ({
        compId: Number(r.comp_id),
        compCode: r.comp_code,
        compName: r.comp_name,
        legalName: r.legal_name,
        gstin: r.gstin,
        stateCode: r.state_code,
        baseCurrencyCode: r.base_currency_code,
      })),
      branches: branchRows.rows.map((r) => ({
        branchId: Number(r.branch_id),
        compId: Number(r.comp_id),
        branchCode: r.branch_code,
        branchName: r.branch_name,
        branchType: r.branch_type,
        city: r.city,
        stateCode: r.state_code,
        isHeadOffice: Boolean(r.is_head_office),
      })),
      financialYears: fyRows.rows.map((r) => ({
        fyearId: Number(r.fyear_id),
        compId: Number(r.comp_id),
        fyearCode: r.fyear_code,
        fyearName: r.fyear_name,
        startDate: r.start_date,
        endDate: r.end_date,
        isCurrent: Boolean(r.is_current),
        isClosed: Boolean(r.is_closed),
        isLocked: Boolean(r.is_locked),
        mappedBranchId: r.mapped_branch_id ? Number(r.mapped_branch_id) : null,
      })),
    };
  }

  private async resolvePermissionsMatrix(
    userId: number,
    isSuperAdmin: boolean,
    compId: number,
    branchId: number,
  ) {
    const screensRes = await this.pool.query(
      `
      SELECT screen_id, screen_code, screen_name, module_name, route_path, icon_name, display_order
      FROM tbl_sec_screen
      WHERE is_active = TRUE
      ORDER BY display_order ASC
      `,
    );

    if (isSuperAdmin) {
      const actionsRes = await this.pool.query(
        `SELECT screen_id, action_code FROM tbl_sec_action WHERE is_active = TRUE`,
      );
      const actionMap = new Map<number, string[]>();
      for (const a of actionsRes.rows) {
        const sid = Number(a.screen_id);
        const list = actionMap.get(sid) || [];
        list.push(a.action_code);
        actionMap.set(sid, list);
      }

      return screensRes.rows.map((s) => ({
        screenId: Number(s.screen_id),
        screenCode: s.screen_code,
        screenName: s.screen_name,
        moduleName: s.module_name,
        routePath: s.route_path,
        iconName: s.icon_name,
        displayOrder: Number(s.display_order),
        canView: true,
        canAdd: true,
        canEdit: true,
        canDelete: true,
        allowedActions: actionMap.get(Number(s.screen_id)) || [],
      }));
    }

    const permRes = await this.pool.query(
      `
      WITH user_roles AS (
        SELECT role_id FROM tbl_sec_user_branch_role
        WHERE user_id = $1 AND mapped_branch_id = $2 AND is_active = TRUE
        UNION
        SELECT role_id FROM tbl_sec_user_company_role
        WHERE user_id = $1 AND mapped_comp_id = $3 AND is_active = TRUE
      )
      SELECT
        s.screen_id,
        s.screen_code,
        s.screen_name,
        s.module_name,
        s.route_path,
        s.icon_name,
        s.display_order,
        COALESCE(BOOL_OR(rp.can_view), FALSE) AS can_view,
        COALESCE(BOOL_OR(rp.can_add), FALSE) AS can_add,
        COALESCE(BOOL_OR(rp.can_edit), FALSE) AS can_edit,
        COALESCE(BOOL_OR(rp.can_delete), FALSE) AS can_delete
      FROM tbl_sec_screen s
      LEFT JOIN tbl_sec_role_permission rp
        ON rp.screen_id = s.screen_id
        AND rp.role_id IN (SELECT role_id FROM user_roles)
      WHERE s.is_active = TRUE
      GROUP BY s.screen_id, s.screen_code, s.screen_name, s.module_name, s.route_path, s.icon_name, s.display_order
      ORDER BY s.display_order ASC
      `,
      [userId, branchId, compId],
    );

    const actRes = await this.pool.query(
      `
      WITH user_roles AS (
        SELECT role_id FROM tbl_sec_user_branch_role
        WHERE user_id = $1 AND mapped_branch_id = $2 AND is_active = TRUE
        UNION
        SELECT role_id FROM tbl_sec_user_company_role
        WHERE user_id = $1 AND mapped_comp_id = $3 AND is_active = TRUE
      )
      SELECT rap.screen_id, a.action_code
      FROM tbl_sec_role_action_permission rap
      INNER JOIN tbl_sec_action a ON a.action_id = rap.action_id
      WHERE rap.role_id IN (SELECT role_id FROM user_roles)
        AND rap.is_allowed = TRUE
        AND a.is_active = TRUE
      `,
      [userId, branchId, compId],
    );

    const actionMap = new Map<number, string[]>();
    for (const a of actRes.rows) {
      const sid = Number(a.screen_id);
      const list = actionMap.get(sid) || [];
      if (!list.includes(a.action_code)) {
        list.push(a.action_code);
      }
      actionMap.set(sid, list);
    }

    return permRes.rows.map((s) => ({
      screenId: Number(s.screen_id),
      screenCode: s.screen_code,
      screenName: s.screen_name,
      moduleName: s.module_name,
      routePath: s.route_path,
      iconName: s.icon_name,
      displayOrder: Number(s.display_order),
      canView: Boolean(s.can_view),
      canAdd: Boolean(s.can_add),
      canEdit: Boolean(s.can_edit),
      canDelete: Boolean(s.can_delete),
      allowedActions: actionMap.get(Number(s.screen_id)) || [],
    }));
  }
}
