import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { CommonModule } from '../../../common/common.module';
import { ItemController } from './item.controller';
import { ItemService } from './item.service';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [ItemController],
  providers: [ItemService],
  exports: [ItemService],
})
export class ItemModule {}
