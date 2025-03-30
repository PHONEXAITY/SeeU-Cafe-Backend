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
    // Check if order exists
    const order = await this.prisma.order.findUnique({
      where: { id: createPaymentDto.order_id },
    });

    if (!order) {
      throw new NotFoundException(
        `Order with ID ${createPaymentDto.order_id} not found`,
      );
    }

    // Check if the payment amount matches or exceeds the order total
    if (
      createPaymentDto.amount <
      order.total_price - (order.discount_amount || 0)
    ) {
      throw new BadRequestException(
        'Payment amount must match or exceed the order total',
      );
    }

    // If delivery_id is provided, check if it exists
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

    // Generate a unique payment_id
    const paymentId = BigInt(Date.now());

    const payment = await this.prisma.payment.create({
      data: {
        ...createPaymentDto,
        payment_id: paymentId,
      },
    });

    // If payment status is 'completed', update the order status to 'paid'
    if (payment.status === 'completed') {
      await this.prisma.order.update({
        where: { id: createPaymentDto.order_id },
        data: { status: 'paid' },
      });
    }

    // แปลง payment_id เป็น string
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

    // แปลง payment_id เป็น string ในทุก object
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

    // แปลง payment_id เป็น string
    return {
      ...payment,
      payment_id: payment.payment_id.toString(),
    };
  }

  async update(id: number, updatePaymentDto: UpdatePaymentDto) {
    // Check if payment exists
    await this.findOne(id);

    // If order_id is being updated, check if the new order exists
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

    // If delivery_id is being updated, check if the new delivery exists
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
        order: true,
      },
    });

    // If payment status is updated to 'completed', update the order status to 'paid'
    if (updatePaymentDto.status === 'completed') {
      await this.prisma.order.update({
        where: { id: payment.order_id },
        data: { status: 'paid' },
      });
    }

    // แปลง payment_id เป็น string
    return {
      ...payment,
      payment_id: payment.payment_id.toString(),
    };
  }

  async updateStatus(id: number, status: string) {
    // Check if payment exists
    const payment = await this.findOne(id);

    const updatedPayment = await this.prisma.payment.update({
      where: { id },
      data: { status },
      include: {
        order: true,
      },
    });

    // If payment status is updated to 'completed', update the order status to 'paid'
    if (status === 'completed') {
      await this.prisma.order.update({
        where: { id: payment.order_id },
        data: { status: 'paid' },
      });
    }

    // แปลง payment_id เป็น string
    return {
      ...updatedPayment,
      payment_id: updatedPayment.payment_id.toString(),
    };
  }

  async remove(id: number) {
    // Check if payment exists
    await this.findOne(id);

    await this.prisma.payment.delete({
      where: { id },
    });

    return { message: 'Payment deleted successfully' };
  }
}
