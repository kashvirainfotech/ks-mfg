import { Module } from '@nestjs/common';
import { SalesReturnController } from './return.controller';
import { SalesReturnService } from './return.service';

@Module({
  controllers: [SalesReturnController],
  providers: [SalesReturnService],
  exports: [SalesReturnService],
})
export class SalesReturnModule {}
