import { Module } from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { DeliveriesController } from './deliveries.controller';
import { SimpleDeliveryFeeService } from './services/simple-delivery-fee.service'; 
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerNotificationsModule } from '../customer-notifications/customer-notifications.module';

@Module({
  imports: [PrismaModule, CustomerNotificationsModule],
  controllers: [DeliveriesController],
  providers: [DeliveriesService,
    SimpleDeliveryFeeService,
  ],
  exports: [DeliveriesService,
    SimpleDeliveryFeeService,
  ],
})
export class DeliveriesModule {}
