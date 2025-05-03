import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerNotificationsService } from '../customer-notifications/customer-notifications.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { UpdateDeliveryTimeDto } from './dto/update-delivery-time.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: CustomerNotificationsService,
  ) {}
  private async createDeliveryNotification(
    orderId: number,
    status: string,
    estimatedTime?: Date,
    customMessage?: string,
  ) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          User_id: true,
          order_id: true,
        },
      });

      if (!order || !order.User_id) {
        return;
      }

      let message = customMessage;
      if (!message) {
        switch (status) {
          case 'pending': {
            message = `Your delivery order #${order.order_id} is being processed. We'll notify you when it's ready for delivery.`;
            break;
          }
          case 'preparing': {
            message = `Your order #${order.order_id} is being prepared. It will be ready for delivery soon.`;
            break;
          }
          case 'out_for_delivery': {
            const eta = estimatedTime
              ? `and should arrive by ${estimatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : '';
            message = `Your order #${order.order_id} is on the way ${eta}.`;
            break;
          }
          case 'delivered': {
            message = `Your order #${order.order_id} has been delivered. Enjoy your meal!`;
            break;
          }
          case 'cancelled': {
            message = `Your delivery for order #${order.order_id} has been cancelled. Contact customer service for more information.`;
            break;
          }
          default: {
            message = `Your delivery for order #${order.order_id} has been updated to status: ${status}.`;
            break;
          }
        }
      }

      await this.notificationsService.create({
        user_id: order.User_id,
        order_id: orderId,
        message,
        type: 'delivery_update',
        action_url: `/delivery`,
        read: false,
      });
    } catch (error) {
      console.error('Failed to create delivery notification:', error);
    }
  }
  async create(createDeliveryDto: CreateDeliveryDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: createDeliveryDto.order_id },
    });

    if (!order) {
      throw new NotFoundException(
        `Order with ID ${createDeliveryDto.order_id} not found`,
      );
    }

    if (order.order_type !== 'delivery') {
      throw new BadRequestException(
        `Order with ID ${createDeliveryDto.order_id} is not a delivery order. Order type: ${order.order_type}`,
      );
    }

    const existingDelivery = await this.prisma.delivery.findUnique({
      where: { order_id: createDeliveryDto.order_id },
    });

    if (existingDelivery) {
      throw new ConflictException(
        `Delivery for order with ID ${createDeliveryDto.order_id} already exists`,
      );
    }

    if (createDeliveryDto.employee_id) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: createDeliveryDto.employee_id },
      });

      if (!employee) {
        throw new NotFoundException(
          `Employee with ID ${createDeliveryDto.employee_id} not found`,
        );
      }
    }

    const deliveryId = BigInt(Date.now());

    let estimatedDeliveryTime: Date;
    if (createDeliveryDto.estimated_delivery_time) {
      estimatedDeliveryTime = new Date(
        createDeliveryDto.estimated_delivery_time,
      );
    } else {
      estimatedDeliveryTime = new Date(Date.now() + 60 * 60 * 1000);
    }

    const delivery = await this.prisma.delivery.create({
      data: {
        ...createDeliveryDto,
        delivery_id: deliveryId,
        estimated_delivery_time: estimatedDeliveryTime,
      },
      include: {
        order: true,
        employee: true,
      },
    });

    if (order.status !== 'out_for_delivery') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'out_for_delivery' },
      });

      await this.prisma.orderTimeline.create({
        data: {
          order_id: order.id,
          status: 'out_for_delivery',
          employee_id: createDeliveryDto.employee_id,
          notes: 'Order out for delivery',
        },
      });
    }

    return {
      ...delivery,
      delivery_id: delivery.delivery_id.toString(),
    };
  }

  async findAll(status?: string, employeeId?: number) {
    const where: Prisma.DeliveryWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (employeeId) {
      where.employee_id = employeeId;
    }

    const deliveries = await this.prisma.delivery.findMany({
      where,
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
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: {
        actual_delivery_time: 'desc',
      },
    });

    return deliveries.map((delivery) => ({
      ...delivery,
      delivery_id: delivery.delivery_id.toString(),
    }));
  }

  async findOne(id: number) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
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
            order_details: {
              include: {
                food_menu: true,
                beverage_menu: true,
              },
            },
            timeline: {
              orderBy: {
                timestamp: 'desc',
              },
            },
          },
        },
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            phone: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery with ID ${id} not found`);
    }

    return {
      ...delivery,
      delivery_id: delivery.delivery_id.toString(),
    };
  }

  async findByOrderId(orderId: number) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { order_id: orderId },
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
            order_details: {
              include: {
                food_menu: true,
                beverage_menu: true,
              },
            },
            timeline: {
              orderBy: {
                timestamp: 'desc',
              },
            },
          },
        },
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            phone: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery for order ID ${orderId} not found`);
    }

    return {
      ...delivery,
      delivery_id: delivery.delivery_id.toString(),
    };
  }

  async update(id: number, updateDeliveryDto: UpdateDeliveryDto) {
    const existingDelivery = await this.findOne(id);

    if (updateDeliveryDto.order_id) {
      const order = await this.prisma.order.findUnique({
        where: { id: updateDeliveryDto.order_id },
      });

      if (!order) {
        throw new NotFoundException(
          `Order with ID ${updateDeliveryDto.order_id} not found`,
        );
      }

      if (order.order_type !== 'delivery') {
        throw new BadRequestException(
          `Order with ID ${updateDeliveryDto.order_id} is not a delivery order. Order type: ${order.order_type}`,
        );
      }

      const anotherDelivery = await this.prisma.delivery.findUnique({
        where: { order_id: updateDeliveryDto.order_id },
      });

      if (anotherDelivery && anotherDelivery.id !== id) {
        throw new ConflictException(
          `Delivery for order with ID ${updateDeliveryDto.order_id} already exists`,
        );
      }
    }

    if (updateDeliveryDto.employee_id) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: updateDeliveryDto.employee_id },
      });

      if (!employee) {
        throw new NotFoundException(
          `Employee with ID ${updateDeliveryDto.employee_id} not found`,
        );
      }
    }

    if (updateDeliveryDto.estimated_delivery_time) {
      updateDeliveryDto.estimated_delivery_time = new Date(
        updateDeliveryDto.estimated_delivery_time,
      ) as unknown as string;
    }

    const updatedDelivery = await this.prisma.delivery.update({
      where: { id },
      data: updateDeliveryDto,
      include: {
        order: true,
        employee: true,
      },
    });

    if (
      updateDeliveryDto.status &&
      updateDeliveryDto.status !== existingDelivery.status
    ) {
      const estimatedTime = updateDeliveryDto.estimated_delivery_time
        ? new Date(
            updateDeliveryDto.estimated_delivery_time as unknown as string,
          )
        : existingDelivery.estimated_delivery_time || undefined;

      await this.createDeliveryNotification(
        existingDelivery.order_id,
        updateDeliveryDto.status,
        estimatedTime,
      );
    }

    if (
      updateDeliveryDto.status === 'delivered' &&
      existingDelivery.status !== 'delivered'
    ) {
      const now = new Date();
      await this.prisma.delivery.update({
        where: { id },
        data: { actual_delivery_time: now },
      });

      const orderData = updatedDelivery.order;

      await this.prisma.order.update({
        where: { id: existingDelivery.order_id },
        data: { status: 'delivered' },
      });

      await this.prisma.orderTimeline.create({
        data: {
          order_id: existingDelivery.order_id,
          status: 'delivered',
          employee_id:
            updateDeliveryDto.employee_id || existingDelivery.employee_id,
          notes: 'Order delivered to customer',
          timestamp: now,
        },
      });

      if (orderData?.User_id) {
        const orderDetails = await this.prisma.orderDetail.findMany({
          where: { order_id: existingDelivery.order_id },
          include: {
            food_menu: true,
            beverage_menu: true,
          },
        });

        const items = orderDetails.map((detail) => {
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

        await this.prisma.orderHistory.create({
          data: {
            user_id: orderData.User_id,
            order_id: orderData.order_id,
            order_date: orderData.create_at,
            total_amount: orderData.total_price,
            order_type: 'delivery',
            status: 'delivered',
            items,
            delivery_address: existingDelivery.delivery_address,
          },
        });
      }
    }

    if (
      updateDeliveryDto.status === 'out_for_delivery' &&
      existingDelivery.status !== 'out_for_delivery' &&
      !existingDelivery.pickup_from_kitchen_time
    ) {
      await this.prisma.delivery.update({
        where: { id },
        data: { pickup_from_kitchen_time: new Date() },
      });

      await this.prisma.orderTimeline.create({
        data: {
          order_id: existingDelivery.order_id,
          status: 'out_for_delivery',
          employee_id:
            updateDeliveryDto.employee_id || existingDelivery.employee_id,
          notes: 'Order picked up from kitchen for delivery',
        },
      });
    }

    return {
      ...updatedDelivery,
      delivery_id: updatedDelivery.delivery_id.toString(),
    };
  }

  async updateStatus(id: number, status: string) {
    const delivery = await this.findOne(id);

    const updatedDelivery = await this.prisma.delivery.update({
      where: { id },
      data: { status },
    });
    if (status !== delivery.status) {
      const estimatedTime = delivery.estimated_delivery_time || undefined;

      await this.createDeliveryNotification(
        delivery.order_id,
        status,
        estimatedTime,
      );
    }

    if (status === 'delivered' && delivery.status !== 'delivered') {
      const now = new Date();
      await this.prisma.delivery.update({
        where: { id },
        data: { actual_delivery_time: now },
      });

      const orderData = delivery.order;

      await this.prisma.order.update({
        where: { id: delivery.order_id },
        data: { status: 'delivered' },
      });

      await this.prisma.orderTimeline.create({
        data: {
          order_id: delivery.order_id,
          status: 'delivered',
          employee_id: delivery.employee_id,
          notes: 'Order delivered to customer',
          timestamp: now,
        },
      });

      if (orderData?.User_id) {
        const orderDetails = await this.prisma.orderDetail.findMany({
          where: { order_id: delivery.order_id },
          include: {
            food_menu: true,
            beverage_menu: true,
          },
        });

        const items = orderDetails.map((detail) => {
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

        await this.prisma.orderHistory.create({
          data: {
            user_id: orderData.User_id,
            order_id: orderData.order_id,
            order_date: orderData.create_at,
            total_amount: orderData.total_price,
            order_type: 'delivery',
            status: 'delivered',
            items,
            delivery_address: delivery.delivery_address,
          },
        });
      }
    }

    if (
      status === 'out_for_delivery' &&
      delivery.status !== 'out_for_delivery' &&
      !delivery.pickup_from_kitchen_time
    ) {
      await this.prisma.delivery.update({
        where: { id },
        data: { pickup_from_kitchen_time: new Date() },
      });

      await this.prisma.orderTimeline.create({
        data: {
          order_id: delivery.order_id,
          status: 'out_for_delivery',
          employee_id: delivery.employee_id,
          notes: 'Order picked up from kitchen for delivery',
        },
      });
    }

    return {
      ...updatedDelivery,
      delivery_id: updatedDelivery.delivery_id.toString(),
    };
  }

  async updateTime(id: number, updateTimeDto: UpdateDeliveryTimeDto) {
    const delivery = await this.findOne(id);
    const orderData = delivery.order;

    let previousTime: Date | undefined = undefined;
    if (updateTimeDto.timeType === 'estimated_delivery_time') {
      previousTime = delivery.estimated_delivery_time || undefined;
    } else if (updateTimeDto.timeType === 'pickup_from_kitchen_time') {
      previousTime = delivery.pickup_from_kitchen_time || undefined;
    }

    const updatedDelivery = await this.prisma.delivery.update({
      where: { id },
      data: {
        [updateTimeDto.timeType]: updateTimeDto.newTime,
      },
    });

    if (updateTimeDto.timeType === 'estimated_delivery_time') {
      const deliveryTimeStr = updateTimeDto.newTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const message =
        updateTimeDto.notificationMessage ||
        `Your delivery time for order #${orderData.order_id} has been updated. New estimated delivery time: ${deliveryTimeStr}.`;

      await this.createDeliveryNotification(
        delivery.order_id,
        delivery.status,
        updateTimeDto.newTime,
        message,
      );
    }

    await this.prisma.timeUpdate.create({
      data: {
        order_id: delivery.order_id,
        previous_time: previousTime,
        new_time: updateTimeDto.newTime,
        reason: updateTimeDto.reason,
        updated_by: updateTimeDto.employeeId,
        notified_customer: updateTimeDto.notifyCustomer || false,
      },
    });

    if (updateTimeDto.notifyCustomer && orderData?.User_id) {
      const deliveryTimeStr = updateTimeDto.newTime.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      await this.notificationsService.create({
        user_id: orderData.User_id,
        order_id: delivery.order_id,
        message: `Your delivery time has been updated. New estimated time: ${deliveryTimeStr}`,
        type: 'delivery_update',
        action_url: `/delivery`,
        read: false,
      });
    }

    return {
      ...updatedDelivery,
      delivery_id: updatedDelivery.delivery_id.toString(),
    };
  }

  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.delivery.delete({
      where: { id },
    });

    return { message: 'delivery_update' };
  }
}
