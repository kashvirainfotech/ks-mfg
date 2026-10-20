import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CommonModule } from '../../../common/common.module';
import { InProcessQcController } from './in-process-qc.controller';
import { InProcessQcService } from './in-process-qc.service';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [InProcessQcController],
  providers: [InProcessQcService],
  exports: [InProcessQcService],
})
export class InProcessQcModule {}
