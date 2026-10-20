import {
  Controller,
  Get,
  Post,
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
import { StockBalanceService } from './stock-balance.service';
import type { StockBalanceFilterDto, StockRevaluationDto } from './stock-balance.dto';

@Controller('inventory/balance')
export class StockBalanceController {
  constructor(private readonly stockBalanceService: StockBalanceService) {}

  @Get('summary')
  @RequirePermission('STOCK_BALANCE', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    const data = await this.stockBalanceService.getSummary(user);
    return {
      success: true,
      data,
    };
  }

  @Get('lookups')
  @RequirePermission('STOCK_BALANCE', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    const data = await this.stockBalanceService.getLookups(user);
    return {
      success: true,
      data,
    };
  }

  @Get()
  @RequirePermission('STOCK_BALANCE', 'VIEW')
  async getStockBalances(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query() filter: StockBalanceFilterDto,
  ) {
    const data = await this.stockBalanceService.getStockBalances(user, filter);
    return {
      success: true,
      data,
    };
  }

  @Get(':id/ledger')
  @RequirePermission('STOCK_BALANCE', 'LEDGER_DRILLDOWN')
  async getStockLedgerDrilldown(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.stockBalanceService.getStockLedgerDrilldown(user, id);
    return {
      success: true,
      data,
    };
  }

  @Post(':id/revalue')
  @RequirePermission('STOCK_BALANCE', 'REVALUE')
  async revalueStock(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StockRevaluationDto,
  ) {
    const data = await this.stockBalanceService.revalueStock(user, id, dto);
    return {
      success: true,
      message: `Stock revaluation processed successfully. Valuation adjusted to ₹${data.newValuation.toLocaleString('en-IN')}.`,
      data,
    };
  }
}
