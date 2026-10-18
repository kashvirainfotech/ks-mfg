import { Inject, Injectable, Logger } from '@nestjs/common';
import { DRIZZLE_DB } from '../../database/database.module';
import type { DrizzleDb } from '../../database/database.module';
import { tblSysAuditLog } from '../../database/schema';

export type AuditActionType =
  | 'ADD'
  | 'EDIT'
  | 'DELETE'
  | 'PRINT'
  | 'EXPORT'
  | 'AUTHORIZE'
  | 'CANCEL'
  | 'REOPEN'
  | 'LOGIN'
  | 'LOGOUT'
  | 'SUBMIT'
  | 'SEND'
  | 'FINALIZE'
  | 'RELEASE'
  | 'UNLOAD'
  | 'EXIT'
  | 'APPROVE'
  | 'REJECT'
  | 'ASSIGN'
  | 'CONFIRM'
  | 'RUN_MRP'
  | 'CONVERT';

export interface RecordAuditLogParams {
  userId: number;
  username?: string;
  screenCode: string;
  actionType: AuditActionType;
  entityTable: string;
  recordId: number;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
  compId: number;
  branchId: number;
  fyearId?: number | null;
}

const EXCLUDED_DIFF_FIELDS = new Set([
  'passwordHash',
  'password_hash',
  'updatedDate',
  'updated_date',
  'createdDate',
  'created_date',
]);

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb) {}

  /**
   * Computes field-level deltas between oldValue and newValue and writes an
   * immutable audit entry to tbl_sys_audit_log.
   */
  async logAction(params: RecordAuditLogParams): Promise<void> {
    try {
      const sanitizedOld = this.sanitizeObject(params.oldValue);
      const sanitizedNew = this.sanitizeObject(params.newValue);
      const changedFields = this.computeChangedFields(
        sanitizedOld,
        sanitizedNew,
        params.actionType,
      );

      await this.db.insert(tblSysAuditLog).values({
        userId: params.userId,
        username: params.username ?? null,
        screenCode: params.screenCode,
        actionType: params.actionType,
        entityTable: params.entityTable,
        recordId: params.recordId,
        oldValue: sanitizedOld,
        newValue: sanitizedNew,
        changedFields,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ? params.userAgent.slice(0, 300) : null,
        correlationId: params.correlationId ?? null,
        compId: params.compId || 1001,
        branchId: params.branchId || 1001,
        fyearId: params.fyearId ?? null,
        createdBy: params.userId,
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to write audit log for ${params.screenCode}.${params.actionType}: ${err.message}`,
      );
    }
  }

  private sanitizeObject(
    obj?: Record<string, any> | null,
  ): Record<string, any> | null {
    if (!obj || typeof obj !== 'object') return null;
    const clone: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (key === 'passwordHash' || key === 'password_hash') {
        continue;
      }
      clone[key] = val;
    }
    return clone;
  }

  private computeChangedFields(
    oldVal: Record<string, any> | null,
    newVal: Record<string, any> | null,
    actionType: AuditActionType,
  ): Record<string, { old: any; new: any }> | null {
    if (actionType !== 'EDIT' || !oldVal || !newVal) {
      return null;
    }

    const diff: Record<string, { old: any; new: any }> = {};
    const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);

    for (const key of allKeys) {
      if (EXCLUDED_DIFF_FIELDS.has(key)) continue;
      const before = oldVal[key];
      const after = newVal[key];
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        diff[key] = { old: before ?? null, new: after ?? null };
      }
    }

    return Object.keys(diff).length > 0 ? diff : null;
  }
}
