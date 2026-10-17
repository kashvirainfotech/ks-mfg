import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import type { AuditLogFilterQueryDto } from './audit-log.dto';

export interface AuditLogRecord {
  auditId: number;
  userId: number;
  username: string | null;
  userFullName: string | null;
  screenCode: string;
  screenName: string | null;
  moduleName: string | null;
  actionType: string;
  entityTable: string;
  recordId: number;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  changedFields: Record<string, { old: unknown; new: unknown }> | null;
  changedFieldCount: number;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  actionTimestamp: string;
  compId: number;
  compCode: string | null;
  compName: string | null;
  branchId: number;
  branchCode: string | null;
  branchName: string | null;
  fyearId: number | null;
}

export interface AuditLogMetadataResponse {
  screenCodes: { screenCode: string; screenName: string | null }[];
  actionTypes: string[];
  entityTables: string[];
  stats: {
    totalLogs: number;
    editsWithDeltaCount: number;
    deletesCount: number;
    loginsCount: number;
  };
}

@Injectable()
export class AuditLogViewerService implements OnModuleInit {
  private readonly logger = new Logger(AuditLogViewerService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        INSERT INTO tbl_sec_action (
            action_id, screen_id, action_code, action_name, is_active,
            comp_id, branch_id, fyear_id, created_by
        ) VALUES
            (1020, 1009, 'PRINT', 'Print Security & Delta Audit Trail', TRUE, 1001, 1001, 1001, 1001)
        ON CONFLICT (screen_id, action_code) DO NOTHING;

        SELECT setval('seq_action_id', GREATEST((SELECT COALESCE(MAX(action_id), 1020) FROM tbl_sec_action), 1020));

        INSERT INTO tbl_sec_role_action_permission (
            role_id, screen_id, action_id, is_allowed,
            comp_id, branch_id, fyear_id, created_by
        )
        SELECT 1001, a.screen_id, a.action_id, TRUE, 1001, 1001, 1001, 1001
        FROM tbl_sec_action a
        WHERE a.screen_id = 1009
        ON CONFLICT (role_id, action_id) DO NOTHING;
      `);
    } catch (err: any) {
      this.logger.warn(
        `Unable to sync AUDIT_LOG action seeds on startup: ${err?.message || err}`,
      );
    }
  }

  async findAllLogs(query: AuditLogFilterQueryDto): Promise<AuditLogRecord[]> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (query.compId && query.compId !== 'ALL') {
      params.push(Number(query.compId));
      conditions.push(`a.comp_id = $${params.length}`);
    }
    if (query.branchId && query.branchId !== 'ALL') {
      params.push(Number(query.branchId));
      conditions.push(`a.branch_id = $${params.length}`);
    }
    if (query.userId && query.userId !== 'ALL') {
      params.push(Number(query.userId));
      conditions.push(`a.user_id = $${params.length}`);
    }
    if (query.screenCode && query.screenCode !== 'ALL') {
      params.push(query.screenCode);
      conditions.push(`a.screen_code = $${params.length}`);
    }
    if (query.actionType && query.actionType !== 'ALL') {
      params.push(query.actionType);
      conditions.push(`a.action_type = $${params.length}`);
    }
    if (query.entityTable && query.entityTable !== 'ALL') {
      params.push(query.entityTable);
      conditions.push(`a.entity_table = $${params.length}`);
    }
    if (query.fromDate) {
      params.push(query.fromDate);
      conditions.push(`a.action_timestamp >= $${params.length}::date`);
    }
    if (query.toDate) {
      params.push(query.toDate);
      conditions.push(
        `a.action_timestamp < ($${params.length}::date + INTERVAL '1 day')`,
      );
    }

    const limit = Math.min(Math.max(Number(query.limit) || 300, 1), 1000);
    params.push(limit);

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const res = await this.pool.query(
      `
      SELECT
        a.audit_id,
        a.user_id,
        a.username,
        u.full_name AS user_full_name,
        a.screen_code,
        s.screen_name,
        s.module_name,
        a.action_type,
        a.entity_table,
        a.record_id,
        a.old_value,
        a.new_value,
        a.changed_fields,
        a.ip_address,
        a.user_agent,
        a.correlation_id,
        a.action_timestamp,
        a.comp_id,
        c.comp_code,
        c.comp_name,
        a.branch_id,
        b.branch_code,
        b.branch_name,
        a.fyear_id
      FROM tbl_sys_audit_log a
      LEFT JOIN tbl_sec_user u ON u.user_id = a.user_id
      LEFT JOIN tbl_sec_screen s ON s.screen_code = a.screen_code
      LEFT JOIN tbl_org_company c ON c.comp_id = a.comp_id
      LEFT JOIN tbl_org_branch b ON b.branch_id = a.branch_id
      ${whereSql}
      ORDER BY a.action_timestamp DESC, a.audit_id DESC
      LIMIT $${params.length}
      `,
      params,
    );

    return res.rows.map((r) => this.mapAuditRow(r));
  }

  async findLogById(auditId: number): Promise<AuditLogRecord> {
    const res = await this.pool.query(
      `
      SELECT
        a.audit_id,
        a.user_id,
        a.username,
        u.full_name AS user_full_name,
        a.screen_code,
        s.screen_name,
        s.module_name,
        a.action_type,
        a.entity_table,
        a.record_id,
        a.old_value,
        a.new_value,
        a.changed_fields,
        a.ip_address,
        a.user_agent,
        a.correlation_id,
        a.action_timestamp,
        a.comp_id,
        c.comp_code,
        c.comp_name,
        a.branch_id,
        b.branch_code,
        b.branch_name,
        a.fyear_id
      FROM tbl_sys_audit_log a
      LEFT JOIN tbl_sec_user u ON u.user_id = a.user_id
      LEFT JOIN tbl_sec_screen s ON s.screen_code = a.screen_code
      LEFT JOIN tbl_org_company c ON c.comp_id = a.comp_id
      LEFT JOIN tbl_org_branch b ON b.branch_id = a.branch_id
      WHERE a.audit_id = $1
      LIMIT 1
      `,
      [auditId],
    );

    if (res.rowCount === 0) {
      throw new NotFoundException(`Audit Log #${auditId} not found.`);
    }
    return this.mapAuditRow(res.rows[0]);
  }

  async getMetadata(): Promise<AuditLogMetadataResponse> {
    const [screensRes, actionsRes, tablesRes, statsRes] = await Promise.all([
      this.pool.query(`
        SELECT DISTINCT a.screen_code, s.screen_name
        FROM tbl_sys_audit_log a
        LEFT JOIN tbl_sec_screen s ON s.screen_code = a.screen_code
        ORDER BY a.screen_code ASC
      `),
      this.pool.query(`
        SELECT DISTINCT action_type
        FROM tbl_sys_audit_log
        ORDER BY action_type ASC
      `),
      this.pool.query(`
        SELECT DISTINCT entity_table
        FROM tbl_sys_audit_log
        ORDER BY entity_table ASC
      `),
      this.pool.query(`
        SELECT
          COUNT(*)::int AS total_logs,
          COUNT(*) FILTER (WHERE action_type = 'EDIT' AND changed_fields IS NOT NULL)::int AS edits_with_delta_count,
          COUNT(*) FILTER (WHERE action_type = 'DELETE')::int AS deletes_count,
          COUNT(*) FILTER (WHERE action_type IN ('LOGIN', 'LOGOUT'))::int AS logins_count
        FROM tbl_sys_audit_log
      `),
    ]);

    const statRow = statsRes.rows[0] || {};

    return {
      screenCodes: screensRes.rows.map((r) => ({
        screenCode: r.screen_code,
        screenName: r.screen_name || null,
      })),
      actionTypes: actionsRes.rows.map((r) => r.action_type),
      entityTables: tablesRes.rows.map((r) => r.entity_table),
      stats: {
        totalLogs: Number(statRow.total_logs || 0),
        editsWithDeltaCount: Number(statRow.edits_with_delta_count || 0),
        deletesCount: Number(statRow.deletes_count || 0),
        loginsCount: Number(statRow.logins_count || 0),
      },
    };
  }

  async recordScreenAction(
    actionType: 'PRINT' | 'EXPORT',
    actor: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<void> {
    await this.auditLogService.logAction({
      userId: actor.userId,
      username: actor.username,
      screenCode: 'AUDIT_LOG',
      actionType,
      entityTable: 'tbl_sys_audit_log',
      recordId: 0,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: actor.compId,
      branchId: actor.branchId,
      fyearId: actor.fyearId,
    });
  }

  private mapAuditRow(r: any): AuditLogRecord {
    const changedFields =
      r.changed_fields && typeof r.changed_fields === 'object'
        ? r.changed_fields
        : null;
    const changedFieldCount = changedFields
      ? Object.keys(changedFields).length
      : 0;

    return {
      auditId: Number(r.audit_id),
      userId: Number(r.user_id),
      username: r.username || null,
      userFullName: r.user_full_name || null,
      screenCode: r.screen_code,
      screenName: r.screen_name || null,
      moduleName: r.module_name || null,
      actionType: r.action_type,
      entityTable: r.entity_table,
      recordId: Number(r.record_id),
      oldValue: r.old_value || null,
      newValue: r.new_value || null,
      changedFields,
      changedFieldCount,
      ipAddress: r.ip_address || null,
      userAgent: r.user_agent || null,
      correlationId: r.correlation_id || null,
      actionTimestamp: r.action_timestamp,
      compId: Number(r.comp_id),
      compCode: r.comp_code || null,
      compName: r.comp_name || null,
      branchId: Number(r.branch_id),
      branchCode: r.branch_code || null,
      branchName: r.branch_name || null,
      fyearId: r.fyear_id ? Number(r.fyear_id) : null,
    };
  }
}
