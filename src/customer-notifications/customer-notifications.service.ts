import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationsGateway } from './notifications.gateway';
import { Prisma } from '@prisma/client';

@Injectable()
export class CustomerNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(createNotificationDto: CreateNotificationDto) {
    // Validate user if user_id is provided
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

    // Validate order if order_id is provided
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

    // Validate target_roles if provided
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

    // Handle notification distribution
    if (createNotificationDto.broadcast) {
      this.notificationsGateway.sendNotificationToAll(notification);
    } else if (createNotificationDto.target_roles?.length) {
      const users = await this.prisma.user.findMany({
        where: {
          role: { name: { in: createNotificationDto.target_roles } },
        },
      });
      users.forEach((user) => {
        this.notificationsGateway.sendNotificationToUser(user.id, notification);
      });
    } else if (createNotificationDto.user_id) {
      this.notificationsGateway.sendNotificationToUser(
        createNotificationDto.user_id,
        notification,
      );
    }

    return notification;
  }

  async findAll(userId?: number, read?: boolean, type?: string) {
    const where: Prisma.CustomerNotificationWhereInput = {};

    if (userId) {
      where.user_id = userId;
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
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.prisma.customerNotification.findMany({
      where: { user_id: userId },
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

  async findUnreadByUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.prisma.customerNotification.findMany({
      where: {
        user_id: userId,
        read: false,
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
