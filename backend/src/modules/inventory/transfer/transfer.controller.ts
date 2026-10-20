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
import { StockTransferService } from './transfer.service';
import type {
  CreateTransferHeaderDto,
  UpdateTransferHeaderDto,
  DispatchTransferDto,
  ReceiveTransferDto,
  CancelTransferDto,
  TransferFilterDto,
} from './transfer.dto';

@Controller('inventory/transfers')
export class StockTransferController {
  constructor(private readonly transferService: StockTransferService) {}

  @Get('summary')
  @RequirePermission('STOCK_TRANSFER', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    const data = await this.transferService.getSummary(user);
    return {
      success: true,
      message: 'Stock transfer summary retrieved successfully',
      data,
    };
  }

  @Get('lookups')
  @RequirePermission('STOCK_TRANSFER', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    const data = await this.transferService.getLookups(user);
    return {
      success: true,
      message: 'Stock transfer lookups retrieved successfully',
      data,
    };
  }

  @Get('available-stock')
  @RequirePermission('STOCK_TRANSFER', 'VIEW')
  async getAvailableStock(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query('warehouseId', ParseIntPipe) warehouseId: number,
    @Query('binId') binId?: string,
  ) {
    const data = await this.transferService.getAvailableStock(
      warehouseId,
      binId ? parseInt(binId, 10) : undefined,
      user,
    );
    return {
      success: true,
      message: 'Available bin stock loaded successfully',
      data,
    };
  }

  @Get()
  @RequirePermission('STOCK_TRANSFER', 'VIEW')
  async findAll(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query() filter: TransferFilterDto,
  ) {
    const data = await this.transferService.findAll(filter, user);
    return {
      success: true,
      message: 'Stock transfers retrieved successfully',
      data,
    };
  }

  @Get(':id')
  @RequirePermission('STOCK_TRANSFER', 'VIEW')
  async findOne(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.transferService.findOne(id, user);
    return {
      success: true,
      message: 'Stock transfer details retrieved successfully',
      data,
    };
  }

  @Post()
  @RequirePermission('STOCK_TRANSFER', 'ADD')
  async create(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() dto: CreateTransferHeaderDto,
  ) {
    const data = await this.transferService.create(dto, user);
    return {
      success: true,
      message: 'Stock transfer voucher created successfully',
      data,
    };
  }

  @Put(':id')
  @RequirePermission('STOCK_TRANSFER', 'EDIT')
  async update(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransferHeaderDto,
  ) {
    const data = await this.transferService.update(id, dto, user);
    return {
      success: true,
      message: 'Stock transfer voucher updated successfully',
      data,
    };
  }

  @Post(':id/dispatch')
  @RequirePermission('STOCK_TRANSFER', 'DISPATCH')
  async dispatch(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DispatchTransferDto,
  ) {
    const data = await this.transferService.dispatch(id, dto, user);
    return {
      success: true,
      message: 'Stock transfer dispatched and outward inventory deducted',
      data,
    };
  }

  @Post(':id/receive')
  @RequirePermission('STOCK_TRANSFER', 'RECEIVE')
  async receive(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReceiveTransferDto,
  ) {
    const data = await this.transferService.receive(id, dto, user);
    return {
      success: true,
      message: 'Stock transfer received and destination inventory accreted',
      data,
    };
  }

  @Post(':id/direct-transfer')
  @RequirePermission('STOCK_TRANSFER', 'DISPATCH')
  async directTransfer(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.transferService.directTransfer(id, user);
    return {
      success: true,
      message: 'Stock transferred directly between bins in one atomic step',
      data,
    };
  }

  @Post(':id/cancel')
  @RequirePermission('STOCK_TRANSFER', 'CANCEL')
  async cancel(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelTransferDto,
  ) {
    const data = await this.transferService.cancel(id, dto, user);
    return {
      success: true,
      message: 'Stock transfer cancelled and inventory restored',
      data,
    };
  }
}
