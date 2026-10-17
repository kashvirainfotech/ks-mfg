import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import {
  AUDIT_META_KEY,
  AuditMetadata,
  AuthenticatedUserContext,
} from '../decorators/auth.decorators';
import { AuditActionType, AuditLogService } from '../services/audit-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMeta = this.reflector.getAllAndOverride<AuditMetadata>(
      AUDIT_META_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase();

    if (
      !auditMeta &&
      method !== 'POST' &&
      method !== 'PUT' &&
      method !== 'PATCH' &&
      method !== 'DELETE'
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((responseBody) => {
        const user = request.user as AuthenticatedUserContext | undefined;
        // Skip if controller already explicitly wrote audit log via request.__auditLogged flag
        if (!user || request.__auditLogged) {
          return;
        }

        const actionType: AuditActionType =
          auditMeta?.actionType ||
          (method === 'POST'
            ? 'ADD'
            : method === 'DELETE'
              ? 'DELETE'
              : 'EDIT');

        const screenCode = auditMeta?.screenCode || 'SYSTEM';
        const entityTable = auditMeta?.entityTable || 'tbl_unknown';

        const payloadData = responseBody?.data ?? responseBody;
        const recordId =
          Number(
            request.params?.id ||
              payloadData?.id ||
              payloadData?.compId ||
              payloadData?.branchId ||
              payloadData?.fyearId ||
              payloadData?.userId ||
              user.userId ||
              0,
          ) || 0;

        const oldValue = request.__auditOldValue ?? null;
        const newValue =
          actionType === 'DELETE'
            ? null
            : typeof payloadData === 'object'
              ? payloadData
              : request.body;

        void this.auditLogService.logAction({
          userId: user.userId,
          username: user.username,
          screenCode,
          actionType,
          entityTable,
          recordId,
          oldValue,
          newValue,
          ipAddress: request.ip || request.socket?.remoteAddress,
          userAgent: request.headers['user-agent'],
          correlationId: request.correlationId,
          compId: user.compId,
          branchId: user.branchId,
          fyearId: user.fyearId,
        });
      }),
    );
  }
}
