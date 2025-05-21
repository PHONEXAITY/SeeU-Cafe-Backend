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
    // ประเภทการแจ้งเตือนเกี่ยวกับการอัพเดทสถานะออเดอร์
    switch (type) {
      case 'order_update':
        return 'Your Order Status Has Been Updated';
      case 'time_change':
        return 'Your Order Time Has Been Updated';
      case 'order_confirmed':
        return 'Order Confirmation';
      case 'order_preparing':
        return 'Your Order is Being Prepared';
      case 'order_ready':
        return 'Your Order is Ready';
      case 'order_completed':
        return 'Your Order Has Been Completed';
      case 'order_cancelled':
        return 'Your Order Has Been Cancelled';
      case 'order_unclaimed':
        return 'Your Order is Waiting for Pickup';
      case 'order_delivered':
        return 'Your Order Has Been Delivered';

      // ประเภทการแจ้งเตือนเกี่ยวกับการจัดส่ง
      case 'delivery_update':
        return 'Delivery Status Update';
      case 'delivery_assigned':
        return 'Delivery Driver Assigned';
      case 'delivery_started':
        return 'Your Delivery is on the Way';
      case 'delivery_delayed':
        return 'Your Delivery is Delayed';
      case 'delivery_arrived':
        return 'Your Delivery Has Arrived';

      // ประเภทการแจ้งเตือนเกี่ยวกับการรับสินค้า
      case 'pickup_ready':
        return 'Your Order Is Ready for Pickup';
      case 'pickup_reminder':
        return 'Reminder: Your Order is Waiting for Pickup';

      // ประเภทการแจ้งเตือนอื่นๆ
      case 'payment_status':
        return 'Payment Status Update';
      case 'new_order':
        return 'New Order Received';
      case 'promotion':
        return 'New Promotion Available';
      case 'info':
      default:
        return 'Important Information';
    }
  }
}
