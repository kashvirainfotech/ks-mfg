import { Module } from '@nestjs/common';
import { BankingController } from './banking.controller';
import { BankingService } from './banking.service';
import { AuditLogService } from '../../../common/services/audit-log.service';

@Module({
  controllers: [BankingController],
  providers: [BankingService, AuditLogService],
  exports: [BankingService],
})
export class BankingModule {}
