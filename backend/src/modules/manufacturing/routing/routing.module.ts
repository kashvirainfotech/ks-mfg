import { Module } from '@nestjs/common';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { DatabaseModule } from '../../../database/database.module';
import { CommonModule } from '../../../common/common.module';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [RoutingController],
  providers: [RoutingService],
  exports: [RoutingService],
})
export class RoutingModule {}
