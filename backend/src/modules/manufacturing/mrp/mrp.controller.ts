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
import { MrpService } from './mrp.service';
import {
  ConvertPlannedOrderDto,
  MrpFilterParams,
  RunMrpDto,
  UpdatePlannedOrderStatusDto,
} from './mrp.dto';
import {
  CurrentUser,
  RequirePermission,
  type AuthenticatedUserContext,
} from '../../../common/decorators/auth.decorators';

@Controller('manufacturing/mrp')
export class MrpController {
  constructor(private readonly mrpService: MrpService) {}

  @Get('summary')
  @RequirePermission('MFG_MRP', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.mrpService.getMrpSummary(user);
  }

  @Get('lookups')
  @RequirePermission('MFG_MRP', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    return this.mrpService.getLookups(user);
  }

  @Get('runs')
  @RequirePermission('MFG_MRP', 'VIEW')
  async findAllRuns(
    @Query() params: MrpFilterParams,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.mrpService.findAllRuns(params, user);
  }

  @Get('runs/:id')
  @RequirePermission('MFG_MRP', 'VIEW')
  async findRunDetail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.mrpService.findRunDetail(id, user);
  }

  @Get('planned-orders')
  @RequirePermission('MFG_MRP', 'VIEW')
  async findAllPlannedOrders(
    @Query() params: MrpFilterParams,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.mrpService.findAllPlannedOrders(params, user);
  }

  @Post('run')
  @RequirePermission('MFG_MRP', 'RUN_MRP')
  async runMrp(
    @Body() dto: RunMrpDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.mrpService.runMrp(dto, user);
  }

  @Post('convert-to-pr')
  @RequirePermission('MFG_MRP', 'CONVERT')
  async convertToPr(
    @Body() dto: ConvertPlannedOrderDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.mrpService.convertPlannedOrdersToPr(dto, user);
  }

  @Put('planned-orders/:id/status')
  @RequirePermission('MFG_MRP', 'RUN_MRP')
  async updatePlannedOrderStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlannedOrderStatusDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.mrpService.updatePlannedOrderStatus(id, dto, user);
  }

  @Delete('runs/:id')
  @RequirePermission('MFG_MRP', 'RUN_MRP')
  async deleteRun(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.mrpService.deleteRun(id, user);
  }
}
