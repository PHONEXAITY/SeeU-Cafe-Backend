import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPaymentDto: CreatePaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: createPaymentDto.order_id },
      include: {
        user: true,
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Order with ID ${createPaymentDto.order_id} not found`,
      );
    }

    if (
      createPaymentDto.amount <
      order.total_price - (order.discount_amount || 0)
    ) {
      throw new BadRequestException(
        'Payment amount must match or exceed the order total',
      );
    }

    if (createPaymentDto.delivery_id) {
      const delivery = await this.prisma.delivery.findUnique({
        where: { id: createPaymentDto.delivery_id },
      });

      if (!delivery) {
        throw new NotFoundException(
          `Delivery with ID ${createPaymentDto.delivery_id} not found`,
        );
      }
    }

    const paymentId = BigInt(Date.now());

    const payment = await this.prisma.payment.create({
      data: {
        ...createPaymentDto,
        payment_id: paymentId,
      },
    });

    if (payment.status === 'completed') {
      await this.prisma.order.update({
        where: { id: createPaymentDto.order_id },
        data: { status: 'completed' },
      });

      await this.prisma.orderTimeline.create({
        data: {
          order_id: createPaymentDto.order_id,
          status: 'paid',
          notes: 'Payment completed',
        },
      });

      if (order.User_id) {
        await this.prisma.customerNotification.create({
          data: {
            user_id: order.User_id,
            order_id: order.id,
            message: `Your payment of ${payment.amount.toFixed(2)} for order #${order.order_id} has been received.`,
            type: 'order_update',
            action_url: `/orders/${order.order_id}`,
          },
        });
      }
    }

    return {
      ...payment,
      payment_id: payment.payment_id.toString(),
    };
  }

  async findAll(orderId?: number) {
    const where = orderId ? { order_id: orderId } : {};

    const payments = await this.prisma.payment.findMany({
      where,
      include: {
        order: true,
      },
      orderBy: {
        payment_date: 'desc',
      },
    });

    return payments.map((payment) => ({
      ...payment,
      payment_id: payment.payment_id.toString(),
    }));
  }

  async findOne(id: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        order: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    return {
      ...payment,
      payment_id: payment.payment_id.toString(),
    };
  }

  async update(id: number, updatePaymentDto: UpdatePaymentDto) {
    const existingPayment = await this.findOne(id);
    const previousStatus = existingPayment.status;

    if (updatePaymentDto.order_id) {
      const order = await this.prisma.order.findUnique({
        where: { id: updatePaymentDto.order_id },
      });

      if (!order) {
        throw new NotFoundException(
          `Order with ID ${updatePaymentDto.order_id} not found`,
        );
      }
    }

    if (updatePaymentDto.delivery_id) {
      const delivery = await this.prisma.delivery.findUnique({
        where: { id: updatePaymentDto.delivery_id },
      });

      if (!delivery) {
        throw new NotFoundException(
          `Delivery with ID ${updatePaymentDto.delivery_id} not found`,
        );
      }
    }

    const payment = await this.prisma.payment.update({
      where: { id },
      data: updatePaymentDto,
      include: {
        order: {
          include: {
            user: true,
          },
        },
      },
    });

    if (
      updatePaymentDto.status === 'completed' &&
      previousStatus !== 'completed'
    ) {
      await this.prisma.order.update({
        where: { id: payment.order_id },
        data: { status: 'completed' },
      });

      await this.prisma.orderTimeline.create({
        data: {
          order_id: payment.order_id,
          status: 'completed',
          notes: 'Payment completed',
        },
      });

      if (payment.order.User_id) {
        await this.prisma.customerNotification.create({
          data: {
            user_id: payment.order.User_id,
            order_id: payment.order_id,
            message: `Your payment of ${payment.amount.toFixed(2)} for order #${payment.order.order_id} has been received.`,
            type: 'order_update',
            action_url: `/orders/${payment.order.order_id}`,
          },
        });
      }
    }

    if (
      updatePaymentDto.status === 'refunded' &&
      previousStatus !== 'refunded'
    ) {
      await this.prisma.orderTimeline.create({
        data: {
          order_id: payment.order_id,
          status: 'refunded',
          notes: 'Payment refunded',
        },
      });

      if (payment.order.User_id) {
        await this.prisma.customerNotification.create({
          data: {
            user_id: payment.order.User_id,
            order_id: payment.order_id,
            message: `Your payment of ${payment.amount.toFixed(2)} for order #${payment.order.order_id} has been refunded.`,
            type: 'refunded',
            action_url: `/orders/${payment.order.order_id}`,
          },
        });
      }
    }

    return {
      ...payment,
      payment_id: payment.payment_id.toString(),
    };
  }

  async updateStatus(id: number, status: string) {
    const payment = await this.findOne(id);
    const previousStatus = payment.status;

    const updatedPayment = await this.prisma.payment.update({
      where: { id },
      data: { status },
      include: {
        order: {
          include: {
            user: true,
          },
        },
      },
    });

    if (status === 'completed' && previousStatus !== 'completed') {
      await this.prisma.order.update({
        where: { id: payment.order_id },
        data: { status: 'completed' },
      });

      await this.prisma.orderTimeline.create({
        data: {
          order_id: payment.order_id,
          status: 'completed',
          notes: 'Payment completed',
        },
      });

      if (updatedPayment.order.User_id) {
        await this.prisma.customerNotification.create({
          data: {
            user_id: updatedPayment.order.User_id,
            order_id: updatedPayment.order_id,
            message: `Your payment of ${payment.amount.toFixed(2)} for order #${payment.order.order_id} has been received.`,
            type: 'order_update',
            action_url: `/orders/${updatedPayment.order.order_id}`,
          },
        });
      }
    }

    if (status === 'refunded' && previousStatus !== 'refunded') {
      await this.prisma.orderTimeline.create({
        data: {
          order_id: payment.order_id,
          status: 'refunded',
          notes: 'Payment refunded',
        },
      });

      if (updatedPayment.order.User_id) {
        await this.prisma.customerNotification.create({
          data: {
            user_id: updatedPayment.order.User_id,
            order_id: updatedPayment.order_id,
            message: `Your payment of ${updatedPayment.amount.toFixed(2)} for order #${updatedPayment.order.order_id} has been refunded.`,
            type: 'refunded',
            action_url: `/orders/${updatedPayment.order.order_id}`,
          },
        });
      }
    }

    return {
      ...updatedPayment,
      payment_id: updatedPayment.payment_id.toString(),
    };
  }

  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.payment.delete({
      where: { id },
    });

    return { message: 'Payment deleted successfully' };
  }
}
