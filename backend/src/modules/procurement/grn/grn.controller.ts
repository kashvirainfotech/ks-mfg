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
import { GrnService } from './grn.service';
import type {
  ApproveGrnDto,
  CancelGrnDto,
  CreateGrnDto,
  GrnStatus,
  QuarantinePutAwayDto,
  UpdateGrnDto,
} from './grn.dto';

@Controller('procurement/grn')
export class GrnController {
  constructor(private readonly grnService: GrnService) {}

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
  @RequirePermission('PURCHASE_GRN', 'VIEW')
  async getGrnSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.grnService.getGrnSummary(user);
  }

  @Get('pending-gate-inwards')
  @RequirePermission('PURCHASE_GRN', 'VIEW')
  async getPendingGateInwards(@CurrentUser() user: AuthenticatedUserContext) {
    return this.grnService.getPendingGateInwards(user);
  }

  @Get('approved-pos')
  @RequirePermission('PURCHASE_GRN', 'VIEW')
  async getApprovedPurchaseOrders(@CurrentUser() user: AuthenticatedUserContext) {
    return this.grnService.getApprovedPurchaseOrders(user);
  }

  @Get('po-items/:poId')
  @RequirePermission('PURCHASE_GRN', 'VIEW')
  async getPoItems(
    @Param('poId', ParseIntPipe) poId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.grnService.getPoItems(poId, user);
  }

  @Get('storage-bins')
  @RequirePermission('PURCHASE_GRN', 'VIEW')
  async getStorageBins(
    @Query('warehouseId') warehouseId?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    return this.grnService.getStorageBins(
      warehouseId ? Number(warehouseId) : undefined,
      user,
    );
  }

  @Get(':id')
  @RequirePermission('PURCHASE_GRN', 'VIEW')
  async findGrnById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.grnService.findGrnById(id, user);
  }

  @Get()
  @RequirePermission('PURCHASE_GRN', 'VIEW')
  async findAllGrns(
    @Query('status') status?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('poId') poId?: string,
    @Query('gateInwardId') gateInwardId?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    return this.grnService.findAllGrns(
      {
        status: status as GrnStatus,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        vendorId: vendorId ? Number(vendorId) : undefined,
        poId: poId ? Number(poId) : undefined,
        gateInwardId: gateInwardId ? Number(gateInwardId) : undefined,
        search,
        startDate,
        endDate,
      },
      user!,
    );
  }

  @Post()
  @RequirePermission('PURCHASE_GRN', 'ADD')
  async createGrn(
    @Body() dto: CreateGrnDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.grnService.createGrn(dto, user, this.extractMeta(req));
  }

  @Put(':id')
  @RequirePermission('PURCHASE_GRN', 'EDIT')
  async updateGrn(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGrnDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.grnService.updateGrn(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/submit')
  @RequirePermission('PURCHASE_GRN', 'SUBMIT')
  async submitGrn(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.grnService.submitGrn(id, user, this.extractMeta(req));
  }

  @Post(':id/put-away')
  @RequirePermission('PURCHASE_GRN', 'EDIT')
  async putAwayQuarantine(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: QuarantinePutAwayDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.grnService.putAwayQuarantine(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Post(':id/approve')
  @RequirePermission('PURCHASE_GRN', 'APPROVE')
  async approveGrn(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveGrnDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.grnService.approveGrn(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/cancel')
  @RequirePermission('PURCHASE_GRN', 'CANCEL')
  async cancelGrn(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelGrnDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.grnService.cancelGrn(id, dto, user, this.extractMeta(req));
  }

  @Delete(':id')
  @RequirePermission('PURCHASE_GRN', 'DELETE')
  async deleteGrn(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.grnService.deleteGrn(id, user, this.extractMeta(req));
  }
}
