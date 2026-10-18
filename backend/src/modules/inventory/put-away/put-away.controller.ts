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
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import {
  CurrentUser,
  RequirePermission,
} from '../../../common/decorators/auth.decorators';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import { PutAwayService } from './put-away.service';
import {
  AssignPutAwayDto,
  CancelPutAwayDto,
  ConfirmPutAwayDto,
  CreatePutAwayDto,
  PutAwayFilterDto,
  UpdatePutAwayDto,
} from './put-away.dto';
import { AuditLogService } from '../../../common/services/audit-log.service';

@Controller('inventory/put-away')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PutAwayController {
  constructor(
    private readonly putAwayService: PutAwayService,
    private readonly auditLogService: AuditLogService,
  ) {}

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
  @RequirePermission('BIN_PUTAWAY', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.putAwayService.getSummary(user);
  }

  @Get('pending-qc')
  @RequirePermission('BIN_PUTAWAY', 'VIEW')
  async getPendingQc(@CurrentUser() user: AuthenticatedUserContext) {
    return this.putAwayService.getPendingQcInspections(user);
  }

  @Get('qc-items/:qcId')
  @RequirePermission('BIN_PUTAWAY', 'VIEW')
  async getQcItems(
    @Param('qcId', ParseIntPipe) qcId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.putAwayService.getQcItems(qcId, user);
  }

  @Get('storage-bins/:warehouseId')
  @RequirePermission('BIN_PUTAWAY', 'VIEW')
  async getStorageBins(
    @Param('warehouseId', ParseIntPipe) warehouseId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.putAwayService.getStorageBins(warehouseId, user);
  }

  @Get('operators')
  @RequirePermission('BIN_PUTAWAY', 'VIEW')
  async getOperators(@CurrentUser() user: AuthenticatedUserContext) {
    return this.putAwayService.getOperators(user);
  }

  @Get()
  @RequirePermission('BIN_PUTAWAY', 'VIEW')
  async findAll(
    @Query() filters: PutAwayFilterDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.putAwayService.findAll(user, filters);
  }

  @Get(':id')
  @RequirePermission('BIN_PUTAWAY', 'VIEW')
  async findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.putAwayService.findById(id, user);
  }

  @Post()
  @RequirePermission('BIN_PUTAWAY', 'ADD')
  async create(
    @Body() dto: CreatePutAwayDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.putAwayService.create(dto, user, this.extractMeta(req));
  }

  @Put(':id')
  @RequirePermission('BIN_PUTAWAY', 'EDIT')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePutAwayDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.putAwayService.update(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/assign')
  @RequirePermission('BIN_PUTAWAY', 'ASSIGN')
  async assignOperator(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPutAwayDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.putAwayService.assignOperator(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/start')
  @RequirePermission('BIN_PUTAWAY', 'EDIT')
  async startPutAway(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.putAwayService.startPutAway(id, user, this.extractMeta(req));
  }

  @Post(':id/confirm')
  @RequirePermission('BIN_PUTAWAY', 'CONFIRM')
  async confirmPutAway(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmPutAwayDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.putAwayService.confirmPutAway(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/cancel')
  @RequirePermission('BIN_PUTAWAY', 'CANCEL')
  async cancelPutAway(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelPutAwayDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.putAwayService.cancelPutAway(id, dto, user, this.extractMeta(req));
  }

  @Delete(':id')
  @RequirePermission('BIN_PUTAWAY', 'DELETE')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.putAwayService.delete(id, user, this.extractMeta(req));
  }

  @Post('actions/log')
  @RequirePermission('BIN_PUTAWAY', 'VIEW')
  async logAction(
    @Body() body: { actionType: 'PRINT' | 'EXPORT'; recordId?: number; details?: any },
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'BIN_PUTAWAY',
      actionType: body.actionType,
      entityTable: 'tbl_inv_putaway_header',
      recordId: body.recordId || 0,
      newValue: body.details || null,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...this.extractMeta(req),
    });
    return { success: true };
  }
}
