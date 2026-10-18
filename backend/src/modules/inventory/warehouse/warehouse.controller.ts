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
import { WarehouseService } from './warehouse.service';
import type {
  BulkGenerateStorageBinsDto,
  CreateStorageBinDto,
  CreateWarehouseDto,
  UpdateStorageBinDto,
  UpdateWarehouseDto,
} from './warehouse.dto';

@Controller('inventory/warehouses')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

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
  // TAB 2: MULTI-LEVEL STORAGE BINS (tbl_inv_storage_bin)
  // Static '/bins' routes placed first so they don't collide with '/:id'
  // ==========================================================================

  @Get('bins')
  @RequirePermission('WAREHOUSE_MASTER', 'VIEW')
  async findAllStorageBins(
    @Query('warehouseId') warehouseId?: string,
    @Query('targetCompId') targetCompId?: string,
    @Query('targetBranchId') targetBranchId?: string,
    @Query('zoneCode') zoneCode?: string,
    @Query('binType') binType?: string,
  ) {
    return this.warehouseService.findAllStorageBins({
      warehouseId: warehouseId ? Number(warehouseId) : undefined,
      targetCompId: targetCompId ? Number(targetCompId) : undefined,
      targetBranchId: targetBranchId ? Number(targetBranchId) : undefined,
      zoneCode,
      binType,
    });
  }

  @Get('bins/:binId')
  @RequirePermission('WAREHOUSE_MASTER', 'VIEW')
  async findStorageBinById(@Param('binId', ParseIntPipe) binId: number) {
    return this.warehouseService.findStorageBinById(binId);
  }

  @Post('bins')
  @RequirePermission('WAREHOUSE_MASTER', 'ADD')
  async createStorageBin(
    @Body() dto: CreateStorageBinDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.warehouseService.createStorageBin(
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Post('bins/bulk-generate')
  @RequirePermission('WAREHOUSE_MASTER', 'ADD')
  async bulkGenerateStorageBins(
    @Body() dto: BulkGenerateStorageBinsDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.warehouseService.bulkGenerateStorageBins(
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Put('bins/:binId')
  @RequirePermission('WAREHOUSE_MASTER', 'EDIT')
  async updateStorageBin(
    @Param('binId', ParseIntPipe) binId: number,
    @Body() dto: UpdateStorageBinDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.warehouseService.updateStorageBin(
      binId,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Delete('bins/:binId')
  @RequirePermission('WAREHOUSE_MASTER', 'DELETE')
  async deleteStorageBin(
    @Param('binId', ParseIntPipe) binId: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.warehouseService.deleteStorageBin(
      binId,
      user,
      this.extractMeta(req),
    );
  }

  // ==========================================================================
  // SCREEN AUDIT ACTION LOGGING (PRINT / EXPORT)
  // ==========================================================================

  @Post('action/:actionType')
  @RequirePermission('WAREHOUSE_MASTER', 'VIEW')
  async recordScreenAction(
    @Param('actionType') actionType: 'PRINT' | 'EXPORT',
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.warehouseService.recordScreenAction(
      actionType,
      user,
      this.extractMeta(req),
    );
  }

  // ==========================================================================
  // TAB 1: PLANT WAREHOUSES & STORES (tbl_inv_warehouse)
  // ==========================================================================

  @Get()
  @RequirePermission('WAREHOUSE_MASTER', 'VIEW')
  async findAllWarehouses(
    @Query('targetCompId') targetCompId?: string,
    @Query('targetBranchId') targetBranchId?: string,
    @Query('warehouseType') warehouseType?: string,
  ) {
    return this.warehouseService.findAllWarehouses({
      targetCompId: targetCompId ? Number(targetCompId) : undefined,
      targetBranchId: targetBranchId ? Number(targetBranchId) : undefined,
      warehouseType,
    });
  }

  @Get(':id')
  @RequirePermission('WAREHOUSE_MASTER', 'VIEW')
  async findWarehouseById(@Param('id', ParseIntPipe) id: number) {
    return this.warehouseService.findWarehouseById(id);
  }

  @Post()
  @RequirePermission('WAREHOUSE_MASTER', 'ADD')
  async createWarehouse(
    @Body() dto: CreateWarehouseDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.warehouseService.createWarehouse(
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Put(':id')
  @RequirePermission('WAREHOUSE_MASTER', 'EDIT')
  async updateWarehouse(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWarehouseDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.warehouseService.updateWarehouse(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Delete(':id')
  @RequirePermission('WAREHOUSE_MASTER', 'DELETE')
  async deleteWarehouse(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.warehouseService.deleteWarehouse(
      id,
      user,
      this.extractMeta(req),
    );
  }
}
