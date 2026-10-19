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
} from '@nestjs/common';
import { WorkOrderService } from './work-order.service';
import type {
  CloseWorkOrderDto,
  ConvertMrpOrderDto,
  CreateWorkOrderDto,
  ReleaseWorkOrderDto,
  UpdateWorkOrderDto,
  WorkOrderFilterParams,
} from './work-order.dto';
import {
  CurrentUser,
  RequirePermission,
  type AuthenticatedUserContext,
} from '../../../common/decorators/auth.decorators';

@Controller('manufacturing/work-orders')
export class WorkOrderController {
  constructor(private readonly workOrderService: WorkOrderService) {}

  @Get('summary')
  @RequirePermission('MFG_WORK_ORDER', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.workOrderService.getWorkOrderSummary(user);
  }

  @Get('lookups')
  @RequirePermission('MFG_WORK_ORDER', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    return this.workOrderService.getLookups(user);
  }

  @Get()
  @RequirePermission('MFG_WORK_ORDER', 'VIEW')
  async findAll(
    @Query() params: WorkOrderFilterParams,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.workOrderService.findAll(params, user);
  }

  @Get(':id')
  @RequirePermission('MFG_WORK_ORDER', 'VIEW')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.workOrderService.findOne(id, user);
  }

  @Post()
  @RequirePermission('MFG_WORK_ORDER', 'ADD')
  async create(
    @Body() dto: CreateWorkOrderDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.workOrderService.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('MFG_WORK_ORDER', 'EDIT')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWorkOrderDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.workOrderService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('MFG_WORK_ORDER', 'DELETE')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.workOrderService.delete(id, user);
  }

  @Post(':id/release')
  @RequirePermission('MFG_WORK_ORDER', 'RELEASE')
  async release(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReleaseWorkOrderDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.workOrderService.release(id, dto, user);
  }

  @Post(':id/close')
  @RequirePermission('MFG_WORK_ORDER', 'CLOSE')
  async close(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseWorkOrderDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.workOrderService.close(id, dto, user);
  }

  @Post('convert-mrp')
  @RequirePermission('MFG_WORK_ORDER', 'ADD')
  async convertMrp(
    @Body() dto: ConvertMrpOrderDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.workOrderService.convertFromMrpPlannedOrder(dto, user);
  }
}
