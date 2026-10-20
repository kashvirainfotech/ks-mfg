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
import { PdiService } from './pdi.service';
import type {
  ApprovePdiDto,
  CreatePdiDto,
  PdiOverallVerdict,
  PdiStatus,
  ReleaseCoaDto,
  UpdatePdiDto,
} from './pdi.dto';

@Controller('quality/pdi')
export class PdiController {
  constructor(private readonly pdiService: PdiService) {}

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
  @RequirePermission('PDI_QC', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.pdiService.getSummary(user);
  }

  @Get('lookups')
  @RequirePermission('PDI_QC', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    return this.pdiService.getLookups(user);
  }

  @Get(':id')
  @RequirePermission('PDI_QC', 'VIEW')
  async findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.pdiService.findById(id, user);
  }

  @Get()
  @RequirePermission('PDI_QC', 'VIEW')
  async findAll(
    @Query('status') status?: string,
    @Query('overallVerdict') overallVerdict?: string,
    @Query('customerId') customerId?: string,
    @Query('itemId') itemId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    return this.pdiService.findAll(
      {
        status: status as PdiStatus,
        overallVerdict: overallVerdict as PdiOverallVerdict,
        customerId: customerId ? Number(customerId) : undefined,
        itemId: itemId ? Number(itemId) : undefined,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        search,
        startDate,
        endDate,
      },
      user!,
    );
  }

  @Post()
  @RequirePermission('PDI_QC', 'ADD')
  async create(
    @Body() dto: CreatePdiDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.pdiService.create(dto, user, this.extractMeta(req));
  }

  @Put(':id')
  @RequirePermission('PDI_QC', 'EDIT')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePdiDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.pdiService.update(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/approve')
  @RequirePermission('PDI_QC', 'APPROVE')
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApprovePdiDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.pdiService.approve(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/release-coa')
  @RequirePermission('PDI_QC', 'RELEASE')
  async releaseCoa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReleaseCoaDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.pdiService.releaseCoa(id, dto, user, this.extractMeta(req));
  }

  @Delete(':id')
  @RequirePermission('PDI_QC', 'DELETE')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.pdiService.delete(id, user, this.extractMeta(req));
  }
}
