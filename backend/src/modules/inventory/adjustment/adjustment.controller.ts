import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  CurrentUser,
  RequirePermission,
  type AuthenticatedUserContext,
} from '../../../common/decorators/auth.decorators';
import { StockAdjustmentService } from './adjustment.service';
import type {
  CreateAdjustmentHeaderDto,
  UpdateAdjustmentHeaderDto,
  AdjustmentFilterDto,
  CancelAdjustmentDto,
} from './adjustment.dto';

@Controller('inventory/adjustments')
export class StockAdjustmentController {
  constructor(private readonly adjustmentService: StockAdjustmentService) {}

  @Get('summary')
  @RequirePermission('STOCK_ADJUSTMENT', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    const data = await this.adjustmentService.getSummary(user);
    return {
      success: true,
      message: 'Stock adjustment summary retrieved successfully',
      data,
    };
  }

  @Get('lookups')
  @RequirePermission('STOCK_ADJUSTMENT', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    const data = await this.adjustmentService.getLookups(user);
    return {
      success: true,
      message: 'Stock adjustment lookups retrieved successfully',
      data,
    };
  }

  @Get('book-stock')
  @RequirePermission('STOCK_ADJUSTMENT', 'VIEW')
  async getBookStock(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query('warehouseId', ParseIntPipe) warehouseId: number,
    @Query('binId') binId?: string,
  ) {
    const data = await this.adjustmentService.getBookStock(
      warehouseId,
      binId ? parseInt(binId, 10) : undefined,
      user,
    );
    return {
      success: true,
      message: 'Warehouse bin book stock loaded successfully',
      data,
    };
  }

  @Get()
  @RequirePermission('STOCK_ADJUSTMENT', 'VIEW')
  async findAll(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query() filter: AdjustmentFilterDto,
  ) {
    const data = await this.adjustmentService.findAll(filter, user);
    return {
      success: true,
      message: 'Stock adjustments retrieved successfully',
      data,
    };
  }

  @Get(':id')
  @RequirePermission('STOCK_ADJUSTMENT', 'VIEW')
  async findOne(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.adjustmentService.findOne(id, user);
    return {
      success: true,
      message: 'Stock adjustment details retrieved successfully',
      data,
    };
  }

  @Post()
  @RequirePermission('STOCK_ADJUSTMENT', 'ADD')
  async create(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() dto: CreateAdjustmentHeaderDto,
  ) {
    const data = await this.adjustmentService.create(dto, user);
    return {
      success: true,
      message: 'Stock adjustment voucher created successfully',
      data,
    };
  }

  @Put(':id')
  @RequirePermission('STOCK_ADJUSTMENT', 'EDIT')
  async update(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdjustmentHeaderDto,
  ) {
    const data = await this.adjustmentService.update(id, dto, user);
    return {
      success: true,
      message: 'Stock adjustment voucher updated successfully',
      data,
    };
  }

  @Post(':id/submit')
  @RequirePermission('STOCK_ADJUSTMENT', 'SUBMIT')
  async submit(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.adjustmentService.submit(id, user);
    return {
      success: true,
      message: 'Stock adjustment voucher submitted for managerial approval',
      data,
    };
  }

  @Post(':id/approve')
  @RequirePermission('STOCK_ADJUSTMENT', 'APPROVE')
  async approve(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.adjustmentService.approve(id, user);
    return {
      success: true,
      message: 'Stock adjustment approved and posted to inventory ledger',
      data,
    };
  }

  @Post(':id/cancel')
  @RequirePermission('STOCK_ADJUSTMENT', 'CANCEL')
  async cancel(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelAdjustmentDto,
  ) {
    const data = await this.adjustmentService.cancel(id, dto, user);
    return {
      success: true,
      message: 'Stock adjustment voucher cancelled and adjustments reverted',
      data,
    };
  }
}
