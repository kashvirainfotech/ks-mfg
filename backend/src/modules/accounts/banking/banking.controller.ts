import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CurrentUser,
  RequirePermission,
} from '../../../common/decorators/auth.decorators';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import { BankingService } from './banking.service';
import {
  CreateBankAccountDto,
  CreatePaymentDisbursementDto,
  CreateCustomerReceiptDto,
  ImportBankStatementLineDto,
  FinalizeBrsDto,
} from './banking.dto';

@Controller('accounts/banking')
export class BankingController {
  constructor(private readonly bankingService: BankingService) {}

  private extractMeta(req: Request) {
    return {
      ipAddress:
        (req.headers['x-forwarded-for'] as string) ||
        req.socket?.remoteAddress ||
        '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'KS-MFG Banking Subsystem Client',
    };
  }

  // ==========================================================================
  // Summary & Overview
  // ==========================================================================
  @Get('summary')
  @RequirePermission('BANKING_ACCOUNTS', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.bankingService.getSummary(user);
  }

  @Get('lookups')
  @RequirePermission('BANKING_ACCOUNTS', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    return this.bankingService.getLookups(user);
  }

  // ==========================================================================
  // Bank Accounts Master
  // ==========================================================================
  @Get('bank-accounts')
  @RequirePermission('BANKING_ACCOUNTS', 'VIEW')
  async getBankAccounts(@CurrentUser() user: AuthenticatedUserContext) {
    return this.bankingService.getBankAccounts(user);
  }

  @Post('bank-accounts')
  @RequirePermission('BANKING_ACCOUNTS', 'ADD')
  async createBankAccount(
    @Body() dto: CreateBankAccountDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    const meta = this.extractMeta(req);
    return this.bankingService.createBankAccount({ ...dto }, { ...user, ...meta });
  }

  // ==========================================================================
  // AP Vendor Payment Disbursements
  // ==========================================================================
  @Get('disbursements')
  @RequirePermission('BANKING_ACCOUNTS', 'VIEW')
  async getDisbursements(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query('bankAccountId') bankAccountId?: string,
    @Query('partyId') partyId?: string,
  ) {
    return this.bankingService.getDisbursements(user, {
      bankAccountId: bankAccountId ? parseInt(bankAccountId, 10) : undefined,
      partyId: partyId ? parseInt(partyId, 10) : undefined,
    });
  }

  @Get('disbursements/:id')
  @RequirePermission('BANKING_ACCOUNTS', 'VIEW')
  async getDisbursementById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.bankingService.getDisbursementById(id, user);
  }

  @Get('pending-purchase-invoices')
  @RequirePermission('BANKING_ACCOUNTS', 'VIEW')
  async getPendingPurchaseInvoices(
    @Query('partyId', ParseIntPipe) partyId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.bankingService.getPendingPurchaseInvoices(partyId, user);
  }

  @Post('disbursements')
  @RequirePermission('BANKING_ACCOUNTS', 'DISBURSE')
  async createDisbursement(
    @Body() dto: CreatePaymentDisbursementDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    const meta = this.extractMeta(req);
    return this.bankingService.createDisbursement(dto, { ...user, ...meta });
  }

  // ==========================================================================
  // AR Customer Payment Collections
  // ==========================================================================
  @Get('receipts')
  @RequirePermission('BANKING_ACCOUNTS', 'VIEW')
  async getReceipts(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query('bankAccountId') bankAccountId?: string,
    @Query('partyId') partyId?: string,
  ) {
    return this.bankingService.getReceipts(user, {
      bankAccountId: bankAccountId ? parseInt(bankAccountId, 10) : undefined,
      partyId: partyId ? parseInt(partyId, 10) : undefined,
    });
  }

  @Get('receipts/:id')
  @RequirePermission('BANKING_ACCOUNTS', 'VIEW')
  async getReceiptById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.bankingService.getReceiptById(id, user);
  }

  @Get('pending-sales-invoices')
  @RequirePermission('BANKING_ACCOUNTS', 'VIEW')
  async getPendingSalesInvoices(
    @Query('partyId', ParseIntPipe) partyId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.bankingService.getPendingSalesInvoices(partyId, user);
  }

  @Post('receipts')
  @RequirePermission('BANKING_ACCOUNTS', 'RECEIVE')
  async createReceipt(
    @Body() dto: CreateCustomerReceiptDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    const meta = this.extractMeta(req);
    return this.bankingService.createReceipt(dto, { ...user, ...meta });
  }

  // ==========================================================================
  // Bank Reconciliation (BRS) Endpoints
  // ==========================================================================
  @Get('brs/statement-lines')
  @RequirePermission('BANKING_ACCOUNTS', 'VIEW')
  async getStatementLines(
    @Query('bankAccountId', ParseIntPipe) bankAccountId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.bankingService.getStatementLines(bankAccountId, user);
  }

  @Post('brs/import-feed')
  @RequirePermission('BANKING_ACCOUNTS', 'ADD')
  async importStatementLine(
    @Body() dto: ImportBankStatementLineDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    const meta = this.extractMeta(req);
    return this.bankingService.importStatementLine(dto, { ...user, ...meta });
  }

  @Get('brs/reconciliation-summary')
  @RequirePermission('BANKING_ACCOUNTS', 'VIEW')
  async getReconciliationSummary(
    @Query('bankAccountId', ParseIntPipe) bankAccountId: number,
    @Query('cutoffDate') cutoffDate: string,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    const effectiveDate = cutoffDate || new Date().toISOString().slice(0, 10);
    return this.bankingService.getReconciliationSummary(bankAccountId, effectiveDate, user);
  }

  @Post('brs/auto-match')
  @RequirePermission('BANKING_ACCOUNTS', 'RECONCILE')
  async autoMatch(
    @Body('bankAccountId', ParseIntPipe) bankAccountId: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    const meta = this.extractMeta(req);
    return this.bankingService.autoMatch(bankAccountId, { ...user, ...meta });
  }

  @Post('brs/finalize')
  @RequirePermission('BANKING_ACCOUNTS', 'RECONCILE')
  async finalizeBrs(
    @Body() dto: FinalizeBrsDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    const meta = this.extractMeta(req);
    return this.bankingService.finalizeBrs(dto, { ...user, ...meta });
  }
}
