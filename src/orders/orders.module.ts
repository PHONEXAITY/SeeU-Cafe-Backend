import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderDetailsService } from './order-details/order-details.service';
import { OrderDetailsController } from './order-details/order-details.controller';
import { OrderTimelineService } from './order-timeline/order-timeline.service';
import { OrderTimelineController } from './order-timeline/order-timeline.controller';
import { TimeUpdateService } from './time-update/time-update.service';
import { TimeUpdateController } from './time-update/time-update.controller';
import { OrderHistoryService } from './order-history/order-history.service';
import { OrderHistoryController } from './order-history/order-history.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    OrdersController,
    OrderDetailsController,
    OrderTimelineController,
    TimeUpdateController,
    OrderHistoryController,
  ],
  providers: [
    OrdersService,
    OrderDetailsService,
    OrderTimelineService,
    TimeUpdateService,
    OrderHistoryService,
  ],
  exports: [
    OrdersService,
    OrderDetailsService,
    OrderTimelineService,
    TimeUpdateService,
    OrderHistoryService,
  ],
})
export class OrdersModule {}
