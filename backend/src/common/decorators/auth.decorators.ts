import {
  SetMetadata,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import { AuditActionType } from '../services/audit-log.service';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export type PermissionAction =
  | 'VIEW'
  | 'ADD'
  | 'EDIT'
  | 'DELETE'
  | 'PRINT'
  | 'EXPORT'
  | 'AUTHORIZE'
  | 'CANCEL'
  | 'REOPEN'
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
  | 'CLONE'
  | 'EXPLODE'
  | 'MAINTENANCE'
  | 'RUN_MRP'
  | 'CONVERT'
  | 'CLOSE'
  | 'RETURN'
  | 'START'
  | 'COMPLETE'
  | 'DISPATCH'
  | 'RECEIVE'
  | 'RECONCILE'
  | 'POST'
  | 'CONVERT_TO_SO'
  | 'REVISE'
  | 'CREATE_WO'
  | 'HOLD'
  | 'PICK'
  | 'PACK'
  | 'GENERATE_IRN'
  | 'RECORD_PAYMENT'
  | 'INSPECT'
  | 'POST_CREDIT_NOTE'
  | 'RESTOCK'
  | 'LEDGER_DRILLDOWN'
  | 'REVALUE'
  | 'DRILLDOWN'
  | 'REGISTER_BATCH'
  | 'REGISTER_SERIAL'
  | 'PROVISION'
  | 'REORDER'
  | 'DEVIATION'
  | 'DISPOSITION'
  | 'CLOSE_CAPA'
  | 'CALIBRATE'
  | 'LOCKOUT'
  | 'REVERSE'
  | 'DISBURSE';

export interface RequiredPermissionMeta {
  screenCode: string;
  action: PermissionAction;
}

export const PERMISSION_KEY = 'requiredPermission';
export const RequirePermission = (
  screenCode: string,
  action: PermissionAction,
) => SetMetadata(PERMISSION_KEY, { screenCode, action });

export interface AuditMetadata {
  screenCode: string;
  entityTable: string;
  actionType?: AuditActionType;
}

export const AUDIT_META_KEY = 'auditMeta';
export const AuditMeta = (
  screenCode: string,
  entityTable: string,
  actionType?: AuditActionType,
) => SetMetadata(AUDIT_META_KEY, { screenCode, entityTable, actionType });

export interface AuthenticatedUserContext {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  userCategory: string;
  isSuperAdmin: boolean;
  compId: number;
  branchId: number;
  fyearId: number;
  jti?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUserContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUserContext | undefined;
    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
