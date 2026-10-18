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
import { GateInwardService } from './gate-inward.service';
import type {
  CancelGateInwardDto,
  CreateGateInwardDto,
  ExitGateInwardDto,
  GateInwardStatus,
  UnloadGateInwardDto,
  UpdateGateInwardDto,
} from './gate-inward.dto';

@Controller('procurement/gate-inward')
export class GateInwardController {
  constructor(private readonly gateInwardService: GateInwardService) {}

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
  @RequirePermission('GATE_INWARD', 'VIEW')
  async getGateInwardSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.gateInwardService.getGateInwardSummary(user);
  }

  @Get(':id')
  @RequirePermission('GATE_INWARD', 'VIEW')
  async findGateInwardById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.gateInwardService.findGateInwardById(id, user);
  }

  @Get()
  @RequirePermission('GATE_INWARD', 'VIEW')
  async findAllGateInwards(
    @Query('status') status?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('poId') poId?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    return this.gateInwardService.findAllGateInwards(
      {
        status: status as GateInwardStatus,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        vendorId: vendorId ? Number(vendorId) : undefined,
        poId: poId ? Number(poId) : undefined,
        search,
        startDate,
        endDate,
      },
      user!,
    );
  }

  @Post()
  @RequirePermission('GATE_INWARD', 'ADD')
  async createGateInward(
    @Body() dto: CreateGateInwardDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.gateInwardService.createGateInward(
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Put(':id')
  @RequirePermission('GATE_INWARD', 'EDIT')
  async updateGateInward(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGateInwardDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.gateInwardService.updateGateInward(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Post(':id/unload')
  @RequirePermission('GATE_INWARD', 'UNLOAD')
  async markUnloaded(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UnloadGateInwardDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.gateInwardService.markUnloaded(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Post(':id/exit')
  @RequirePermission('GATE_INWARD', 'EXIT')
  async recordVehicleExit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExitGateInwardDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.gateInwardService.recordVehicleExit(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Post(':id/cancel')
  @RequirePermission('GATE_INWARD', 'CANCEL')
  async cancelGateInward(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelGateInwardDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.gateInwardService.cancelGateInward(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Delete(':id')
  @RequirePermission('GATE_INWARD', 'DELETE')
  async deleteGateInward(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.gateInwardService.deleteGateInward(
      id,
      user,
      this.extractMeta(req),
    );
  }

  @Post('actions/log')
  @RequirePermission('GATE_INWARD', 'VIEW')
  async logScreenAction(
    @Body('actionType') actionType: 'PRINT' | 'EXPORT',
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.gateInwardService.recordScreenAction(
      actionType,
      user,
      this.extractMeta(req),
    );
  }
}
