import {
  Body,
  Controller,
  Delete,
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
import { InvoiceService } from './invoice.service';
import type {
  ApproveInvoiceDto,
  CancelInvoiceDto,
  CreateInvoiceDto,
  InvoiceFilterParams,
  RecordPaymentDto,
  SubmitInvoiceDto,
  UpdateInvoiceDto,
} from './invoice.dto';

@Controller('procurement/invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

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
  @RequirePermission('PURCHASE_INVOICE', 'VIEW')
  async getInvoiceSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.invoiceService.getInvoiceSummary(user);
  }

  @Get('pending-grns')
  @RequirePermission('PURCHASE_INVOICE', 'VIEW')
  async getPendingGrns(@CurrentUser() user: AuthenticatedUserContext) {
    return this.invoiceService.getPendingGrns(user);
  }

  @Get('grn-details/:grnId')
  @RequirePermission('PURCHASE_INVOICE', 'VIEW')
  async getGrnDetails(
    @Param('grnId', ParseIntPipe) grnId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.invoiceService.getGrnDetails(grnId, user);
  }

  @Get('approved-pos')
  @RequirePermission('PURCHASE_INVOICE', 'VIEW')
  async getApprovedPurchaseOrders(
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.invoiceService.getApprovedPurchaseOrders(user);
  }

  @Get('po-details/:poId')
  @RequirePermission('PURCHASE_INVOICE', 'VIEW')
  async getPoDetails(
    @Param('poId', ParseIntPipe) poId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.invoiceService.getPoDetails(poId, user);
  }

  @Get('vendors')
  @RequirePermission('PURCHASE_INVOICE', 'VIEW')
  async getVendors(@CurrentUser() user: AuthenticatedUserContext) {
    return this.invoiceService.getVendors(user);
  }

  @Get()
  @RequirePermission('PURCHASE_INVOICE', 'VIEW')
  async findAllInvoices(
    @Query() filters: InvoiceFilterParams,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.invoiceService.findAllInvoices(filters, user);
  }

  @Get(':id')
  @RequirePermission('PURCHASE_INVOICE', 'VIEW')
  async findOneInvoice(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.invoiceService.findOneInvoice(id, user);
  }

  @Post()
  @RequirePermission('PURCHASE_INVOICE', 'ADD')
  async createInvoice(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.invoiceService.createInvoice(dto, user, this.extractMeta(req));
  }

  @Put(':id')
  @RequirePermission('PURCHASE_INVOICE', 'EDIT')
  async updateInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInvoiceDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.invoiceService.updateInvoice(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/submit')
  @RequirePermission('PURCHASE_INVOICE', 'SUBMIT')
  async submitInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitInvoiceDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.invoiceService.submitInvoice(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/approve')
  @RequirePermission('PURCHASE_INVOICE', 'APPROVE')
  async approveInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveInvoiceDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.invoiceService.approveInvoice(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/cancel')
  @RequirePermission('PURCHASE_INVOICE', 'CANCEL')
  async cancelInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelInvoiceDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.invoiceService.cancelInvoice(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/record-payment')
  @RequirePermission('PURCHASE_INVOICE', 'APPROVE')
  async recordPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.invoiceService.recordPayment(id, dto, user, this.extractMeta(req));
  }

  @Delete(':id')
  @RequirePermission('PURCHASE_INVOICE', 'DELETE')
  async deleteInvoice(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.invoiceService.deleteInvoice(id, user, this.extractMeta(req));
  }
}
