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
  CancelInvoiceDto,
  CreateInvoiceDto,
  GenerateIrnDto,
  InvoiceFilterParams,
  PostInvoiceDto,
  RecordPaymentDto,
  UpdateInvoiceDto,
} from './invoice.dto';

@Controller('sales/invoices')
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
  @RequirePermission('SALES_INVOICE', 'VIEW')
  async getInvoiceSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.invoiceService.getInvoiceSummary(user);
  }

  @Get('pending-dispatches')
  @RequirePermission('SALES_INVOICE', 'VIEW')
  async getPendingDispatches(@CurrentUser() user: AuthenticatedUserContext) {
    return this.invoiceService.getPendingDispatches(user);
  }

  @Get('challan-details/:challanId')
  @RequirePermission('SALES_INVOICE', 'VIEW')
  async getChallanDetails(
    @Param('challanId', ParseIntPipe) challanId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.invoiceService.getChallanDetails(challanId, user);
  }

  @Get('so-details/:soId')
  @RequirePermission('SALES_INVOICE', 'VIEW')
  async getSoDetails(
    @Param('soId', ParseIntPipe) soId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.invoiceService.getSoDetails(soId, user);
  }

  @Get()
  @RequirePermission('SALES_INVOICE', 'VIEW')
  async findAllInvoices(
    @Query() filters: InvoiceFilterParams,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.invoiceService.findAllInvoices(filters, user);
  }

  @Get(':id')
  @RequirePermission('SALES_INVOICE', 'VIEW')
  async findOneInvoice(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.invoiceService.findOneInvoice(id, user);
  }

  @Post()
  @RequirePermission('SALES_INVOICE', 'ADD')
  async createInvoice(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.invoiceService.createInvoice(dto, user, this.extractMeta(req));
  }

  @Put(':id')
  @RequirePermission('SALES_INVOICE', 'EDIT')
  async updateInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInvoiceDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.invoiceService.updateInvoice(id, dto, user, this.extractMeta(req));
  }

  @Delete(':id')
  @RequirePermission('SALES_INVOICE', 'DELETE')
  async deleteInvoice(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.invoiceService.deleteInvoice(id, user, this.extractMeta(req));
  }

  @Post(':id/post')
  @RequirePermission('SALES_INVOICE', 'POST')
  async postInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PostInvoiceDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.invoiceService.postInvoice(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/generate-irn')
  @RequirePermission('SALES_INVOICE', 'GENERATE_IRN')
  async generateIrn(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GenerateIrnDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.invoiceService.generateIrn(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/record-payment')
  @RequirePermission('SALES_INVOICE', 'RECORD_PAYMENT')
  async recordPayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.invoiceService.recordPayment(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/cancel')
  @RequirePermission('SALES_INVOICE', 'CANCEL')
  async cancelInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelInvoiceDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.invoiceService.cancelInvoice(id, dto, user, this.extractMeta(req));
  }
}
