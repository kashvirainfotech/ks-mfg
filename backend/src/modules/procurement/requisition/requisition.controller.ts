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
import { RequisitionService } from './requisition.service';
import type {
  AuthorizeRequisitionDto,
  CreateRequisitionDto,
  PrPriority,
  PrStatus,
  PrType,
  UpdateRequisitionDto,
} from './requisition.dto';

@Controller('procurement/requisitions')
export class RequisitionController {
  constructor(private readonly requisitionService: RequisitionService) {}

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
  @RequirePermission('PURCHASE_REQ', 'VIEW')
  async getRequisitionSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.requisitionService.getRequisitionSummary(user);
  }

  @Get()
  @RequirePermission('PURCHASE_REQ', 'VIEW')
  async findAllRequisitions(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('prType') prType?: string,
    @Query('departmentId') departmentId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    return this.requisitionService.findAllRequisitions(
      {
        status: status as PrStatus,
        priority: priority as PrPriority,
        prType: prType as PrType,
        departmentId: departmentId ? Number(departmentId) : undefined,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        search,
      },
      user!,
    );
  }

  @Get(':prId')
  @RequirePermission('PURCHASE_REQ', 'VIEW')
  async findRequisitionById(
    @Param('prId', ParseIntPipe) prId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.requisitionService.findRequisitionById(prId, user);
  }

  @Post()
  @RequirePermission('PURCHASE_REQ', 'ADD')
  async createRequisition(
    @Body() dto: CreateRequisitionDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.requisitionService.createRequisition(
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Put(':prId')
  @RequirePermission('PURCHASE_REQ', 'EDIT')
  async updateRequisition(
    @Param('prId', ParseIntPipe) prId: number,
    @Body() dto: UpdateRequisitionDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.requisitionService.updateRequisition(
      prId,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Post(':prId/submit')
  @RequirePermission('PURCHASE_REQ', 'SUBMIT')
  async submitRequisition(
    @Param('prId', ParseIntPipe) prId: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.requisitionService.submitRequisition(
      prId,
      user,
      this.extractMeta(req),
    );
  }

  @Post(':prId/authorize')
  @RequirePermission('PURCHASE_REQ', 'AUTHORIZE')
  async authorizeRequisition(
    @Param('prId', ParseIntPipe) prId: number,
    @Body() dto: AuthorizeRequisitionDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.requisitionService.authorizeRequisition(
      prId,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Delete(':prId')
  @RequirePermission('PURCHASE_REQ', 'DELETE')
  async deleteRequisition(
    @Param('prId', ParseIntPipe) prId: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.requisitionService.deleteRequisition(
      prId,
      user,
      this.extractMeta(req),
    );
  }

  @Post('actions/log')
  @RequirePermission('PURCHASE_REQ', 'VIEW')
  async logScreenAction(
    @Body('actionType') actionType: 'PRINT' | 'EXPORT',
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.requisitionService.recordScreenAction(
      actionType,
      user,
      this.extractMeta(req),
    );
  }
}
