import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CurrentUser,
  RequirePermission,
} from '../../../common/decorators/auth.decorators';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import { AuditLogViewerService } from './audit-log-viewer.service';
import type { AuditLogFilterQueryDto } from './audit-log.dto';

@Controller('security/audit-logs')
export class AuditLogViewerController {
  constructor(private readonly auditLogViewerService: AuditLogViewerService) {}

  private extractMeta(req: Request) {
    return {
      ipAddress:
        (req.headers['x-forwarded-for'] as string) ||
        req.socket?.remoteAddress ||
        '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'unknown',
      correlationId: (req.headers['x-correlation-id'] as string) || undefined,
    };
  }

  @Get()
  @RequirePermission('AUDIT_LOG', 'VIEW')
  async findAllLogs(@Query() query: AuditLogFilterQueryDto) {
    return this.auditLogViewerService.findAllLogs(query);
  }

  @Get('metadata')
  @RequirePermission('AUDIT_LOG', 'VIEW')
  async getMetadata() {
    return this.auditLogViewerService.getMetadata();
  }

  @Get(':id')
  @RequirePermission('AUDIT_LOG', 'VIEW')
  async findLogById(@Param('id', ParseIntPipe) id: number) {
    return this.auditLogViewerService.findLogById(id);
  }

  @Post('action/:actionType')
  @RequirePermission('AUDIT_LOG', 'VIEW')
  async recordAuditAction(
    @Param('actionType') actionType: 'PRINT' | 'EXPORT',
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    await this.auditLogViewerService.recordScreenAction(
      actionType,
      user,
      this.extractMeta(req),
    );
    return { logged: true };
  }
}
