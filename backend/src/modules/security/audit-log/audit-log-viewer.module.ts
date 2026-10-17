import { Module } from '@nestjs/common';
import { AuditLogViewerController } from './audit-log-viewer.controller';
import { AuditLogViewerService } from './audit-log-viewer.service';

@Module({
  controllers: [AuditLogViewerController],
  providers: [AuditLogViewerService],
  exports: [AuditLogViewerService],
})
export class AuditLogViewerModule {}
