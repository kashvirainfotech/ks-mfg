import { Module } from '@nestjs/common';
import { WorkOrderController } from './work-order.controller';
import { WorkOrderService } from './work-order.service';
import { DatabaseModule } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { DependencyCheckService } from '../../../common/services/dependency-check.service';

@Module({
  imports: [DatabaseModule],
  controllers: [WorkOrderController],
  providers: [WorkOrderService, AuditLogService, DependencyCheckService],
  exports: [WorkOrderService],
})
export class WorkOrderModule {}
