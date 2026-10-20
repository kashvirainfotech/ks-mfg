export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';
export type VoucherType =
  | 'GENERAL'
  | 'PURCHASE_INVOICE'
  | 'SALES_INVOICE'
  | 'PAYMENT'
  | 'RECEIPT'
  | 'STOCK_ADJUSTMENT'
  | 'ABSORPTION_COST'
  | 'OPENING_BALANCE';
export type VoucherStatus = 'DRAFT' | 'POSTED' | 'REVERSED';

export class CreateChartOfAccountDto {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  parentAccountId?: number;
  level?: number;
  normalBalance: NormalBalance;
  isGroup?: boolean;
  isReconciliation?: boolean;
  currencyCode?: string;
  description?: string;
}

export class UpdateChartOfAccountDto {
  accountName?: string;
  parentAccountId?: number;
  isReconciliation?: boolean;
  description?: string;
  isActive?: boolean;
}

export class CreateCostCenterDto {
  costCenterCode: string;
  costCenterName: string;
  deptId?: number;
}

export class JournalItemDto {
  accountId: number;
  debitAmount: number;
  creditAmount: number;
  partyId?: number;
  costCenterId?: number;
  lineNarration?: string;
  lineNo?: number;
}

export class CreateJournalVoucherDto {
  voucherDate?: string;
  voucherType?: VoucherType;
  sourceModule?: string;
  sourceRefNo?: string;
  sourceRefId?: number;
  narration: string;
  items: JournalItemDto[];
}

export class ReverseJournalVoucherDto {
  reversalReason: string;
}

export class GenerateOperationalJvDto {
  operationType: 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'STOCK_ADJUSTMENT' | 'FG_RECEIPT';
  operationId: number;
}
