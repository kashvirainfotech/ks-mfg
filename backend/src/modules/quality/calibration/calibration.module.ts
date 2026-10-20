import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CommonModule } from '../../../common/common.module';
import { CalibrationController } from './calibration.controller';
import { CalibrationService } from './calibration.service';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [CalibrationController],
  providers: [CalibrationService],
  exports: [CalibrationService],
})
export class CalibrationModule {}
