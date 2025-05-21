import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { User } from '@prisma/client';
import { CustomerNotification } from '@prisma/client';

@Injectable()
export class EmailService {
  constructor(private mailerService: MailerService) {}

  /**
   * Send a notification email to a user
   */
  async sendNotificationEmail(user: User, notification: CustomerNotification) {
    try {
      const url =
        notification.action_url || 'https://seeucafe.com/notifications';

      await this.mailerService.sendMail({
        to: user.email,
        subject: `SeeU Cafe: ${this.getNotificationSubject(notification.type)}`,
        template: 'notification',
        context: {
          firstName: user.first_name || 'Valued Customer',
          message: notification.message,
          notificationType: notification.type,
          url,
          orderId: notification.order_id,
        },
      });

      console.log(`Notification email sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('Failed to send notification email:', error);
      return false;
    }
  }

  /**
   * Send a batch of notifications
   */
  async sendBatchNotifications(
    users: User[],
    notification: CustomerNotification,
  ) {
    const results = await Promise.allSettled(
      users.map((user) => this.sendNotificationEmail(user, notification)),
    );

    return results;
  }

  /**
   * Get a friendly subject line based on notification type
   */
  private getNotificationSubject(type: string): string {
    switch (type) {
      case 'order_update':
        return 'Your Order Status Has Been Updated';
      case 'time_change':
        return 'Your Order Time Has Been Updated';
      case 'delivery_update':
        return 'Your Delivery Status Has Changed';
      case 'pickup_ready':
        return 'Your Order Is Ready for Pickup';
      case 'promotion':
        return 'New Promotion Available';
      case 'info':
      default:
        return 'Important Information';
    }
  }
}
