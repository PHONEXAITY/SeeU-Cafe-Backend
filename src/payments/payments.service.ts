import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentsGateway } from './payments.gateway';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsGateway: PaymentsGateway,
  ) {}

  async create(createPaymentDto: CreatePaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: createPaymentDto.order_id },
      include: { user: true },
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
      include: { order: { include: { user: true } } },
    });

    if (payment.status === 'completed') {
      await this.updateOrderAndTimeline(payment);
      await this.notifyCustomer(payment);
    }

    return {
      ...payment,
      payment_id: payment.payment_id.toString(),
    };
  }

  async createWithProof(
    createPaymentDto: CreatePaymentDto,
    file: Express.Multer.File,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: createPaymentDto.order_id },
      include: { user: true },
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

    const paymentId = BigInt(Date.now());
    const payment = await this.prisma.payment.create({
      data: {
        ...createPaymentDto,
        payment_id: paymentId,
        payment_proof: file.path,
        status: 'pending',
      },
      include: { order: { include: { user: true } } },
    });

    await this.notifyAdmin(payment);
    void this.paymentsGateway.broadcastPaymentStatusUpdate(
      payment.id,
      payment.status,
    );

    return {
      ...payment,
      payment_id: payment.payment_id.toString(),
      file_url: `${process.env.API_URL}/${file.path.replace(/\\/g, '/')}`,
    };
  }

  async uploadPaymentProof(paymentId: number, file: Express.Multer.File) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { include: { user: true } } },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${paymentId} not found`);
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { payment_proof: file.path, status: 'pending' },
      include: { order: { include: { user: true } } },
    });

    await this.notifyAdmin(updatedPayment);
    void this.paymentsGateway.broadcastPaymentStatusUpdate(
      paymentId,
      'pending',
    );

    return {
      message: 'Payment proof uploaded successfully',
      payment: {
        ...updatedPayment,
        payment_id: updatedPayment.payment_id.toString(),
      },
      file_url: `${process.env.API_URL}/${file.path.replace(/\\/g, '/')}`,
    };
  }

  async approvePayment(id: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { order: { include: { user: true } } },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id },
      data: { status: 'completed' },
      include: { order: { include: { user: true } } },
    });

    await this.updateOrderAndTimeline(updatedPayment);
    await this.notifyCustomer(updatedPayment);
    void this.paymentsGateway.broadcastPaymentStatusUpdate(id, 'completed');

    return {
      message: `Payment approved successfully`,
      payment: {
        ...updatedPayment,
        payment_id: updatedPayment.payment_id.toString(),
      },
    };
  }

  async rejectPayment(id: number, reason?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { order: { include: { user: true } } },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    const updatedPayment = await this.prisma.payment.update({
      where: { id },
      data: {
        status: 'rejected',
        notes: reason
          ? `${payment.notes || ''} [Rejection reason: ${reason}]`
          : payment.notes,
      },
      include: { order: { include: { user: true } } },
    });

    if (payment.order.user) {
      await this.prisma.customerNotification.create({
        data: {
          user_id: payment.order.user.id,
          order_id: payment.order_id,
          message: `Your payment for order #${payment.order.order_id} has been rejected. ${reason ? `Reason: ${reason}` : ''}`,
          type: 'payment_rejected',
          action_url: `/orders/${payment.order.order_id}`,
        },
      });
    }

    void this.paymentsGateway.broadcastPaymentStatusUpdate(id, 'rejected');

    return {
      message: 'Payment rejected successfully',
      payment: {
        ...updatedPayment,
        payment_id: updatedPayment.payment_id.toString(),
      },
    };
  }

  async getPaymentProof(id: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    if (!payment.payment_proof) {
      throw new NotFoundException(
        `No payment proof found for payment ID ${id}`,
      );
    }

    return {
      payment_id: payment.payment_id.toString(),
      file_url: `${process.env.API_URL}/${payment.payment_proof.replace(/\\/g, '/')}`,
    };
  }

  async findAll(orderId?: number) {
    const where = orderId ? { order_id: orderId } : {};
    const payments = await this.prisma.payment.findMany({
      where,
      include: { order: true },
      orderBy: { payment_date: 'desc' },
    });

    return payments.map((payment) => ({
      ...payment,
      payment_id: payment.payment_id.toString(),
    }));
  }

  async findOne(id: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { order: true },
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
      include: { order: { include: { user: true } } },
    });

    if (
      updatePaymentDto.status === 'completed' &&
      previousStatus !== 'completed'
    ) {
      await this.updateOrderAndTimeline(payment);
      await this.notifyCustomer(payment);
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

      if (payment.order.user) {
        await this.prisma.customerNotification.create({
          data: {
            user_id: payment.order.user.id,
            order_id: payment.order_id,
            message: `Your payment of ${payment.amount.toFixed(2)} for order #${payment.order.order_id} has been refunded.`,
            type: 'payment_refunded',
            action_url: `/orders/${payment.order.order_id}`,
          },
        });
      }
    }

    void this.paymentsGateway.broadcastPaymentStatusUpdate(id, payment.status);

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
      include: { order: { include: { user: true } } },
    });

    if (status === 'completed' && previousStatus !== 'completed') {
      await this.updateOrderAndTimeline(updatedPayment);
      await this.notifyCustomer(updatedPayment);
    }

    if (status === 'refunded' && previousStatus !== 'refunded') {
      await this.prisma.orderTimeline.create({
        data: {
          order_id: payment.order_id,
          status: 'refunded',
          notes: 'Payment refunded',
        },
      });

      if (updatedPayment.order.user) {
        await this.prisma.customerNotification.create({
          data: {
            user_id: updatedPayment.order.user.id,
            order_id: updatedPayment.order_id,
            message: `Your payment of ${updatedPayment.amount.toFixed(2)} for order #${updatedPayment.order.order_id} has been refunded.`,
            type: 'payment_refunded',
            action_url: `/orders/${updatedPayment.order.order_id}`,
          },
        });
      }
    }

    void this.paymentsGateway.broadcastPaymentStatusUpdate(id, status);

    return {
      ...updatedPayment,
      payment_id: updatedPayment.payment_id.toString(),
    };
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.payment.delete({ where: { id } });
    return { message: 'Payment deleted successfully' };
  }

  private async updateOrderAndTimeline(payment: any) {
    await this.prisma.order.update({
      where: { id: payment.order_id },
      data: { status: 'confirmed' },
    });

    await this.prisma.orderTimeline.create({
      data: {
        order_id: payment.order_id,
        status: 'confirmed',
        notes: 'Payment confirmed',
      },
    });
  }

  private async notifyCustomer(payment: any) {
    if (payment.order.user) {
      await this.prisma.customerNotification.create({
        data: {
          user_id: payment.order.user.id,
          order_id: payment.order_id,
          message: `Your payment of ${payment.amount.toFixed(2)} for order #${payment.order.order_id} has been approved.`,
          type: 'payment_approved',
          action_url: `/orders/${payment.order.order_id}`,
        },
      });
    }
  }

  private async notifyAdmin(payment: any) {
    await this.prisma.customerNotification.create({
      data: {
        message: `New payment proof uploaded for order #${payment.order.order_id}`,
        type: 'payment_proof',
        target_roles: ['admin'],
        broadcast: false,
        action_url: `/admin/payments/${payment.id}`,
      },
    });
  }
}
