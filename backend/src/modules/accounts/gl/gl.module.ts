import { Module } from '@nestjs/common';
import { GlController } from './gl.controller';
import { GlService } from './gl.service';
import { AuditLogService } from '../../../common/services/audit-log.service';

@Module({
  controllers: [GlController],
  providers: [GlService, AuditLogService],
  exports: [GlService],
})
export class GlModule {}
