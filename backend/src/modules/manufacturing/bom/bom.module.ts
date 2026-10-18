import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CommonModule } from '../../../common/common.module';
import { BomController } from './bom.controller';
import { BomService } from './bom.service';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [BomController],
  providers: [BomService],
  exports: [BomService],
})
export class BomModule {}
