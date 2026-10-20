export class CreateBankAccountDto {
  accountCode: string;
  accountName: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  accountType?: 'CURRENT' | 'SAVINGS' | 'CASH_CREDIT' | 'OVERDRAFT' | 'PETTY_CASH';
  ifscCode?: string;
  swiftCode?: string;
  currencyCode?: string;
  glAccountId: number;
  openingBalance?: number;
  odLimit?: number;
}

export class PaymentDisbursementItemDto {
  invoiceId?: number;
  invoiceNo?: string;
  invoiceDate?: string;
  grossSettledAmount: number;
  tdsSection?: string;
  tdsRate?: number;
  tdsDeductedAmount?: number;
  discountReceivedAmount?: number;
  netPaidAmount: number;
  lineNarration?: string;
}

export class CreatePaymentDisbursementDto {
  voucherDate: string;
  bankAccountId: number;
  partyId: number;
  paymentMode: 'NEFT' | 'RTGS' | 'CHEQUE' | 'IMPS' | 'UPI' | 'CASH' | 'BANK_TRANSFER';
  paymentRefNo: string;
  instrumentDate?: string;
  chequeClearanceStatus?: 'ISSUED' | 'CLEARED' | 'STOPPED' | 'BOUNCED';
  clearanceDate?: string;
  totalGrossSettled: number;
  totalTdsDeducted?: number;
  totalDiscountReceived?: number;
  totalNetPaid: number;
  narration: string;
  items: PaymentDisbursementItemDto[];
}

export class CustomerReceiptItemDto {
  invoiceId?: number;
  invoiceNo?: string;
  invoiceDate?: string;
  grossSettledAmount: number;
  tdsDeductedByCust?: number;
  discountGivenAmount?: number;
  netReceivedAmount: number;
  lineNarration?: string;
}

export class CreateCustomerReceiptDto {
  receiptDate: string;
  bankAccountId: number;
  partyId: number;
  receiptMode: 'NEFT' | 'RTGS' | 'CHEQUE' | 'IMPS' | 'UPI' | 'CASH' | 'DIRECT_DEPOSIT';
  instrumentRefNo: string;
  instrumentDate?: string;
  clearanceStatus?: 'UNCLEARED' | 'CLEARED' | 'BOUNCED';
  clearanceDate?: string;
  totalGrossSettled: number;
  totalTdsDeductedByCust?: number;
  totalDiscountGiven?: number;
  totalNetReceived: number;
  narration: string;
  items: CustomerReceiptItemDto[];
}

export class ImportBankStatementLineDto {
  bankAccountId: number;
  txnDate: string;
  valueDate: string;
  description: string;
  refChequeNo?: string;
  debitWithdrawal?: number;
  creditDeposit?: number;
  runningBalance?: number;
}

export class FinalizeBrsDto {
  bankAccountId: number;
  cutoffDate: string;
  remarks?: string;
}
