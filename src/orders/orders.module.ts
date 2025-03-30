import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrderDetailsService } from './order-details/order-details.service';
import { OrderDetailsController } from './order-details/order-details.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OrdersController, OrderDetailsController],
  providers: [OrdersService, OrderDetailsService],
  exports: [OrdersService, OrderDetailsService],
})
export class OrdersModule {}
