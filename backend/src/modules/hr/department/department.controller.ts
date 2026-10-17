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
import { DepartmentService } from './department.service';
import type {
  CreateDepartmentDto,
  CreateDesignationDto,
  UpdateDepartmentDto,
  UpdateDesignationDto,
} from './department.dto';

@Controller('hr')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

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

  // ==========================================================================
  // 1. Department Master Endpoints (`/api/v1/hr/departments`)
  // ==========================================================================

  @Get('departments')
  @RequirePermission('DEPT_MASTER', 'VIEW')
  async findAllDepartments(@Query('compId') compId?: string) {
    return this.departmentService.findAllDepartments(
      compId ? Number(compId) : undefined,
    );
  }

  @Get('departments/:id')
  @RequirePermission('DEPT_MASTER', 'VIEW')
  async findDepartmentById(@Param('id', ParseIntPipe) id: number) {
    return this.departmentService.findDepartmentById(id);
  }

  @Post('departments')
  @RequirePermission('DEPT_MASTER', 'ADD')
  async createDepartment(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.departmentService.createDepartment(
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Put('departments/:id')
  @RequirePermission('DEPT_MASTER', 'EDIT')
  async updateDepartment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.departmentService.updateDepartment(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Delete('departments/:id')
  @RequirePermission('DEPT_MASTER', 'DELETE')
  async deleteDepartment(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.departmentService.deleteDepartment(
      id,
      user,
      this.extractMeta(req),
    );
  }

  @Post('departments/action/:actionType')
  @RequirePermission('DEPT_MASTER', 'VIEW')
  async recordDepartmentAction(
    @Param('actionType') actionType: 'PRINT' | 'EXPORT',
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    await this.departmentService.recordScreenAction(
      actionType,
      'tbl_hr_department',
      user,
      this.extractMeta(req),
    );
    return { logged: true };
  }

  // ==========================================================================
  // 2. Designation Master Endpoints (`/api/v1/hr/designations`)
  // ==========================================================================

  @Get('designations')
  @RequirePermission('DEPT_MASTER', 'VIEW')
  async findAllDesignations(@Query('compId') compId?: string) {
    return this.departmentService.findAllDesignations(
      compId ? Number(compId) : undefined,
    );
  }

  @Get('designations/:id')
  @RequirePermission('DEPT_MASTER', 'VIEW')
  async findDesignationById(@Param('id', ParseIntPipe) id: number) {
    return this.departmentService.findDesignationById(id);
  }

  @Post('designations')
  @RequirePermission('DEPT_MASTER', 'ADD')
  async createDesignation(
    @Body() dto: CreateDesignationDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.departmentService.createDesignation(
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Put('designations/:id')
  @RequirePermission('DEPT_MASTER', 'EDIT')
  async updateDesignation(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDesignationDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.departmentService.updateDesignation(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Delete('designations/:id')
  @RequirePermission('DEPT_MASTER', 'DELETE')
  async deleteDesignation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.departmentService.deleteDesignation(
      id,
      user,
      this.extractMeta(req),
    );
  }

  @Post('designations/action/:actionType')
  @RequirePermission('DEPT_MASTER', 'VIEW')
  async recordDesignationAction(
    @Param('actionType') actionType: 'PRINT' | 'EXPORT',
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    await this.departmentService.recordScreenAction(
      actionType,
      'tbl_hr_designation',
      user,
      this.extractMeta(req),
    );
    return { logged: true };
  }
}
