import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CommonModule } from '../../../common/common.module';
import { InwardQcController } from './inward-qc.controller';
import { InwardQcService } from './inward-qc.service';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [InwardQcController],
  providers: [InwardQcService],
  exports: [InwardQcService],
})
export class InwardQcModule {}
