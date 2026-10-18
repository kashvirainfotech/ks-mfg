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
import { RfqService } from './rfq.service';
import type {
  AwardRfqDto,
  CreateRfqDto,
  RecordVendorQuoteDto,
  RfqStatus,
  UpdateRfqDto,
} from './rfq.dto';

@Controller('procurement/rfqs')
export class RfqController {
  constructor(private readonly rfqService: RfqService) {}

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
  @RequirePermission('PROCUREMENT_RFQ', 'VIEW')
  async getRfqSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.rfqService.getRfqSummary(user);
  }

  @Get(':rfqId/comparative-statement')
  @RequirePermission('PROCUREMENT_RFQ', 'VIEW')
  async getComparativeStatement(
    @Param('rfqId', ParseIntPipe) rfqId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.rfqService.getComparativeStatement(rfqId, user);
  }

  @Get(':rfqId')
  @RequirePermission('PROCUREMENT_RFQ', 'VIEW')
  async findRfqById(
    @Param('rfqId', ParseIntPipe) rfqId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.rfqService.findRfqById(rfqId, user);
  }

  @Get()
  @RequirePermission('PROCUREMENT_RFQ', 'VIEW')
  async findAllRfqs(
    @Query('status') status?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    return this.rfqService.findAllRfqs(
      {
        status: status as RfqStatus,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        search,
      },
      user!,
    );
  }

  @Post()
  @RequirePermission('PROCUREMENT_RFQ', 'ADD')
  async createRfq(
    @Body() dto: CreateRfqDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.rfqService.createRfq(dto, user, this.extractMeta(req));
  }

  @Put(':rfqId')
  @RequirePermission('PROCUREMENT_RFQ', 'EDIT')
  async updateRfq(
    @Param('rfqId', ParseIntPipe) rfqId: number,
    @Body() dto: UpdateRfqDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.rfqService.updateRfq(rfqId, dto, user, this.extractMeta(req));
  }

  @Post(':rfqId/send')
  @RequirePermission('PROCUREMENT_RFQ', 'SEND')
  async sendRfq(
    @Param('rfqId', ParseIntPipe) rfqId: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.rfqService.sendRfq(rfqId, user, this.extractMeta(req));
  }

  @Post(':rfqId/vendors/:vendorPartyId/quote')
  @RequirePermission('PROCUREMENT_RFQ', 'EDIT')
  async recordVendorQuote(
    @Param('rfqId', ParseIntPipe) rfqId: number,
    @Param('vendorPartyId', ParseIntPipe) vendorPartyId: number,
    @Body() dto: RecordVendorQuoteDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.rfqService.recordVendorQuote(
      rfqId,
      vendorPartyId,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Post(':rfqId/award')
  @RequirePermission('PROCUREMENT_RFQ', 'FINALIZE')
  async awardRfq(
    @Param('rfqId', ParseIntPipe) rfqId: number,
    @Body() dto: AwardRfqDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.rfqService.awardRfq(rfqId, dto, user, this.extractMeta(req));
  }

  @Delete(':rfqId')
  @RequirePermission('PROCUREMENT_RFQ', 'DELETE')
  async deleteRfq(
    @Param('rfqId', ParseIntPipe) rfqId: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.rfqService.deleteRfq(rfqId, user, this.extractMeta(req));
  }

  @Post('actions/log')
  @RequirePermission('PROCUREMENT_RFQ', 'VIEW')
  async logScreenAction(
    @Body('actionType') actionType: 'PRINT' | 'EXPORT',
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.rfqService.recordScreenAction(
      actionType,
      user,
      this.extractMeta(req),
    );
  }
}
