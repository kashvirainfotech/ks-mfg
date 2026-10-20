import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CommonModule } from '../../../common/common.module';
import { PdiController } from './pdi.controller';
import { PdiService } from './pdi.service';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [PdiController],
  providers: [PdiService],
  exports: [PdiService],
})
export class PdiModule {}
