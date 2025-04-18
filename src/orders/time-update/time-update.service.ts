import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTimeUpdateDto } from './dto/create-time-update.dto';
import { TimeUpdate } from '@prisma/client';

@Injectable()
export class TimeUpdateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTimeUpdateDto: CreateTimeUpdateDto): Promise<TimeUpdate> {
    const order = await this.prisma.order.findUnique({
      where: { id: createTimeUpdateDto.order_id },
    });

    if (!order) {
      throw new NotFoundException(
        `Order with ID ${createTimeUpdateDto.order_id} not found`,
      );
    }

    const timeUpdate = await this.prisma.timeUpdate.create({
      data: createTimeUpdateDto,
    });

    if (createTimeUpdateDto.notified_customer && order.User_id) {
      await this.prisma.customerNotification.create({
        data: {
          user_id: order.User_id,
          order_id: order.id,
          message:
            createTimeUpdateDto.notification_message ||
            `Your order time has been updated. New time: ${createTimeUpdateDto.new_time.toLocaleString()}`,
          type: 'time_change',
          action_url: `/orders/${order.order_id}`,
        },
      });
    }

    return timeUpdate as TimeUpdate;
  }

  async findAllByOrderId(orderId: number): Promise<TimeUpdate[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const timeUpdates = await this.prisma.timeUpdate.findMany({
      where: { order_id: orderId },
      orderBy: {
        created_at: 'desc',
      },
    });

    return timeUpdates as TimeUpdate[];
  }

  async findOne(id: number): Promise<TimeUpdate> {
    const timeUpdate = await this.prisma.timeUpdate.findUnique({
      where: { id },
    });

    if (!timeUpdate) {
      throw new NotFoundException(`Time update with ID ${id} not found`);
    }

    return timeUpdate as TimeUpdate;
  }

  async findAllByEmployee(employeeId: number): Promise<TimeUpdate[]> {
    const timeUpdates = await this.prisma.timeUpdate.findMany({
      where: {
        updated_by: employeeId,
      },
      include: {
        order: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return timeUpdates as TimeUpdate[];
  }

  async findAllNotified(): Promise<TimeUpdate[]> {
    const notifiedUpdates = await this.prisma.timeUpdate.findMany({
      where: {
        notified_customer: true,
      },
      include: {
        order: {
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
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return notifiedUpdates as TimeUpdate[];
  }

  async remove(id: number): Promise<{ message: string }> {
    await this.findOne(id);

    await this.prisma.timeUpdate.delete({
      where: { id },
    });

    return { message: 'Time update deleted successfully' };
  }
}
