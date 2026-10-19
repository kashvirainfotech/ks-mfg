import { Module } from '@nestjs/common';
import { MaterialIssueController } from './material-issue.controller';
import { MaterialIssueService } from './material-issue.service';
import { DatabaseModule } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { DependencyCheckService } from '../../../common/services/dependency-check.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MaterialIssueController],
  providers: [MaterialIssueService, AuditLogService, DependencyCheckService],
  exports: [MaterialIssueService],
})
export class MaterialIssueModule {}
