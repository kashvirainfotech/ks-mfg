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
import { WorkCenterService } from './work-center.service';
import type {
  CreateShiftDto,
  CreateWorkCenterDto,
  UpdateMachineStatusDto,
  UpdateWorkCenterDto,
  WorkCenterFilterParams,
  WorkCenterStatus,
  WorkCenterType,
} from './work-center.dto';

@Controller('manufacturing/work-centers')
export class WorkCenterController {
  constructor(private readonly workCenterService: WorkCenterService) {}

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

  // 1. KPI Summary
  @Get('summary')
  @RequirePermission('MFG_WORK_CENTER', 'VIEW')
  async getWorkCenterSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.workCenterService.getWorkCenterSummary(user);
  }

  // 2. Factory Shifts Lookup
  @Get('shifts')
  @RequirePermission('MFG_WORK_CENTER', 'VIEW')
  async getShifts(@CurrentUser() user: AuthenticatedUserContext) {
    return this.workCenterService.getShifts(user);
  }

  // 3. Create Factory Shift
  @Post('shifts')
  @RequirePermission('MFG_WORK_CENTER', 'ADD')
  async createShift(
    @Body() dto: CreateShiftDto,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.workCenterService.createShift(dto, user, this.extractMeta(req));
  }

  // 4. Departments Lookup
  @Get('departments')
  @RequirePermission('MFG_WORK_CENTER', 'VIEW')
  async getDepartments(@CurrentUser() user: AuthenticatedUserContext) {
    return this.workCenterService.getDepartments(user);
  }

  // 5. Get Single Work Center Detail (with machines and shifts)
  @Get(':id')
  @RequirePermission('MFG_WORK_CENTER', 'VIEW')
  async findOneWorkCenter(
    @Param('id', ParseIntPipe) workCenterId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.workCenterService.findOneWorkCenter(workCenterId, user);
  }

  // 6. Find All Work Centers
  @Get()
  @RequirePermission('MFG_WORK_CENTER', 'VIEW')
  async findAllWorkCenters(
    @Query('status') status?: string,
    @Query('workCenterType') workCenterType?: string,
    @Query('deptId') deptId?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    const filters: WorkCenterFilterParams = {
      status: status as WorkCenterStatus | undefined,
      workCenterType: workCenterType as WorkCenterType | undefined,
      deptId: deptId ? Number(deptId) : undefined,
      search,
    };
    return this.workCenterService.findAllWorkCenters(filters, user!);
  }

  // 7. Create Work Center
  @Post()
  @RequirePermission('MFG_WORK_CENTER', 'ADD')
  async createWorkCenter(
    @Body() dto: CreateWorkCenterDto,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.workCenterService.createWorkCenter(
      dto,
      user,
      this.extractMeta(req),
    );
  }

  // 8. Update Work Center
  @Put(':id')
  @RequirePermission('MFG_WORK_CENTER', 'EDIT')
  async updateWorkCenter(
    @Param('id', ParseIntPipe) workCenterId: number,
    @Body() dto: UpdateWorkCenterDto,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.workCenterService.updateWorkCenter(
      workCenterId,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  // 9. Update Machine Maintenance & Operational Status (MAINTENANCE action)
  @Post(':id/machines/:machineId/maintenance')
  @RequirePermission('MFG_WORK_CENTER', 'MAINTENANCE')
  async updateMachineStatus(
    @Param('id', ParseIntPipe) workCenterId: number,
    @Param('machineId', ParseIntPipe) machineId: number,
    @Body() dto: UpdateMachineStatusDto,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.workCenterService.updateMachineStatus(
      workCenterId,
      machineId,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  // 10. Delete Work Center
  @Delete(':id')
  @RequirePermission('MFG_WORK_CENTER', 'DELETE')
  async deleteWorkCenter(
    @Param('id', ParseIntPipe) workCenterId: number,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.workCenterService.deleteWorkCenter(
      workCenterId,
      user,
      this.extractMeta(req),
    );
  }
}
