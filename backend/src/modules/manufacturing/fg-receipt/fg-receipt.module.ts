import { Module } from '@nestjs/common';
import { FgReceiptController } from './fg-receipt.controller';
import { FgReceiptService } from './fg-receipt.service';

@Module({
  controllers: [FgReceiptController],
  providers: [FgReceiptService],
  exports: [FgReceiptService],
})
export class FgReceiptModule {}
