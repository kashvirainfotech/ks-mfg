import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CommonModule } from '../../../common/common.module';
import { NcrController } from './ncr.controller';
import { NcrService } from './ncr.service';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [NcrController],
  providers: [NcrService],
  exports: [NcrService],
})
export class NcrModule {}
