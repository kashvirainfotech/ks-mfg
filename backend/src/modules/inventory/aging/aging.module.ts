import { Module } from '@nestjs/common';
import { StockAgingController } from './aging.controller';
import { StockAgingService } from './aging.service';
import { DatabaseModule } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';

@Module({
  imports: [DatabaseModule],
  controllers: [StockAgingController],
  providers: [StockAgingService, AuditLogService],
  exports: [StockAgingService],
})
export class StockAgingModule {}
