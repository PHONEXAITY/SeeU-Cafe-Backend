import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaymentsGateway } from './payments.gateway';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsGateway: PaymentsGateway,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}
  private async triggerReceiptWebhook(payment: any) {
    try {
      const receiptWebhookUrl = this.configService.get<string>(
        'N8N_RECEIPT_WEBHOOK_URL',
      );

      if (!receiptWebhookUrl) {
        console.warn(
          'N8N_RECEIPT_WEBHOOK_URL not configured, skipping receipt',
        );
        return;
      }

      // Prepare receipt payload
      const receiptPayload = {
        orderId: payment.order.order_id,
        userId: payment.order.User_id,
        status: payment.order.status,
        totalPrice: Number(payment.order.total_price) || 0,
        orderType: payment.order.order_type,
        customerInfo: {
          name: payment.order.user
            ? `${payment.order.user.first_name || ''} ${payment.order.user.last_name || ''}`.trim() ||
              'ລູກຄ້າ'
            : 'ລູກຄ້າ',
          email: payment.order.user?.email || null,
          phone: payment.order.user?.phone || null,
        },
        items:
          payment.order.order_details?.map((detail) => ({
            name:
              detail.food_menu?.name ||
              detail.beverage_menu?.name ||
              'ບໍ່ລະບຸຊື່',
            quantity: detail.quantity || 1,
            price: Number(detail.price) || 0,
            notes: detail.notes || '',
          })) || [],
        paymentMethod: payment.method,
        paidAt: payment.payment_date?.toISOString() || new Date().toISOString(),
        completedAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        requestId: `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        source: 'seeu-cafe-payments',
      };

      console.log(
        `📧 Triggering receipt webhook for order: ${payment.order.order_id}`,
      );

      const response = await this.httpService.axiosRef.post(
        receiptWebhookUrl,
        receiptPayload,
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Source': 'seeu-cafe-payments',
            'X-Request-ID': receiptPayload.requestId,
            'X-Order-ID': payment.order.order_id,
            'User-Agent': 'SeeU-Cafe-Payments/1.0',
          },
        },
      );

      console.log(`✅ Receipt webhook sent successfully:`, {
        orderId: payment.order.order_id,
        status: response.status,
        success: response.data?.success,
        messageId: response.data?.messageId,
      });

      return {
        success: true,
        response: response.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`❌ Failed to send receipt webhook:`, {
        orderId: payment.order.order_id,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
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
      // 🔥 NEW: Trigger receipt if order is completed
      if (['completed', 'delivered'].includes(payment.order.status)) {
        console.log(
          `🔥 Payment created as completed for finished order, triggering receipt...`,
        );
        await this.triggerReceiptWebhook(payment);
      }
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
    // 🔥 NEW: Trigger receipt if order is completed
    if (['completed', 'delivered'].includes(updatedPayment.order.status)) {
      console.log(
        `🔥 Payment approved for completed order, triggering receipt...`,
      );
      await this.triggerReceiptWebhook(updatedPayment);
    }
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
          message: `ການຊໍາລະເງິນສໍາລັບຄໍາສັ່ງຂອງທ່ານ #${payment.order.order_id} ຖືກປະຕິເສດແລ້ວ. ${reason ? `ເຫດຜົນ: ${reason}` : ''}`,
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
      // 🔥 NEW: Trigger receipt if order is completed
      if (['completed', 'delivered'].includes(payment.order.status)) {
        console.log(
          `🔥 Payment updated to completed for finished order, triggering receipt...`,
        );
        await this.triggerReceiptWebhook(payment);
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

      if (payment.order.user) {
        await this.prisma.customerNotification.create({
          data: {
            user_id: payment.order.user.id,
            order_id: payment.order_id,
            message: `ການຊຳລະຂອງທ່ານຈຳນວນ ${payment.amount.toFixed(2)} ສຳລັບການສັ່ງຊື້ #${payment.order.order_id} ໄດ້ຮັບການຄືນເງີນແລ້ວ.`,
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
            message: `ການຊຳລະຂອງທ່ານຈຳນວນ ${updatedPayment.amount.toFixed(2)} ສຳລັບການສັ່ງຊື້ #${updatedPayment.order.order_id} ໄດ້ຮັບການຄືນເງີນແລ້ວ.`,
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
          message: `ການຊຳລະຂອງທ່ານຈຳນວນ ${payment.amount.toFixed(2)} ສຳລັບການສັ່ງຊື້ #${payment.order.order_id} ໄດ້ຮັບການຢຶນຢັນແລ້ວ.`,
          type: 'payment_approved',
          action_url: `/orders/${payment.order.order_id}`,
        },
      });
    }
  }

  private async notifyAdmin(payment: any) {
    await this.prisma.customerNotification.create({
      data: {
        message: `ມີການອັບໂຫຼດຫຼັກຖານການຊໍາລະເງິນໃໝ່ຂອງການສັ່ງຊື້ #${payment.order.order_id}`,
        type: 'payment_proof',
        target_roles: ['admin'],
        broadcast: false,
        action_url: `/admin/payments/${payment.id}`,
      },
    });
  }
}
