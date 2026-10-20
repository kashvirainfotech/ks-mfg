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
import { InProcessQcService } from './in-process-qc.service';
import type {
  ApproveInProcessQcDto,
  CreateInProcessQcDto,
  GrantDeviationDto,
  InspectionStage,
  InspectionStatus,
  OverallResult,
  UpdateInProcessQcDto,
} from './in-process-qc.dto';

@Controller('quality/in-process-qc')
export class InProcessQcController {
  constructor(private readonly inProcessQcService: InProcessQcService) {}

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
  @RequirePermission('IN_PROCESS_QC', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.inProcessQcService.getSummary(user);
  }

  @Get('lookups')
  @RequirePermission('IN_PROCESS_QC', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    return this.inProcessQcService.getLookups(user);
  }

  @Get(':id')
  @RequirePermission('IN_PROCESS_QC', 'VIEW')
  async findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.inProcessQcService.findById(id, user);
  }

  @Get()
  @RequirePermission('IN_PROCESS_QC', 'VIEW')
  async findAll(
    @Query('status') status?: string,
    @Query('overallResult') overallResult?: string,
    @Query('inspectionStage') inspectionStage?: string,
    @Query('woId') woId?: string,
    @Query('jobCardId') jobCardId?: string,
    @Query('itemId') itemId?: string,
    @Query('workCenterId') workCenterId?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    return this.inProcessQcService.findAll(
      {
        status: status as InspectionStatus,
        overallResult: overallResult as OverallResult,
        inspectionStage: inspectionStage as InspectionStage,
        woId: woId ? Number(woId) : undefined,
        jobCardId: jobCardId ? Number(jobCardId) : undefined,
        itemId: itemId ? Number(itemId) : undefined,
        workCenterId: workCenterId ? Number(workCenterId) : undefined,
        search,
        startDate,
        endDate,
      },
      user!,
    );
  }

  @Post()
  @RequirePermission('IN_PROCESS_QC', 'ADD')
  async create(
    @Body() dto: CreateInProcessQcDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.inProcessQcService.create(dto, user, this.extractMeta(req));
  }

  @Put(':id')
  @RequirePermission('IN_PROCESS_QC', 'EDIT')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInProcessQcDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.inProcessQcService.update(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/approve')
  @RequirePermission('IN_PROCESS_QC', 'APPROVE')
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveInProcessQcDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.inProcessQcService.approve(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/deviation')
  @RequirePermission('IN_PROCESS_QC', 'DEVIATION')
  async grantDeviation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GrantDeviationDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.inProcessQcService.grantDeviation(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Delete(':id')
  @RequirePermission('IN_PROCESS_QC', 'DELETE')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.inProcessQcService.delete(id, user, this.extractMeta(req));
  }
}
