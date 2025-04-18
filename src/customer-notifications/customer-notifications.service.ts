import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationsGateway } from './notifications.gateway';
import { CustomerNotification } from '@prisma/client';

@Injectable()
export class CustomerNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(
    createNotificationDto: CreateNotificationDto,
  ): Promise<CustomerNotification> {
    const user = await this.prisma.user.findUnique({
      where: { id: createNotificationDto.user_id },
    });

    if (!user) {
      throw new NotFoundException(
        `User with ID ${createNotificationDto.user_id} not found`,
      );
    }

    const notification = await this.prisma.customerNotification.create({
      data: createNotificationDto,
    });

    this.notificationsGateway.sendNotificationToUser(
      createNotificationDto.user_id,
      notification,
    );

    return notification;
  }

  async findAll(
    userId?: number,
    read?: boolean,
    type?: string,
  ): Promise<CustomerNotification[]> {
    const where: any = {};

    if (userId) {
      where.user_id = userId;
    }

    if (read !== undefined) {
      where.read = read;
    }

    if (type) {
      where.type = type;
    }

    const notifications = await this.prisma.customerNotification.findMany({
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

    return notifications as CustomerNotification[];
  }

  async findOne(id: number): Promise<CustomerNotification> {
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

  async findAllByUser(userId: number): Promise<CustomerNotification[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const notifications = await this.prisma.customerNotification.findMany({
      where: { user_id: userId },
      orderBy: {
        created_at: 'desc',
      },
    });

    return notifications as CustomerNotification[];
  }

  async findUnreadByUser(userId: number): Promise<CustomerNotification[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const notifications = await this.prisma.customerNotification.findMany({
      where: {
        user_id: userId,
        read: false,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return notifications as CustomerNotification[];
  }

  async update(
    id: number,
    updateNotificationDto: UpdateNotificationDto,
  ): Promise<CustomerNotification> {
    await this.findOne(id);

    const updatedNotification = await this.prisma.customerNotification.update({
      where: { id },
      data: updateNotificationDto,
    });

    return updatedNotification as CustomerNotification;
  }

  async markAsRead(id: number): Promise<CustomerNotification> {
    await this.findOne(id);

    const updatedNotification = await this.prisma.customerNotification.update({
      where: { id },
      data: { read: true },
    });

    return updatedNotification as CustomerNotification;
  }

  async markAllAsRead(userId: number): Promise<{ message: string }> {
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

  async remove(id: number): Promise<{ message: string }> {
    await this.findOne(id);

    await this.prisma.customerNotification.delete({
      where: { id },
    });

    return { message: 'Notification deleted successfully' };
  }

  async removeAllByUser(
    userId: number,
  ): Promise<{ message: string; count: number }> {
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
