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
import { InwardQcService } from './inward-qc.service';
import type {
  ApproveQcInspectionDto,
  CancelQcInspectionDto,
  CreateQcInspectionDto,
  QcInspectionStatus,
  QcOverallResult,
  RejectQcInspectionDto,
  UpdateQcInspectionDto,
} from './inward-qc.dto';

@Controller('quality/inward-qc')
export class InwardQcController {
  constructor(private readonly inwardQcService: InwardQcService) {}

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
  @RequirePermission('INWARD_QC', 'VIEW')
  async getQcSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.inwardQcService.getQcSummary(user);
  }

  @Get('pending-grns')
  @RequirePermission('INWARD_QC', 'VIEW')
  async getPendingGrns(@CurrentUser() user: AuthenticatedUserContext) {
    return this.inwardQcService.getPendingGrns(user);
  }

  @Get('grn-items/:grnId')
  @RequirePermission('INWARD_QC', 'VIEW')
  async getGrnItems(
    @Param('grnId', ParseIntPipe) grnId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.inwardQcService.getGrnItems(grnId, user);
  }

  @Get('storage-bins')
  @RequirePermission('INWARD_QC', 'VIEW')
  async getStorageBins(
    @Query('warehouseId') warehouseId?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    return this.inwardQcService.getStorageBins(
      warehouseId ? Number(warehouseId) : undefined,
      user,
    );
  }

  @Get(':id')
  @RequirePermission('INWARD_QC', 'VIEW')
  async findInspectionById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.inwardQcService.findInspectionById(id, user);
  }

  @Get()
  @RequirePermission('INWARD_QC', 'VIEW')
  async findAllInspections(
    @Query('status') status?: string,
    @Query('overallResult') overallResult?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('vendorId') vendorId?: string,
    @Query('grnId') grnId?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    return this.inwardQcService.findAllInspections(
      {
        status: status as QcInspectionStatus,
        overallResult: overallResult as QcOverallResult,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        vendorId: vendorId ? Number(vendorId) : undefined,
        grnId: grnId ? Number(grnId) : undefined,
        search,
        startDate,
        endDate,
      },
      user!,
    );
  }

  @Post()
  @RequirePermission('INWARD_QC', 'ADD')
  async createInspection(
    @Body() dto: CreateQcInspectionDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.inwardQcService.createInspection(
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Put(':id')
  @RequirePermission('INWARD_QC', 'EDIT')
  async updateInspection(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQcInspectionDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.inwardQcService.updateInspection(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Post(':id/submit')
  @RequirePermission('INWARD_QC', 'SUBMIT')
  async submitInspection(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.inwardQcService.submitInspection(
      id,
      user,
      this.extractMeta(req),
    );
  }

  @Post(':id/approve')
  @RequirePermission('INWARD_QC', 'APPROVE')
  async approveInspection(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveQcInspectionDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.inwardQcService.approveInspection(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Post(':id/reject')
  @RequirePermission('INWARD_QC', 'REJECT')
  async rejectInspection(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectQcInspectionDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.inwardQcService.rejectInspection(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Post(':id/cancel')
  @RequirePermission('INWARD_QC', 'CANCEL')
  async cancelInspection(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelQcInspectionDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.inwardQcService.cancelInspection(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Delete(':id')
  @RequirePermission('INWARD_QC', 'DELETE')
  async deleteInspection(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.inwardQcService.deleteInspection(
      id,
      user,
      this.extractMeta(req),
    );
  }
}
