import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { StockTraceabilityService } from './traceability.service';
import { StockTraceabilityController } from './traceability.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [StockTraceabilityController],
  providers: [StockTraceabilityService],
  exports: [StockTraceabilityService],
})
export class StockTraceabilityModule {}
