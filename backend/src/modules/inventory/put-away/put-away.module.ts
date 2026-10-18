import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { PutAwayController } from './put-away.controller';
import { PutAwayService } from './put-away.service';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { DependencyCheckService } from '../../../common/services/dependency-check.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PutAwayController],
  providers: [PutAwayService, AuditLogService, DependencyCheckService],
  exports: [PutAwayService],
})
export class PutAwayModule {}
