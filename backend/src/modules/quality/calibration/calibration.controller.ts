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
import { CalibrationService } from './calibration.service';
import type {
  CreateGaugeDto,
  LockoutGaugeDto,
  LogCalibrationEventDto,
  UpdateGaugeDto,
} from './calibration.dto';

@Controller('quality/calibration')
export class CalibrationController {
  constructor(private readonly calibrationService: CalibrationService) {}

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
  @RequirePermission('CALIBRATION_QC', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.calibrationService.getSummary(user);
  }

  @Get('lookups')
  @RequirePermission('CALIBRATION_QC', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    return this.calibrationService.getLookups(user);
  }

  @Get(':id')
  @RequirePermission('CALIBRATION_QC', 'VIEW')
  async findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.calibrationService.findById(id, user);
  }

  @Get()
  @RequirePermission('CALIBRATION_QC', 'VIEW')
  async findAll(
    @Query('status') status?: string,
    @Query('gaugeType') gaugeType?: string,
    @Query('agencyType') agencyType?: string,
    @Query('isOverdueOnly') isOverdueOnly?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    return this.calibrationService.findAll(
      {
        status,
        gaugeType,
        agencyType,
        isOverdueOnly: isOverdueOnly === 'true',
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      },
      user!,
    );
  }

  @Post()
  @RequirePermission('CALIBRATION_QC', 'ADD')
  async create(
    @Body() dto: CreateGaugeDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.calibrationService.create(dto, user, this.extractMeta(req));
  }

  @Put(':id')
  @RequirePermission('CALIBRATION_QC', 'EDIT')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGaugeDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.calibrationService.update(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/events')
  @RequirePermission('CALIBRATION_QC', 'CALIBRATE')
  async logEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LogCalibrationEventDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.calibrationService.logEvent(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/lockout')
  @RequirePermission('CALIBRATION_QC', 'LOCKOUT')
  async lockout(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LockoutGaugeDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.calibrationService.lockout(id, dto, user, this.extractMeta(req));
  }

  @Delete(':id')
  @RequirePermission('CALIBRATION_QC', 'DELETE')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.calibrationService.delete(id, user, this.extractMeta(req));
  }
}
