import { Module } from '@nestjs/common';
import { StockTransferController } from './transfer.controller';
import { StockTransferService } from './transfer.service';
import { CommonModule } from '../../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [StockTransferController],
  providers: [StockTransferService],
  exports: [StockTransferService],
})
export class StockTransferModule {}
