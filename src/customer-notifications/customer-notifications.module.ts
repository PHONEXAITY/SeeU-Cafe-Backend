import { Module } from '@nestjs/common';
import { CustomerNotificationsService } from './customer-notifications.service';
import { CustomerNotificationsController } from './customer-notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CustomerNotificationsController],
  providers: [CustomerNotificationsService, NotificationsGateway],
  exports: [CustomerNotificationsService, NotificationsGateway],
})
export class CustomerNotificationsModule {}
