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
import { PurchaseOrderService } from './purchase-order.service';
import type {
  CancelPurchaseOrderDto,
  CreatePurchaseOrderDto,
  PoStatus,
  PoType,
  ReleasePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './purchase-order.dto';

@Controller('procurement/purchase-orders')
export class PurchaseOrderController {
  constructor(private readonly poService: PurchaseOrderService) {}

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

  @Get('summary')
  @RequirePermission('PURCHASE_ORDER', 'VIEW')
  async getPurchaseOrderSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.poService.getPurchaseOrderSummary(user);
  }

  @Get(':poId')
  @RequirePermission('PURCHASE_ORDER', 'VIEW')
  async findPurchaseOrderById(
    @Param('poId', ParseIntPipe) poId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.poService.findPurchaseOrderById(poId, user);
  }

  @Get()
  @RequirePermission('PURCHASE_ORDER', 'VIEW')
  async findAllPurchaseOrders(
    @Query('status') status?: string,
    @Query('poType') poType?: string,
    @Query('vendorId') vendorId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    return this.poService.findAllPurchaseOrders(
      {
        status: status as PoStatus,
        poType: poType as PoType,
        vendorId: vendorId ? Number(vendorId) : undefined,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
        search,
      },
      user!,
    );
  }

  @Post()
  @RequirePermission('PURCHASE_ORDER', 'ADD')
  async createPurchaseOrder(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.poService.createPurchaseOrder(dto, user, this.extractMeta(req));
  }

  @Put(':poId')
  @RequirePermission('PURCHASE_ORDER', 'EDIT')
  async updatePurchaseOrder(
    @Param('poId', ParseIntPipe) poId: number,
    @Body() dto: UpdatePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.poService.updatePurchaseOrder(
      poId,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Post(':poId/submit')
  @RequirePermission('PURCHASE_ORDER', 'SUBMIT')
  async submitPurchaseOrder(
    @Param('poId', ParseIntPipe) poId: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.poService.submitPurchaseOrder(
      poId,
      user,
      this.extractMeta(req),
    );
  }

  @Post(':poId/release')
  @RequirePermission('PURCHASE_ORDER', 'RELEASE')
  async releasePurchaseOrder(
    @Param('poId', ParseIntPipe) poId: number,
    @Body() dto: ReleasePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.poService.releasePurchaseOrder(
      poId,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Post(':poId/cancel')
  @RequirePermission('PURCHASE_ORDER', 'CANCEL')
  async cancelPurchaseOrder(
    @Param('poId', ParseIntPipe) poId: number,
    @Body() dto: CancelPurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.poService.cancelPurchaseOrder(
      poId,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Delete(':poId')
  @RequirePermission('PURCHASE_ORDER', 'DELETE')
  async deletePurchaseOrder(
    @Param('poId', ParseIntPipe) poId: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.poService.deletePurchaseOrder(poId, user, this.extractMeta(req));
  }

  @Post('actions/log')
  @RequirePermission('PURCHASE_ORDER', 'VIEW')
  async logScreenAction(
    @Body('actionType') actionType: 'PRINT' | 'EXPORT',
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.poService.recordScreenAction(
      actionType,
      user,
      this.extractMeta(req),
    );
  }
}
