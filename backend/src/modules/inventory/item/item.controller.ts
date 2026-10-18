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
import { ItemService } from './item.service';
import type { CreateItemDto, ItemType, UpdateItemDto } from './item.dto';

@Controller('inventory/items')
export class ItemController {
  constructor(private readonly itemService: ItemService) {}

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
  @RequirePermission('ITEM_MASTER', 'VIEW')
  async getItemSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.itemService.getItemSummary(user);
  }

  @Get()
  @RequirePermission('ITEM_MASTER', 'VIEW')
  async findAllItems(
    @Query('categoryId') categoryId?: string,
    @Query('itemType') itemType?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('warehouseId') warehouseId?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    return this.itemService.findAllItems(
      {
        categoryId: categoryId ? Number(categoryId) : undefined,
        itemType: itemType as ItemType,
        isActive:
          isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        search,
        warehouseId: warehouseId ? Number(warehouseId) : undefined,
      },
      user!,
    );
  }

  @Get(':itemId')
  @RequirePermission('ITEM_MASTER', 'VIEW')
  async findItemById(
    @Param('itemId', ParseIntPipe) itemId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.itemService.findItemById(itemId, user);
  }

  @Post()
  @RequirePermission('ITEM_MASTER', 'ADD')
  async createItem(
    @Body() dto: CreateItemDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.itemService.createItem(dto, user, this.extractMeta(req));
  }

  @Put(':itemId')
  @RequirePermission('ITEM_MASTER', 'EDIT')
  async updateItem(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateItemDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.itemService.updateItem(
      itemId,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Delete(':itemId')
  @RequirePermission('ITEM_MASTER', 'DELETE')
  async deleteItem(
    @Param('itemId', ParseIntPipe) itemId: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.itemService.deleteItem(itemId, user, this.extractMeta(req));
  }

  @Post('actions/log')
  @RequirePermission('ITEM_MASTER', 'VIEW')
  async logScreenAction(
    @Body('actionType') actionType: 'PRINT' | 'EXPORT',
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.itemService.recordScreenAction(
      actionType,
      user,
      this.extractMeta(req),
    );
  }
}

