export interface AuditLogFilterQueryDto {
  compId?: string;
  branchId?: string;
  userId?: string;
  screenCode?: string;
  actionType?: string;
  entityTable?: string;
  fromDate?: string;
  toDate?: string;
  limit?: string;
}
