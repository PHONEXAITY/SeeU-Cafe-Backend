import { Module } from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { DeliveriesController } from './deliveries.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerNotificationsModule } from '../customer-notifications/customer-notifications.module';

@Module({
  imports: [PrismaModule, CustomerNotificationsModule],
  controllers: [DeliveriesController],
  providers: [DeliveriesService],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
