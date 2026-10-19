import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { JobWorkController } from './job-work.controller';
import { JobWorkService } from './job-work.service';

@Module({
  imports: [DatabaseModule],
  controllers: [JobWorkController],
  providers: [JobWorkService, AuditLogService],
  exports: [JobWorkService],
})
export class JobWorkModule {}
