import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateNotificationDto,
  NotificationType,
} from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationsGateway } from './notifications.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { EmailService } from '../email/email.service';
import { Prisma, Order } from '@prisma/client';

@Injectable()
export class CustomerNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly pushNotificationsService: PushNotificationsService,
    private readonly emailService: EmailService,
  ) {}

  async create(createNotificationDto: CreateNotificationDto) {
    if (createNotificationDto.user_id) {
      const user = await this.prisma.user.findUnique({
        where: { id: createNotificationDto.user_id },
      });
      if (!user) {
        throw new NotFoundException(
          `User with ID ${createNotificationDto.user_id} not found`,
        );
      }
    }

    if (createNotificationDto.order_id) {
      const order = await this.prisma.order.findUnique({
        where: { id: createNotificationDto.order_id },
      });
      if (!order) {
        throw new NotFoundException(
          `Order with ID ${createNotificationDto.order_id} not found`,
        );
      }
    }

    if (createNotificationDto.target_roles?.length) {
      const roles = await this.prisma.role.findMany({
        where: { name: { in: createNotificationDto.target_roles } },
      });
      if (roles.length !== createNotificationDto.target_roles.length) {
        throw new NotFoundException('One or more roles not found');
      }
    }

    const notificationData: Prisma.CustomerNotificationCreateInput = {
      user: createNotificationDto.user_id
        ? { connect: { id: createNotificationDto.user_id } }
        : undefined,
      order: createNotificationDto.order_id
        ? { connect: { id: createNotificationDto.order_id } }
        : undefined,
      message: createNotificationDto.message,
      type: createNotificationDto.type,
      action_url: createNotificationDto.action_url,
      read: createNotificationDto.read ?? false,
      target_roles: createNotificationDto.target_roles ?? [],
      broadcast: createNotificationDto.broadcast ?? false,
    };

    const notification = await this.prisma.customerNotification.create({
      data: notificationData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (createNotificationDto.broadcast) {
      this.notificationsGateway.sendNotificationToAll(notification);

      await this.pushNotificationsService.sendBroadcastNotification({
        title: this.getNotificationTitle(notification.type),
        body: notification.message,
        icon: '/logo.png',
        badge: '/badge.png',
        data: {
          url: notification.action_url || '/notifications',
          notificationId: notification.id,
        },
      });

      const users = await this.prisma.user.findMany({
        where: { email_notifications: true },
      });
      await this.emailService.sendBatchNotifications(users, notification);
    } else if (createNotificationDto.target_roles?.length) {
      const users = await this.prisma.user.findMany({
        where: {
          role: { name: { in: createNotificationDto.target_roles } },
        },
      });

      users.forEach((user) => {
        this.notificationsGateway.sendNotificationToUser(user.id, notification);
      });

      await this.pushNotificationsService.sendNotificationToRoles(
        createNotificationDto.target_roles,
        {
          title: this.getNotificationTitle(notification.type),
          body: notification.message,
          icon: '/logo.png',
          badge: '/badge.png',
          data: {
            url: notification.action_url || '/notifications',
            notificationId: notification.id,
          },
        },
      );

      const usersWithEmailEnabled = await this.prisma.user.findMany({
        where: {
          role: { name: { in: createNotificationDto.target_roles } },
          email_notifications: true,
        },
      });
      await this.emailService.sendBatchNotifications(
        usersWithEmailEnabled,
        notification,
      );
    } else if (createNotificationDto.user_id) {
      this.notificationsGateway.sendNotificationToUser(
        createNotificationDto.user_id,
        notification,
      );

      await this.pushNotificationsService.sendNotificationToUser(
        createNotificationDto.user_id,
        {
          title: this.getNotificationTitle(notification.type),
          body: notification.message,
          icon: '/logo.png',
          badge: '/badge.png',
          data: {
            url: notification.action_url || '/notifications',
            notificationId: notification.id,
          },
        },
      );

      const user = await this.prisma.user.findUnique({
        where: { id: createNotificationDto.user_id },
      });

      if (user && user.email_notifications) {
        await this.emailService.sendNotificationEmail(user, notification);
      }
    }

    return notification;
  }

  private getNotificationTitle(type: string): string {
    // Using a mapping approach to avoid direct enum comparisons
    const titleMap: Record<string, string> = {
      [NotificationType.ORDER_UPDATE]: 'ອັບເດດຄຳສັ່ງຊື້ສຳເລັດ',
      [NotificationType.TIME_CHANGE]: 'ເວລາຄຳສັ່ງຊື້ມີການປ່ຽນແປງ',
      [NotificationType.ORDER_CONFIRMED]: 'ຢືນຢັນຄຳສັ່ງຊື້',
      [NotificationType.ORDER_PREPARING]: 'ກຳລັງກະກຽມການສັ່ງຊື້',
      [NotificationType.ORDER_READY]: 'ຄຳສັ່ງຊື້ພ້ອມແລ້ວ',
      [NotificationType.ORDER_COMPLETED]: 'ຄຳສັ່ງຊື້ສຳເລັດແລ້ວ',
      [NotificationType.ORDER_CANCELLED]: 'ການສັ່ງຊື້ຖືກຍົກເລີກ',
      [NotificationType.ORDER_UNCLAIMED]: 'ຄຳສັ່ງຊື້ຍັງບໍ່ໄດ້ຮັບການຍອມຮັບ',
      [NotificationType.ORDER_DELIVERED]: 'ຄຳສັ່ງຊື້ຖືກຈັດສົ່ງແລ້ວ',
      [NotificationType.DELIVERY_UPDATE]: 'ອັບເດດການຈັດສົ່ງ',
      [NotificationType.DELIVERY_ASSIGNED]: 'ມອບໝາຍພະນັກງານຈັດສົ່ງແລ້ວ',
      [NotificationType.DELIVERY_STARTED]: 'ເລີ່ມການຈັດສົ່ງແລ້ວ',
      [NotificationType.DELIVERY_DELAYED]: 'ການຈັດສົ່ງລ່າຊ້າ',
      [NotificationType.DELIVERY_ARRIVED]: 'ພະນັກງານຈັດສົ່ງມາຮອດແລ້ວ',
      [NotificationType.PICKUP_READY]: 'ຄຳສັ່ງຊື້ພ້ອມໃຫ້ຮັບແລ້ວ',
      [NotificationType.PICKUP_REMINDER]:
        'ເຕືອນຄວາມຈໍາ: ຄຳສັ່ງຊື້ຂອງທ່ານລໍຖ້າໃຫ້ມາຮັບ',
      [NotificationType.PAYMENT_STATUS]: 'ສະຖານະການຊຳລະເງິນ',
      [NotificationType.NEW_ORDER]: 'ມີຄຳສັ່ງຊື້ໃໝ່',
      [NotificationType.PROMOTION]: 'ໂປໂມຊັ່ນໃໝ່',
      [NotificationType.INFO]: 'ການແຈ້ງເຕືອນໃໝ່',
    };

    return titleMap[type] || 'ການແຈ້ງເຕືອນໃໝ່';
  }

  async createOrderStatusNotification(
    order: Order,
    status: string,
    additionalMessage?: string,
  ) {
    const orderWithUser = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: { user: true },
    });

    if (!orderWithUser) {
      throw new NotFoundException(`Order with ID ${order.id} not found`);
    }

    // Map status string to notification type
    const statusToTypeMap: Record<string, string> = {
      confirmed: NotificationType.ORDER_CONFIRMED,
      preparing: NotificationType.ORDER_PREPARING,
      ready: NotificationType.ORDER_READY,
      completed: NotificationType.ORDER_COMPLETED,
      cancelled: NotificationType.ORDER_CANCELLED,
      unclaimed: NotificationType.ORDER_UNCLAIMED,
      pickup_ready: NotificationType.PICKUP_READY,
      delivered: NotificationType.ORDER_DELIVERED,
    };

    const type = statusToTypeMap[status] || NotificationType.ORDER_UPDATE;
    let message = '';
    const actionUrl = `/orders/${order.order_id}`;

    // Map status to appropriate message
    const statusToMessageMap: Record<string, string> = {
      confirmed: `ຄຳສັ່ງຊື້ #${order.order_id} ໄດ້ຮັບການຢືນຢັນແລ້ວ`,
      preparing: `ກຳລັງກະກຽມຄຳສັ່ງຊື້ #${order.order_id}`,
      ready: `ຄຳສັ່ງຊື້ #${order.order_id} ພ້ອມແລ້ວ`,
      completed: `ຄຳສັ່ງຊື້ #${order.order_id} ສຳເລັດແລ້ວ`,
      cancelled: `ຄຳສັ່ງຊື້ #${order.order_id} ຖືກຍົກເລີກ`,
      unclaimed: `ຄຳສັ່ງຊື້ #${order.order_id} ຍັງລໍຖ້າທ່ານມາຮັບ`,
      pickup_ready: `ຄຳສັ່ງຊື້ #${order.order_id} ພ້ອມໃຫ້ທ່ານມາຮັບແລ້ວ`,
      delivered: `ຄຳສັ່ງຊື້ #${order.order_id} ໄດ້ຖືກຈັດສົ່ງຮອດທ່ານແລ້ວ`,
    };

    message =
      statusToMessageMap[status] ||
      `ອັບເດດຄຳສັ່ງຊື້ #${order.order_id}: ${status}`;

    if (additionalMessage) {
      message = `${message}. ${additionalMessage}`;
    }

    if (orderWithUser.user?.id) {
      const notificationData: CreateNotificationDto = {
        user_id: orderWithUser.user.id,
        order_id: order.id,
        message,
        type,
        action_url: actionUrl,
      };

      return this.create(notificationData);
    }

    return null;
  }

  async createOrderTimeChangeNotification(
    order: Order,
    previousTime: Date,
    newTime: Date,
    reason?: string,
  ) {
    const orderWithUser = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: { user: true },
    });

    if (!orderWithUser) {
      throw new NotFoundException(`Order with ID ${order.id} not found`);
    }

    const timeDiffInMinutes = Math.round(
      (newTime.getTime() - previousTime.getTime()) / (1000 * 60),
    );

    let timeDiffMessage = '';
    if (timeDiffInMinutes > 0) {
      timeDiffMessage = `ຖືກເລື່ອນອອກໄປອີກ ${timeDiffInMinutes} ນາທີ`;
    } else if (timeDiffInMinutes < 0) {
      timeDiffMessage = `ເລື່ອນໄວຂຶ້ນ ${Math.abs(timeDiffInMinutes)} ນາທີ`;
    }

    let message = `ເວລາຄຳສັ່ງຊື້ #${order.order_id} ${timeDiffMessage}`;

    if (reason) {
      message = `${message}. ສາເຫດ: ${reason}`;
    }

    const actionUrl = `/orders/${order.order_id}`;

    if (orderWithUser.user?.id) {
      const notificationData: CreateNotificationDto = {
        user_id: orderWithUser.user.id,
        order_id: order.id,
        message,
        type: NotificationType.TIME_CHANGE,
        action_url: actionUrl,
      };

      return this.create(notificationData);
    }

    return null;
  }

  async createDeliveryNotification(
    order: Order,
    status: string,
    additionalInfo?: string,
  ) {
    const orderWithUser = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: { user: true, delivery: true },
    });

    if (!orderWithUser) {
      throw new NotFoundException(`Order with ID ${order.id} not found`);
    }

    // Map status string to notification type
    const statusToTypeMap: Record<string, string> = {
      assigned: NotificationType.DELIVERY_ASSIGNED,
      started: NotificationType.DELIVERY_STARTED,
      delayed: NotificationType.DELIVERY_DELAYED,
      arrived: NotificationType.DELIVERY_ARRIVED,
    };

    const type = statusToTypeMap[status] || NotificationType.DELIVERY_UPDATE;

    // Map status to appropriate message
    const statusToMessageMap: Record<string, string> = {
      assigned: `ພະນັກງານຈັດສົ່ງໄດ້ຮັບມອບໝາຍໃຫ້ສົ່ງຄຳສັ່ງຊື້ #${order.order_id} ຂອງທ່ານແລ້ວ`,
      started: `ການຈັດສົ່ງຄຳສັ່ງຊື້ #${order.order_id} ໄດ້ເລີ່ມຕົ້ນແລ້ວ`,
      delayed: `ການຈັດສົ່ງຄຳສັ່ງຊື້ #${order.order_id} ອາດຈະຊ້າກວ່າກຳນົດ`,
      arrived: `ພະນັກງານຈັດສົ່ງມາຮອດຈຸດນັດໝາຍຂອງຄຳສັ່ງຊື້ #${order.order_id} ແລ້ວ`,
    };

    const message =
      statusToMessageMap[status] ||
      `ອັບເດດການຈັດສົ່ງຄຳສັ່ງຊື້ #${order.order_id}: ${status}`;
    const actionUrl = `/orders/${order.order_id}`;

    const finalMessage = additionalInfo
      ? `${message}. ${additionalInfo}`
      : message;

    if (orderWithUser.user?.id) {
      const notificationData: CreateNotificationDto = {
        user_id: orderWithUser.user.id,
        order_id: order.id,
        message: finalMessage,
        type,
        action_url: actionUrl,
      };

      return this.create(notificationData);
    }

    return null;
  }

  async createPaymentStatusNotification(order: Order, status: string) {
    const orderWithUser = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: { user: true },
    });

    if (!orderWithUser) {
      throw new NotFoundException(`Order with ID ${order.id} not found`);
    }

    // Map status to appropriate message
    const statusToMessageMap: Record<string, string> = {
      confirmed: `ການຊຳລະເງິນສຳລັບຄຳສັ່ງຊື້ #${order.order_id} ໄດ້ຮັບການຢືນຢັນແລ້ວ`,
      pending: `ລໍຖ້າການຊຳລະເງິນສຳລັບຄຳສັ່ງຊື້ #${order.order_id}`,
      failed: `ການຊຳລະເງິນສຳລັບຄຳສັ່ງຊື້ #${order.order_id} ລົ້ມເຫລວ`,
      refunded: `ທ່ານໄດ້ຮັບເງິນຄືນສຳລັບຄຳສັ່ງຊື້ #${order.order_id}`,
    };

    const message =
      statusToMessageMap[status] ||
      `ສະຖານະການຊຳລະເງິນສຳລັບຄຳສັ່ງຊື້ #${order.order_id}: ${status}`;
    const actionUrl = `/orders/${order.order_id}`;

    if (orderWithUser.user?.id) {
      const notificationData: CreateNotificationDto = {
        user_id: orderWithUser.user.id,
        order_id: order.id,
        message,
        type: NotificationType.PAYMENT_STATUS,
        action_url: actionUrl,
      };

      return this.create(notificationData);
    }

    return null;
  }

  async createPickupReminderNotification(order: Order) {
    const orderWithUser = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: { user: true },
    });

    if (!orderWithUser || !orderWithUser.user?.id) {
      return null;
    }

    const message = `ເຕືອນຄວາມຈໍາ: ຄຳສັ່ງຊື້ #${order.order_id} ຂອງທ່ານຍັງລໍຖ້າທ່ານຢູ່ທີ່ຮ້ານ`;
    const actionUrl = `/orders/${order.order_id}`;

    const notificationData: CreateNotificationDto = {
      user_id: orderWithUser.user.id,
      order_id: order.id,
      message,
      type: NotificationType.PICKUP_REMINDER,
      action_url: actionUrl,
    };

    return this.create(notificationData);
  }

  async findAll(
    userId?: number,
    read?: boolean,
    type?: string,
    includeBroadcast = false,
  ) {
    const where: Prisma.CustomerNotificationWhereInput = {};

    if (userId) {
      if (includeBroadcast) {
        where.OR = [{ user_id: userId }, { broadcast: true }];
      } else {
        where.user_id = userId;
      }
    }

    if (read !== undefined) {
      where.read = read;
    }

    if (type) {
      where.type = type;
    }

    return this.prisma.customerNotification.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const notification = await this.prisma.customerNotification.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return notification;
  }

  async findAllByUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const userRole = user.role ? user.role.name : null;

    const orConditions: Prisma.CustomerNotificationWhereInput[] = [
      { user_id: userId },
      { broadcast: true },
    ];

    if (userRole) {
      orConditions.push({
        target_roles: {
          has: userRole,
        },
      });
    }

    return this.prisma.customerNotification.findMany({
      where: {
        OR: orConditions,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findAllBroadcast() {
    return this.prisma.customerNotification.findMany({
      where: {
        broadcast: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findByRoles(roles: string[]) {
    return this.prisma.customerNotification.findMany({
      where: {
        target_roles: {
          hasSome: roles,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findUnreadByUser(userId: number, includeBroadcast = false) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const where: Prisma.CustomerNotificationWhereInput = {
      read: false,
    };

    if (includeBroadcast) {
      where.OR = [{ user_id: userId }, { broadcast: true }];
    } else {
      where.user_id = userId;
    }

    return this.prisma.customerNotification.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async update(id: number, updateNotificationDto: UpdateNotificationDto) {
    await this.findOne(id);

    const updateData: Prisma.CustomerNotificationUpdateInput = {
      user: updateNotificationDto.user_id
        ? { connect: { id: updateNotificationDto.user_id } }
        : undefined,
      order: updateNotificationDto.order_id
        ? { connect: { id: updateNotificationDto.order_id } }
        : undefined,
      message: updateNotificationDto.message,
      type: updateNotificationDto.type,
      action_url: updateNotificationDto.action_url,
      read: updateNotificationDto.read,
      target_roles: updateNotificationDto.target_roles,
      broadcast: updateNotificationDto.broadcast,
    };

    return this.prisma.customerNotification.update({
      where: { id },
      data: updateData,
    });
  }

  async markAsRead(id: number) {
    await this.findOne(id);

    return this.prisma.customerNotification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    await this.prisma.customerNotification.updateMany({
      where: {
        user_id: userId,
        read: false,
      },
      data: { read: true },
    });

    return { message: `All notifications for user ${userId} marked as read` };
  }

  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.customerNotification.delete({
      where: { id },
    });

    return { message: 'Notification deleted successfully' };
  }

  async removeAllByUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const result = await this.prisma.customerNotification.deleteMany({
      where: { user_id: userId },
    });

    return {
      message: `${result.count} notifications for user ${userId} deleted successfully`,
      count: result.count,
    };
  }
}
