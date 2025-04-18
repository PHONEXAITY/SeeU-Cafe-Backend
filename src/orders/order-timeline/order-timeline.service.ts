import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderTimelineDto } from './dto/create-order-timeline.dto';
import { OrderTimeline } from '@prisma/client';

@Injectable()
export class OrderTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createOrderTimelineDto: CreateOrderTimelineDto,
  ): Promise<OrderTimeline> {
    const order = await this.prisma.order.findUnique({
      where: { id: createOrderTimelineDto.order_id },
    });

    if (!order) {
      throw new NotFoundException(
        `Order with ID ${createOrderTimelineDto.order_id} not found`,
      );
    }

    const result = await this.prisma.orderTimeline.create({
      data: createOrderTimelineDto,
    });

    return result as OrderTimeline;
  }

  async findAllByOrderId(orderId: number): Promise<OrderTimeline[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const timelineEntries = await this.prisma.orderTimeline.findMany({
      where: { order_id: orderId },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return timelineEntries as OrderTimeline[];
  }

  async findOne(id: number): Promise<OrderTimeline> {
    const timeline = await this.prisma.orderTimeline.findUnique({
      where: { id },
    });

    if (!timeline) {
      throw new NotFoundException(
        `Order timeline entry with ID ${id} not found`,
      );
    }

    return timeline as OrderTimeline;
  }

  async findAllByStatus(status: string): Promise<OrderTimeline[]> {
    const statusEntries = await this.prisma.orderTimeline.findMany({
      where: {
        status,
      },
      include: {
        order: true,
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    return statusEntries as OrderTimeline[];
  }

  async remove(id: number): Promise<{ message: string }> {
    await this.findOne(id);

    await this.prisma.orderTimeline.delete({
      where: { id },
    });

    return { message: 'Order timeline entry deleted successfully' };
  }
}
