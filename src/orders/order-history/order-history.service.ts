import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderHistoryDto } from './dto/create-order-history.dto';
import { UpdateOrderHistoryDto } from './dto/update-order-history.dto';
import { OrderHistory, Prisma } from '@prisma/client';
import { InputJsonValue } from '@prisma/client/runtime/library';

@Injectable()
export class OrderHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createOrderHistoryDto: CreateOrderHistoryDto,
  ): Promise<OrderHistory> {
    if (createOrderHistoryDto.user_id) {
      const user = await this.prisma.user.findUnique({
        where: { id: createOrderHistoryDto.user_id },
      });

      if (!user) {
        throw new NotFoundException(
          `User with ID ${createOrderHistoryDto.user_id} not found`,
        );
      }
    }

    const data: Prisma.OrderHistoryCreateInput = {
      user: { connect: { id: createOrderHistoryDto.user_id } },
      order_id: createOrderHistoryDto.order_id,
      order_date: createOrderHistoryDto.order_date,
      total_amount: createOrderHistoryDto.total_amount,
      order_type: createOrderHistoryDto.order_type,
      status: createOrderHistoryDto.status,
      items: createOrderHistoryDto.items as InputJsonValue,
      payment_method: createOrderHistoryDto.payment_method,
      delivery_address: createOrderHistoryDto.delivery_address,
      is_favorite: createOrderHistoryDto.is_favorite,
      reorder_count: createOrderHistoryDto.reorder_count,
    };

    return this.prisma.orderHistory.create({
      data,
    });
  }

  async createFromOrder(orderId: number): Promise<OrderHistory> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        order_details: {
          include: {
            food_menu: true,
            beverage_menu: true,
          },
        },
        payments: true,
        delivery: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (!order.User_id) {
      throw new NotFoundException('This order has no associated user');
    }

    const items = order.order_details.map((detail) => {
      return {
        name:
          detail.food_menu?.name ||
          detail.beverage_menu?.name ||
          'Unknown Item',
        quantity: detail.quantity,
        price: detail.price,
        notes: detail.notes,
      };
    });

    const data: Prisma.OrderHistoryCreateInput = {
      user: { connect: { id: order.User_id } },
      order_id: order.order_id,
      order_date: order.create_at,
      total_amount: order.total_price,
      order_type: order.order_type,
      status: order.status,
      items: items as InputJsonValue,
      payment_method: order.payments[0]?.method || null,
      delivery_address: order.delivery?.delivery_address || null,
    };

    return this.prisma.orderHistory.create({
      data,
    });
  }

  async findAllByUser(userId: number): Promise<OrderHistory[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const result = await this.prisma.orderHistory.findMany({
      where: { user_id: userId },
      orderBy: {
        order_date: 'desc',
      },
    });

    return result as OrderHistory[];
  }

  async findFavoritesByUser(userId: number): Promise<OrderHistory[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    const favorites = await this.prisma.orderHistory.findMany({
      where: {
        user_id: userId,
        is_favorite: true,
      },
      orderBy: {
        order_date: 'desc',
      },
    });

    return favorites as OrderHistory[];
  }

  async findOne(id: number): Promise<OrderHistory> {
    const orderHistory = await this.prisma.orderHistory.findUnique({
      where: { id },
    });

    if (!orderHistory) {
      throw new NotFoundException(`Order history with ID ${id} not found`);
    }

    return orderHistory;
  }

  async findByOrderId(orderIdString: string): Promise<OrderHistory> {
    const orderHistory = await this.prisma.orderHistory.findFirst({
      where: { order_id: orderIdString },
    });

    if (!orderHistory) {
      throw new NotFoundException(
        `Order history for order ${orderIdString} not found`,
      );
    }

    return orderHistory as OrderHistory;
  }

  async update(
    id: number,
    updateOrderHistoryDto: UpdateOrderHistoryDto,
  ): Promise<OrderHistory> {
    await this.findOne(id);

    const data: Prisma.OrderHistoryUpdateInput = {};

    if (updateOrderHistoryDto.order_id !== undefined) {
      data.order_id = updateOrderHistoryDto.order_id;
    }
    if (updateOrderHistoryDto.order_date !== undefined) {
      data.order_date = updateOrderHistoryDto.order_date;
    }
    if (updateOrderHistoryDto.total_amount !== undefined) {
      data.total_amount = updateOrderHistoryDto.total_amount;
    }
    if (updateOrderHistoryDto.order_type !== undefined) {
      data.order_type = updateOrderHistoryDto.order_type;
    }
    if (updateOrderHistoryDto.status !== undefined) {
      data.status = updateOrderHistoryDto.status;
    }
    if (updateOrderHistoryDto.items !== undefined) {
      data.items = updateOrderHistoryDto.items as InputJsonValue;
    }
    if (updateOrderHistoryDto.payment_method !== undefined) {
      data.payment_method = updateOrderHistoryDto.payment_method;
    }
    if (updateOrderHistoryDto.delivery_address !== undefined) {
      data.delivery_address = updateOrderHistoryDto.delivery_address;
    }
    if (updateOrderHistoryDto.is_favorite !== undefined) {
      data.is_favorite = updateOrderHistoryDto.is_favorite;
    }
    if (updateOrderHistoryDto.reorder_count !== undefined) {
      data.reorder_count = updateOrderHistoryDto.reorder_count;
    }

    return this.prisma.orderHistory.update({
      where: { id },
      data,
    });
  }

  async toggleFavorite(id: number): Promise<OrderHistory> {
    const orderHistory = await this.findOne(id);

    return this.prisma.orderHistory.update({
      where: { id },
      data: { is_favorite: !orderHistory.is_favorite },
    });
  }

  async incrementReorderCount(id: number): Promise<OrderHistory> {
    await this.findOne(id);

    return this.prisma.orderHistory.update({
      where: { id },
      data: { reorder_count: { increment: 1 } },
    });
  }

  async remove(id: number): Promise<{ message: string }> {
    await this.findOne(id);

    await this.prisma.orderHistory.delete({
      where: { id },
    });

    return { message: 'Order history deleted successfully' };
  }
}
