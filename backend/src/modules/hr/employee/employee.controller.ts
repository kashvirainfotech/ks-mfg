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
import { EmployeeService } from './employee.service';
import type { CreateEmployeeDto, UpdateEmployeeDto } from './employee.dto';

@Controller('hr/employees')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

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

  @Get()
  @RequirePermission('EMPLOYEE_MASTER', 'VIEW')
  async findAllEmployees(
    @Query('compId') compId?: string,
    @Query('branchId') branchId?: string,
    @Query('deptId') deptId?: string,
  ) {
    return this.employeeService.findAllEmployees({
      compId: compId ? Number(compId) : undefined,
      branchId: branchId ? Number(branchId) : undefined,
      deptId: deptId ? Number(deptId) : undefined,
    });
  }

  @Get(':id')
  @RequirePermission('EMPLOYEE_MASTER', 'VIEW')
  async findEmployeeById(@Param('id', ParseIntPipe) id: number) {
    return this.employeeService.findEmployeeById(id);
  }

  @Post()
  @RequirePermission('EMPLOYEE_MASTER', 'ADD')
  async createEmployee(
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.employeeService.createEmployee(
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Put(':id')
  @RequirePermission('EMPLOYEE_MASTER', 'EDIT')
  async updateEmployee(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.employeeService.updateEmployee(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Delete(':id')
  @RequirePermission('EMPLOYEE_MASTER', 'DELETE')
  async deleteEmployee(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.employeeService.deleteEmployee(
      id,
      user,
      this.extractMeta(req),
    );
  }

  @Post('action/:actionType')
  @RequirePermission('EMPLOYEE_MASTER', 'VIEW')
  async recordEmployeeAction(
    @Param('actionType') actionType: 'PRINT' | 'EXPORT',
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    await this.employeeService.recordScreenAction(
      actionType,
      user,
      this.extractMeta(req),
    );
    return { logged: true };
  }
}
