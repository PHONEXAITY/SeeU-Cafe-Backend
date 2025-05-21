import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webPush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  vibrate?: number[];
  sound?: string;
  data?: any;
  actions?: { action: string; title: string }[];
  tag?: string;
  renotify?: boolean;
  requireInteraction?: boolean;
  silent?: boolean;
  timestamp?: number;
}

interface SubscriptionRecord {
  id: number;
  user_id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

@Injectable()
export class PushNotificationsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    // Initialize web-push with VAPID keys
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');

    if (!publicKey || !privateKey) {
      console.warn('VAPID keys not set. Push notifications will not work.');
      return;
    }

    webPush.setVapidDetails(
      'mailto:' +
        this.configService.get<string>(
          'VAPID_SUBJECT',
          'example@yourdomain.com',
        ),
      publicKey,
      privateKey,
    );
  }

  // Store a new subscription for a user
  async saveSubscription(
    userId: number,
    subscription: PushSubscription,
  ): Promise<void> {
    await this.prisma.pushSubscription.create({
      data: {
        user: { connect: { id: userId } },
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  // Remove a subscription
  async removeSubscription(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint },
    });
  }

  // Send push notification to a specific user
  async sendNotificationToUser(
    userId: number,
    payload: PushNotificationPayload,
  ): Promise<PromiseSettledResult<webPush.SendResult>[]> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { user_id: userId },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.sendToSubscriptions(subscriptions, payload);
  }

  // Send notifications to users with specific roles
  async sendNotificationToRoles(
    roles: string[],
    payload: PushNotificationPayload,
  ): Promise<PromiseSettledResult<webPush.SendResult>[]> {
    const users = await this.prisma.user.findMany({
      where: {
        role: { name: { in: roles } },
      },
      select: { id: true },
    });

    const userIds = users.map((user) => user.id);
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { user_id: { in: userIds } },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.sendToSubscriptions(subscriptions, payload);
  }

  // Send a broadcast notification to all users
  async sendBroadcastNotification(
    payload: PushNotificationPayload,
  ): Promise<PromiseSettledResult<webPush.SendResult>[]> {
    const subscriptions = await this.prisma.pushSubscription.findMany();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.sendToSubscriptions(subscriptions, payload);
  }

  // Helper method to send to multiple subscriptions
  private async sendToSubscriptions(
    subscriptions: SubscriptionRecord[],
    payload: PushNotificationPayload,
  ): Promise<PromiseSettledResult<webPush.SendResult>[]> {
    const results = await Promise.allSettled(
      subscriptions.map((subscription) => {
        const pushSubscription: webPush.PushSubscription = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        };

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return webPush.sendNotification(
          pushSubscription,
          JSON.stringify(payload),
        );
      }),
    );

    // Handle expired or invalid subscriptions
    await Promise.all(
      results.map(async (result, index) => {
        if (
          result.status === 'rejected' &&
          (result.reason?.statusCode === 404 ||
            result.reason?.statusCode === 410)
        ) {
          // Subscription is no longer valid, remove it
          await this.removeSubscription(subscriptions[index].endpoint);
        }
      }),
    );

    return results;
  }
}
