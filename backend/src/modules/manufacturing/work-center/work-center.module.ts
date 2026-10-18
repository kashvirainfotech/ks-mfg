import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CommonModule } from '../../../common/common.module';
import { WorkCenterController } from './work-center.controller';
import { WorkCenterService } from './work-center.service';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [WorkCenterController],
  providers: [WorkCenterService],
  exports: [WorkCenterService],
})
export class WorkCenterModule {}
