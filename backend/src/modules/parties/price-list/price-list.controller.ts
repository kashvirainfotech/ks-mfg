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
import { PriceListService } from './price-list.service';
import type {
  CreatePriceListDto,
  PriceListType,
  UpdatePriceListDto,
} from './price-list.dto';

@Controller('price-lists')
export class PriceListController {
  constructor(private readonly priceListService: PriceListService) {}

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
  @RequirePermission('PRICE_LIST', 'VIEW')
  async getPriceListSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.priceListService.getPriceListSummary(user);
  }

  @Get('lookup')
  @RequirePermission('PRICE_LIST', 'VIEW')
  async lookupRate(
    @Query('priceListId') priceListId?: string,
    @Query('partyId') partyId?: string,
    @Query('itemId') itemId?: string,
    @Query('qty') qty?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    return this.priceListService.lookupRate(
      {
        priceListId: priceListId ? Number(priceListId) : undefined,
        partyId: partyId ? Number(partyId) : undefined,
        itemId: Number(itemId) || 0,
        qty: Number(qty) || 1,
      },
      user!,
    );
  }

  @Get()
  @RequirePermission('PRICE_LIST', 'VIEW')
  async findAllPriceLists(
    @Query('priceListType') priceListType?: PriceListType,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    return this.priceListService.findAllPriceLists(
      {
        priceListType,
        isActive:
          isActive === 'true'
            ? true
            : isActive === 'false'
            ? false
            : undefined,
        search,
      },
      user!,
    );
  }

  @Get(':priceListId')
  @RequirePermission('PRICE_LIST', 'VIEW')
  async findPriceListById(
    @Param('priceListId', ParseIntPipe) priceListId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.priceListService.findPriceListById(priceListId, user);
  }

  @Post()
  @RequirePermission('PRICE_LIST', 'ADD')
  async createPriceList(
    @Body() dto: CreatePriceListDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.priceListService.createPriceList(
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Put(':priceListId')
  @RequirePermission('PRICE_LIST', 'EDIT')
  async updatePriceList(
    @Param('priceListId', ParseIntPipe) priceListId: number,
    @Body() dto: UpdatePriceListDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.priceListService.updatePriceList(
      priceListId,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Delete(':priceListId')
  @RequirePermission('PRICE_LIST', 'DELETE')
  async deletePriceList(
    @Param('priceListId', ParseIntPipe) priceListId: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.priceListService.deletePriceList(
      priceListId,
      user,
      this.extractMeta(req),
    );
  }

  @Post('actions/log')
  @RequirePermission('PRICE_LIST', 'VIEW')
  async logScreenAction(
    @Body('actionType') actionType: 'PRINT' | 'EXPORT',
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.priceListService.recordScreenAction(
      actionType,
      user,
      this.extractMeta(req),
    );
  }
}
