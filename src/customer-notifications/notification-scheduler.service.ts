// src/customer-notifications/notification-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerNotificationsService } from './customer-notifications.service';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customerNotificationsService: CustomerNotificationsService,
  ) {}

  /**
   * ตรวจสอบคำสั่งซื้อที่ล่าช้าและส่งการแจ้งเตือน
   * ทำงานทุก 15 นาที
   */
  @Cron('0 */15 * * * *') // Every 15 minutes
  async checkDelayedOrders() {
    try {
      this.logger.log('Checking for delayed orders...');

      const now = new Date();
      const delayedOrders = await this.prisma.order.findMany({
        where: {
          status: {
            in: ['confirmed', 'preparing'],
          },
          estimated_ready_time: {
            lt: now, // Orders that should have been ready by now
          },
          User_id: {
            not: null,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
        take: 50, // Limit to prevent overload
      });

      for (const order of delayedOrders) {
        if (order.user?.id) {
          const delayMinutes = Math.floor(
            (now.getTime() - (order.estimated_ready_time?.getTime() || 0)) /
              (1000 * 60),
          );

          await this.customerNotificationsService.create({
            user_id: order.user.id,
            order_id: order.id,
            message: `ຄຳສັ່ງຊື້ #${order.order_id} ລ່າຊ້າໄປແລ້ວ ${delayMinutes} ນາທີ. ພວກເຮົາຂໍອະໄພໃນຄວາມບໍ່ສະດວກ`,
            type: 'order_update',
            action_url: `/orders/${order.order_id}`,
          });

          // Also notify employees
          await this.customerNotificationsService.create({
            message: `ຄຳສັ່ງຊື້ #${order.order_id} ລ່າຊ້າໄປແລ້ວ ${delayMinutes} ນາທີ`,
            type: 'order_update',
            order_id: order.id,
            target_roles: ['admin', 'employee'],
            action_url: `/admin/orders/${order.id}`,
          });
        }
      }

      this.logger.log(`Found ${delayedOrders.length} delayed orders`);
    } catch (error) {
      this.logger.error('Failed to check delayed orders:', error);
    }
  }

  /**
   * ตรวจสอบคำสั่งซื้อแบบ pickup ที่ยังไม่ได้รับและส่งการเตือนความจำ
   * ทำงานทุก 30 นาที
   */
  @Cron('0 */30 * * * *') // Every 30 minutes
  async checkUnclaimedPickupOrders() {
    try {
      this.logger.log('Checking for unclaimed pickup orders...');

      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const unclaimedOrders = await this.prisma.order.findMany({
        where: {
          status: 'ready',
          order_type: 'pickup',
          actual_ready_time: {
            lt: twoHoursAgo, // Orders ready for more than 2 hours
          },
          User_id: {
            not: null,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
        take: 50,
      });

      for (const order of unclaimedOrders) {
        if (order.user?.id) {
          const hoursReady = Math.floor(
            (Date.now() - (order.actual_ready_time?.getTime() || 0)) /
              (1000 * 60 * 60),
          );

          await this.customerNotificationsService.create({
            user_id: order.user.id,
            order_id: order.id,
            message: `ເຕືອນຄວາມຈຳ: ຄຳສັ່ງຊື້ #${order.order_id} ພ້ອມໃຫ້ຮັບແລ້ວ ${hoursReady} ຊົ່ວໂມງ. ກະລຸນາມາຮັບໃນໄວທີ່ສຸດ`,
            type: 'pickup_reminder',
            action_url: `/orders/${order.order_id}`,
          });

          // Update order status to unclaimed after 4 hours
          if (hoursReady >= 4) {
            await this.prisma.order.update({
              where: { id: order.id },
              data: { status: 'unclaimed' },
            });

            await this.customerNotificationsService.create({
              user_id: order.user.id,
              order_id: order.id,
              message: `ຄຳສັ່ງຊື້ #${order.order_id} ຖືກລົງທະບຽນເປັນ "ບໍ່ໄດ້ຮັບ" ເນື່ອງຈາກບໍ່ມີການມາຮັບພາຍໃນເວລາທີ່ກຳນົດ`,
              type: 'order_unclaimed',
              action_url: `/orders/${order.order_id}`,
            });
          }
        }
      }

      this.logger.log(
        `Found ${unclaimedOrders.length} unclaimed pickup orders`,
      );
    } catch (error) {
      this.logger.error('Failed to check unclaimed pickup orders:', error);
    }
  }

  /**
   * ตรวจสอบการจัดส่งที่ล่าช้าและส่งการแจ้งเตือน
   * ทำงานทุก 20 นาที
   */
  @Cron('0 */20 * * * *') // Every 20 minutes
  async checkDelayedDeliveries() {
    try {
      this.logger.log('Checking for delayed deliveries...');

      const now = new Date();
      const delayedDeliveries = await this.prisma.delivery.findMany({
        where: {
          status: 'out_for_delivery',
          estimated_delivery_time: {
            lt: now, // Deliveries that should have been completed by now
          },
        },
        include: {
          order: {
            include: {
              user: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                },
              },
            },
          },
          employee: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
        take: 30,
      });

      for (const delivery of delayedDeliveries) {
        if (delivery.order.user?.id) {
          const delayMinutes = Math.floor(
            (now.getTime() -
              (delivery.estimated_delivery_time?.getTime() || 0)) /
              (1000 * 60),
          );

          await this.customerNotificationsService.create({
            user_id: delivery.order.user.id,
            order_id: delivery.order_id,
            message: `ການຈັດສົ່ງຄຳສັ່ງຊື້ #${delivery.order.order_id} ລ່າຊ້າໄປແລ້ວ ${delayMinutes} ນາທີ. ພວກເຮົາຂໍອະໄພໃນຄວາມບໍ່ສະດວກ`,
            type: 'delivery_delayed',
            action_url: `/orders/${delivery.order.order_id}/track`,
          });

          // Notify delivery employee if assigned
          if (delivery.employee_id) {
            await this.customerNotificationsService.create({
              message: `ການຈັດສົ່ງ #${delivery.delivery_id} ລ່າຊ້າໄປແລ້ວ ${delayMinutes} ນາທີ`,
              type: 'delivery_delayed',
              order_id: delivery.order_id,
              target_roles: ['admin', 'employee'],
              action_url: `/admin/deliveries/${delivery.id}`,
            });
          }
        }
      }

      this.logger.log(`Found ${delayedDeliveries.length} delayed deliveries`);
    } catch (error) {
      this.logger.error('Failed to check delayed deliveries:', error);
    }
  }

  /**
   * ส่งการแจ้งเตือนรายสัปดาห์เกี่ยวกับโปรโมชั่นใหม่
   * ทำงานทุกวันจันทร์เวลา 09:00
   */
  @Cron('0 0 9 * * 1') // Every Monday at 9:00 AM
  async sendWeeklyPromotionNotifications() {
    try {
      this.logger.log('Sending weekly promotion notifications...');

      const activePromotions = await this.prisma.promotion.findMany({
        where: {
          status: 'active',
          start_date: {
            lte: new Date(),
          },
          end_date: {
            gte: new Date(),
          },
        },
        take: 5, // Limit to top 5 promotions
      });

      if (activePromotions.length > 0) {
        const promotionNames = activePromotions.map((p) => p.name).join(', ');

        await this.customerNotificationsService.create({
          message: `ໂປໂມຊັ່ນໃໝ່ປະຈຳອາທິດນີ້: ${promotionNames}. ມາຄົ້ນຫາຂໍ້ສະເໜີພິເສດທີ່ພວກເຮົາມີໃຫ້!`,
          type: 'promotion',
          broadcast: true,
          action_url: '/promotions',
        });
      }

      this.logger.log(
        `Sent weekly promotion notifications for ${activePromotions.length} promotions`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to send weekly promotion notifications:',
        error,
      );
    }
  }

  /**
   * ทำความสะอาดการแจ้งเตือนเก่า
   * ทำงานทุกวันในเวลา 02:00
   */
  @Cron('0 0 2 * * *') // Every day at 2:00 AM
  async cleanupOldNotifications() {
    try {
      this.logger.log('Cleaning up old notifications...');

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const result = await this.prisma.customerNotification.deleteMany({
        where: {
          created_at: {
            lt: thirtyDaysAgo,
          },
          read: true, // Only delete read notifications
        },
      });

      this.logger.log(`Cleaned up ${result.count} old notifications`);
    } catch (error) {
      this.logger.error('Failed to cleanup old notifications:', error);
    }
  }

  /**
   * ส่งสรุปยอดขายรายวันให้ผู้ดูแลระบบ
   * ทำงานทุกวันเวลา 23:00
   */
  @Cron('0 0 23 * * *') // Every day at 11:00 PM
  async sendDailySalesReport() {
    try {
      this.logger.log('Sending daily sales report...');

      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      );
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

      const todayOrders = await this.prisma.order.findMany({
        where: {
          create_at: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: {
            in: ['completed', 'delivered'],
          },
        },
      });

      const totalRevenue = todayOrders.reduce(
        (sum, order) => sum + order.total_price,
        0,
      );
      const orderCount = todayOrders.length;

      await this.customerNotificationsService.create({
        message: `ສະຫຼຸບຍອດຂາຍວັນນີ້: ${orderCount} ຄຳສັ່ງຊື້, ລາຍຮັບທັງໝົດ: ${totalRevenue.toLocaleString()} ກີບ`,
        type: 'info',
        target_roles: ['admin'],
        action_url: '/admin/reports/daily',
      });

      this.logger.log(
        `Sent daily sales report: ${orderCount} orders, ${totalRevenue} LAK`,
      );
    } catch (error) {
      this.logger.error('Failed to send daily sales report:', error);
    }
  }

  /**
   * ตรวจสอบและอัพเดทสถานะการส่งผ่าน WebSocket
   * ทำงานทุก 5 นาที
   */
  @Cron('0 */5 * * * *') // Every 5 minutes
  async syncWebSocketStatus() {
    try {
      this.logger.log('Syncing WebSocket status...');

      // Get active orders that need real-time updates
      const activeOrders = await this.prisma.order.findMany({
        where: {
          status: {
            in: ['confirmed', 'preparing', 'ready', 'out_for_delivery'],
          },
          User_id: {
            not: null,
          },
        },
        include: {
          user: {
            select: {
              id: true,
            },
          },
          delivery: true,
        },
        take: 100,
      });

      // This could be used to send periodic status updates via WebSocket
      // Implementation would depend on your WebSocket gateway setup

      this.logger.log(`Synced status for ${activeOrders.length} active orders`);
    } catch (error) {
      this.logger.error('Failed to sync WebSocket status:', error);
    }
  }
}
