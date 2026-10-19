import { Module } from '@nestjs/common';
import { JobCardController } from './job-card.controller';
import { JobCardService } from './job-card.service';
import { DatabaseModule } from '../../../database/database.module';
import { CommonModule } from '../../../common/common.module';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [JobCardController],
  providers: [JobCardService],
  exports: [JobCardService],
})
export class JobCardModule {}
