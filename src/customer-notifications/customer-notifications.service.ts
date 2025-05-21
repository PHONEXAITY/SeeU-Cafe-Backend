import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationsGateway } from './notifications.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { EmailService } from 'src/email/email.service';
import { Prisma } from '@prisma/client';

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
    switch (type) {
      case 'order_update':
        return 'ອັບເດດຄຳສັ່ງຊື້ສຳເລັດ';
      case 'time_change':
        return 'ເວລາຄຳສັ່ງຊື້ມີການປ່ຽນແປງ';
      case 'delivery_update':
        return 'ອັບເດດການຈັດສົ່ງ';
      case 'pickup_ready':
        return 'ຄຳສັ່ງຊື້ພ້ອມໃຫ້ຮັບແລ້ວ';
      case 'promotion':
        return 'ໂປໂມຊັ່ນໃໝ່';
      case 'order_confirmed':
        return 'ຢືນຢັນຄຳສັ່ງຊື້';
      case 'order_preparing':
        return 'ກຳລັງກະກຽມການສັ່ງຊື້';
      case 'order_cancelled':
        return 'ການສັ່ງຊື້ຖືກຍົກເລີກ';
      case 'order_unclaimed':
        return 'ຄຳສັ່ງຊື້ຍັງບໍ່ໄດ້ຮັບການຍອມຮັບ';
      case 'payment_status':
        return 'ສະຖານະການຊຳລະເງິນ';
      case 'new_order':
        return 'ມີຄຳສັ່ງຊື້ໃໝ່';
      case 'info':
      default:
        return 'ການແຈ້ງເຕືອນໃໝ່';
    }
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
      where: { id: id },
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
    console.log('Fetching notifications for user:', userId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const userRole = user.role ? user.role.name : null;
    console.log('User role:', userRole);

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

    const notifications = await this.prisma.customerNotification.findMany({
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

    console.log(
      `Found ${notifications.length} notifications for user ${userId}`,
    );

    return notifications;
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
