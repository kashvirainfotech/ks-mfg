import { Module } from '@nestjs/common';
import { StockBalanceController } from './stock-balance.controller';
import { StockBalanceService } from './stock-balance.service';

@Module({
  controllers: [StockBalanceController],
  providers: [StockBalanceService],
  exports: [StockBalanceService],
})
export class StockBalanceModule {}
