import { Module } from '@nestjs/common';
import { CustomerNotificationsService } from './customer-notifications.service';
import { CustomerNotificationsController } from './customer-notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, PushNotificationsModule, EmailModule],
  controllers: [CustomerNotificationsController],
  providers: [CustomerNotificationsService, NotificationsGateway],
  exports: [CustomerNotificationsService, NotificationsGateway],
})
export class CustomerNotificationsModule {}
