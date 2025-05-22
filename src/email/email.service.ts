import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { User } from '@prisma/client';
import { CustomerNotification } from '@prisma/client';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private mailerService: MailerService) {}

  /**
   * Send a notification email to a user
   */
  async sendNotificationEmail(user: User, notification: CustomerNotification) {
    try {
      // Validate inputs
      if (!user || !user.email) {
        this.logger.warn('Cannot send email: User or user email is missing');
        return false;
      }

      if (!notification || !notification.message) {
        this.logger.warn(
          'Cannot send email: Notification or message is missing',
        );
        return false;
      }

      // Check if user has email notifications enabled
      if (user.email_notifications === false) {
        this.logger.log(`Email notifications disabled for user ${user.email}`);
        return false;
      }

      const url =
        notification.action_url || 'https://seeucafe.com/notifications';

      // Prepare template context
      const context = {
        firstName:
          user.first_name || user.email?.split('@')[0] || 'Valued Customer',
        message: notification.message,
        notificationType: notification.type,
        url,
        orderId: notification.order_id,
        year: new Date().getFullYear(),
        companyName: 'SeeU Cafe',
      };

      this.logger.log(`Sending notification email to ${user.email}`);
      this.logger.debug('Email context:', context);

      await this.mailerService.sendMail({
        to: user.email,
        subject: `SeeU Cafe: ${this.getNotificationSubject(notification.type)}`,
        template: 'notification', // This will look for notification.hbs
        context,
      });

      this.logger.log(
        `✅ Notification email sent successfully to ${user.email}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `❌ Failed to send notification email to ${user?.email}:`,
        error,
      );

      // Log more specific error information
      if (error.message?.includes('ENOENT')) {
        this.logger.error(
          'Email template file not found. Please check template configuration.',
        );
      } else if (error.message?.includes('Cannot destructure')) {
        this.logger.error(
          'Handlebars template compilation error. Check template syntax.',
        );
      } else if (error.code === 'EAUTH' || error.responseCode === 535) {
        this.logger.error(
          'SMTP authentication failed. Check email credentials.',
        );
      } else if (error.code === 'ECONNECTION') {
        this.logger.error(
          'SMTP connection failed. Check email server settings.',
        );
      }

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
    this.logger.log(`Sending batch notifications to ${users.length} users`);

    const results = await Promise.allSettled(
      users.map((user) => this.sendNotificationEmail(user, notification)),
    );

    // Log batch results
    const successful = results.filter(
      (r) => r.status === 'fulfilled' && r.value === true,
    ).length;
    const failed = results.length - successful;

    this.logger.log(
      `Batch notification results: ${successful} successful, ${failed} failed`,
    );

    if (failed > 0) {
      this.logger.warn(
        `Some notifications failed to send. Check logs for details.`,
      );
    }

    return results;
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration(testEmail: string) {
    try {
      this.logger.log(`Testing email configuration with ${testEmail}`);

      await this.mailerService.sendMail({
        to: testEmail,
        subject: 'SeeU Cafe: Email Configuration Test',
        template: 'notification',
        context: {
          firstName: 'Test User',
          message:
            'This is a test email to verify email configuration is working correctly.',
          notificationType: 'info',
          url: 'https://seeucafe.com',
          orderId: null,
          year: new Date().getFullYear(),
          companyName: 'SeeU Cafe',
        },
      });

      this.logger.log(`✅ Test email sent successfully to ${testEmail}`);
      return { success: true, message: 'Test email sent successfully' };
    } catch (error) {
      this.logger.error(`❌ Test email failed:`, error);
      return {
        success: false,
        message: error.message || 'Test email failed',
        error: error.code || 'UNKNOWN_ERROR',
      };
    }
  }

  /**
   * Get a friendly subject line based on notification type
   */
  private getNotificationSubject(type: string): string {
    const subjectMap: Record<string, string> = {
      // Order status notifications
      order_update: 'Your Order Status Has Been Updated',
      time_change: 'Your Order Time Has Been Updated',
      order_confirmed: 'Order Confirmation',
      order_preparing: 'Your Order is Being Prepared',
      order_ready: 'Your Order is Ready',
      order_completed: 'Your Order Has Been Completed',
      order_cancelled: 'Your Order Has Been Cancelled',
      order_unclaimed: 'Your Order is Waiting for Pickup',
      order_delivered: 'Your Order Has Been Delivered',

      // Delivery notifications
      delivery_update: 'Delivery Status Update',
      delivery_assigned: 'Delivery Driver Assigned',
      delivery_started: 'Your Delivery is on the Way',
      delivery_delayed: 'Your Delivery is Delayed',
      delivery_arrived: 'Your Delivery Has Arrived',

      // Pickup notifications
      pickup_ready: 'Your Order Is Ready for Pickup',
      pickup_reminder: 'Reminder: Your Order is Waiting for Pickup',

      // Other notifications
      payment_status: 'Payment Status Update',
      new_order: 'New Order Received',
      promotion: 'New Promotion Available',
      info: 'Important Information',
    };

    return subjectMap[type] || 'Important Information';
  }
}
