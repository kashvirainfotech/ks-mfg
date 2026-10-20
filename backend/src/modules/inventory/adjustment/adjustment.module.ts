import { Module } from '@nestjs/common';
import { StockAdjustmentController } from './adjustment.controller';
import { StockAdjustmentService } from './adjustment.service';
import { CommonModule } from '../../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [StockAdjustmentController],
  providers: [StockAdjustmentService],
  exports: [StockAdjustmentService],
})
export class StockAdjustmentModule {}
