import { Module } from '@nestjs/common';
import { DeliveryChallanController } from './challan.controller';
import { DeliveryChallanService } from './challan.service';
import { DatabaseModule } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';

@Module({
  imports: [DatabaseModule],
  controllers: [DeliveryChallanController],
  providers: [DeliveryChallanService, AuditLogService],
  exports: [DeliveryChallanService],
})
export class DeliveryChallanModule {}
