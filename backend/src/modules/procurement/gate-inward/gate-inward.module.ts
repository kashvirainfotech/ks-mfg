import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CommonModule } from '../../../common/common.module';
import { GateInwardController } from './gate-inward.controller';
import { GateInwardService } from './gate-inward.service';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [GateInwardController],
  providers: [GateInwardService],
  exports: [GateInwardService],
})
export class GateInwardModule {}
