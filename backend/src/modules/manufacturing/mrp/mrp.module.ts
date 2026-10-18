import { Module } from '@nestjs/common';
import { MrpController } from './mrp.controller';
import { MrpService } from './mrp.service';
import { DatabaseModule } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { DependencyCheckService } from '../../../common/services/dependency-check.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MrpController],
  providers: [MrpService, AuditLogService, DependencyCheckService],
  exports: [MrpService],
})
export class MrpModule {}
