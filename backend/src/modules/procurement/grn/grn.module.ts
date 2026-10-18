import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CommonModule } from '../../../common/common.module';
import { GrnController } from './grn.controller';
import { GrnService } from './grn.service';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [GrnController],
  providers: [GrnService],
  exports: [GrnService],
})
export class GrnModule {}
