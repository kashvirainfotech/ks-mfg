import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission, CurrentUser } from '../../../common/decorators/auth.decorators';
import { DeliveryChallanService } from './challan.service';
import {
  CreateChallanDto,
  UpdateChallanDto,
  PickChallanDto,
  PackChallanDto,
  DispatchChallanDto,
} from './challan.dto';

@Controller('sales/delivery-challans')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeliveryChallanController {
  constructor(private readonly challanService: DeliveryChallanService) {}

  @Get('summary')
  @RequirePermission('DELIVERY_CHALLAN', 'VIEW')
  async getSummary(@CurrentUser() user: any) {
    return this.challanService.getSummary(user);
  }

  @Get('lookups')
  @RequirePermission('DELIVERY_CHALLAN', 'VIEW')
  async getLookups(@CurrentUser() user: any) {
    return this.challanService.getLookups(user);
  }

  @Get()
  @RequirePermission('DELIVERY_CHALLAN', 'VIEW')
  async findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.challanService.findAll(user, query);
  }

  @Get(':id')
  @RequirePermission('DELIVERY_CHALLAN', 'VIEW')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.challanService.findOne(id, user);
  }

  @Post()
  @RequirePermission('DELIVERY_CHALLAN', 'ADD')
  async create(
    @Body() dto: CreateChallanDto,
    @CurrentUser() user: any,
  ) {
    return this.challanService.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('DELIVERY_CHALLAN', 'EDIT')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateChallanDto,
    @CurrentUser() user: any,
  ) {
    return this.challanService.update(id, dto, user);
  }

  @Post(':id/pick')
  @RequirePermission('DELIVERY_CHALLAN', 'PICK')
  async pick(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PickChallanDto,
    @CurrentUser() user: any,
  ) {
    return this.challanService.pick(id, dto, user);
  }

  @Post(':id/pack')
  @RequirePermission('DELIVERY_CHALLAN', 'PACK')
  async pack(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PackChallanDto,
    @CurrentUser() user: any,
  ) {
    return this.challanService.pack(id, dto, user);
  }

  @Post(':id/dispatch')
  @RequirePermission('DELIVERY_CHALLAN', 'DISPATCH')
  async dispatch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DispatchChallanDto,
    @CurrentUser() user: any,
  ) {
    return this.challanService.dispatch(id, dto, user);
  }

  @Post(':id/deliver')
  @RequirePermission('DELIVERY_CHALLAN', 'EDIT')
  async markDelivered(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.challanService.markDelivered(id, user);
  }

  @Post(':id/cancel')
  @RequirePermission('DELIVERY_CHALLAN', 'EDIT')
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.challanService.cancel(id, user);
  }

  @Delete(':id')
  @RequirePermission('DELIVERY_CHALLAN', 'DELETE')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.challanService.delete(id, user);
  }
}
