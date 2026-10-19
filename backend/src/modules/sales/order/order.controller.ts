import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { OrderService } from './order.service';
import {
  CreateOrderDto,
  UpdateOrderDto,
  ConfirmOrderDto,
  HoldOrderDto,
  CreditOverrideDto,
  CreateWorkOrderDto,
  ReserveStockDto,
} from './order.dto';

@Controller('sales/orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get('summary')
  @RequirePermission('SALES_ORDER', 'VIEW')
  async getSummary(@CurrentUser() user: any) {
    return this.orderService.getSummary(user);
  }

  @Get('lookups')
  @RequirePermission('SALES_ORDER', 'VIEW')
  async getLookups(@CurrentUser() user: any) {
    return this.orderService.getLookups(user);
  }

  @Get()
  @RequirePermission('SALES_ORDER', 'VIEW')
  async findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.orderService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermission('SALES_ORDER', 'VIEW')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.orderService.findOne(id, user);
  }

  @Post()
  @RequirePermission('SALES_ORDER', 'ADD')
  async create(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.orderService.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('SALES_ORDER', 'EDIT')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.orderService.update(id, dto, user);
  }

  @Post(':id/confirm')
  @RequirePermission('SALES_ORDER', 'CONFIRM')
  async confirm(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.orderService.confirmOrder(id, dto, user);
  }

  @Post(':id/hold')
  @RequirePermission('SALES_ORDER', 'HOLD')
  async setHold(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: HoldOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.orderService.setHold(id, dto, user);
  }

  @Post(':id/credit-override')
  @RequirePermission('SALES_ORDER', 'AUTHORIZE')
  async creditOverride(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreditOverrideDto,
    @CurrentUser() user: any,
  ) {
    return this.orderService.creditOverride(id, dto, user);
  }

  @Post(':id/create-wo')
  @RequirePermission('SALES_ORDER', 'CREATE_WO')
  async createWorkOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateWorkOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.orderService.createWorkOrder(id, dto, user);
  }

  @Post(':id/reserve-stock')
  @RequirePermission('SALES_ORDER', 'CONFIRM')
  async reserveStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReserveStockDto,
    @CurrentUser() user: any,
  ) {
    return this.orderService.reserveStock(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('SALES_ORDER', 'DELETE')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.orderService.delete(id, user);
  }
}
