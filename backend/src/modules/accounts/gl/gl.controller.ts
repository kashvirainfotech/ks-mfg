import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CurrentUser,
  RequirePermission,
} from '../../../common/decorators/auth.decorators';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import { GlService } from './gl.service';
import {
  CreateChartOfAccountDto,
  CreateJournalVoucherDto,
  GenerateOperationalJvDto,
  ReverseJournalVoucherDto,
  UpdateChartOfAccountDto,
} from './gl.dto';

@Controller('accounts/gl')
export class GlController {
  constructor(private readonly glService: GlService) {}

  private extractMeta(req: Request) {
    return {
      ipAddress:
        (req.headers['x-forwarded-for'] as string) ||
        req.socket?.remoteAddress ||
        '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'unknown',
      correlationId: (req.headers['x-correlation-id'] as string) || undefined,
    };
  }

  @Get('summary')
  @RequirePermission('GL_ACCOUNTS', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.glService.getSummary(user);
  }

  @Get('lookups')
  @RequirePermission('GL_ACCOUNTS', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    return this.glService.getLookups(user);
  }

  // --- Chart of Accounts Endpoints ---
  @Get('coa')
  @RequirePermission('GL_ACCOUNTS', 'VIEW')
  async getChartOfAccounts(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query('accountType') accountType?: string,
    @Query('search') search?: string,
  ) {
    return this.glService.getChartOfAccounts(user, { accountType, search });
  }

  @Post('coa')
  @RequirePermission('GL_ACCOUNTS', 'ADD')
  async createChartOfAccount(
    @Body() dto: CreateChartOfAccountDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.glService.createChartOfAccount(dto, user, this.extractMeta(req));
  }

  @Put('coa/:id')
  @RequirePermission('GL_ACCOUNTS', 'EDIT')
  async updateChartOfAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChartOfAccountDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.glService.updateChartOfAccount(id, dto, user, this.extractMeta(req));
  }

  // --- Financial Statements & Ledger Reports ---
  @Get('statement')
  @RequirePermission('GL_ACCOUNTS', 'VIEW')
  async getAccountStatement(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query('accountId', ParseIntPipe) accountId: number,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('costCenterId') costCenterId?: string,
  ) {
    return this.glService.getAccountStatement(user, {
      accountId,
      fromDate,
      toDate,
      costCenterId: costCenterId ? Number(costCenterId) : undefined,
    });
  }

  @Get('trial-balance')
  @RequirePermission('GL_ACCOUNTS', 'VIEW')
  async getTrialBalance(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query('asOfDate') asOfDate?: string,
  ) {
    return this.glService.getTrialBalance(user, asOfDate);
  }

  @Get('financial-statements')
  @RequirePermission('GL_ACCOUNTS', 'VIEW')
  async getFinancialStatements(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query('asOfDate') asOfDate?: string,
  ) {
    return this.glService.getFinancialStatements(user, asOfDate);
  }

  // --- Journal Vouchers ---
  @Get('vouchers')
  @RequirePermission('GL_ACCOUNTS', 'VIEW')
  async getVouchers(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query('search') search?: string,
    @Query('voucherType') voucherType?: string,
    @Query('status') status?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.glService.getVouchers(user, { search, voucherType, status, fromDate, toDate });
  }

  @Get('vouchers/:id')
  @RequirePermission('GL_ACCOUNTS', 'VIEW')
  async getVoucherById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.glService.getVoucherById(id, user);
  }

  @Post('vouchers')
  @RequirePermission('GL_ACCOUNTS', 'POST')
  async createVoucher(
    @Body() dto: CreateJournalVoucherDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.glService.createVoucher(dto, user, this.extractMeta(req));
  }

  @Post('vouchers/:id/reverse')
  @RequirePermission('GL_ACCOUNTS', 'REVERSE')
  async reverseVoucher(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReverseJournalVoucherDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.glService.reverseVoucher(id, dto, user, this.extractMeta(req));
  }

  // --- Operational Integration Bridge ---
  @Get('unposted-operations')
  @RequirePermission('GL_ACCOUNTS', 'VIEW')
  async getUnpostedOperations(@CurrentUser() user: AuthenticatedUserContext) {
    return this.glService.getUnpostedOperations(user);
  }

  @Post('generate-operational-jv')
  @RequirePermission('GL_ACCOUNTS', 'POST')
  async generateOperationalJv(
    @Body() dto: GenerateOperationalJvDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.glService.generateOperationalJv(dto, user, this.extractMeta(req));
  }
}
