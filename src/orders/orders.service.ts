import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerNotificationsService } from '../customer-notifications/customer-notifications.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateTimeDto } from './dto/update-time.dto';
import {
  Order,
  OrderTimeline,
  OrderHistory,
  Delivery,
  Payment,
  OrderDetail,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { InputJsonValue } from '@prisma/client/runtime/library';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import Redis from 'ioredis';

type OrderWithRelations = Order & {
  user?: {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
  employee?: {
    id: number;
    first_name: string | null;
    last_name: string | null;
  } | null;
  table?: any;
  promotion?: any;
  order_details: (OrderDetail & {
    food_menu?: any;
    beverage_menu?: any;
  })[];
  payments?: Payment[];
  delivery?: Delivery | null;
  timeline?: OrderTimeline[];
  time_updates?: any[];
};

@Injectable()
export class OrdersService {
  private readonly redisClient: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly customerNotificationsService: CustomerNotificationsService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  async create(createOrderDto: CreateOrderDto): Promise<OrderWithRelations> {
    // Validation logic (existing code)
    if (createOrderDto.User_id) {
      const user = await this.prisma.user.findUnique({
        where: { id: createOrderDto.User_id },
      });
      if (!user) {
        throw new NotFoundException(
          `User with ID ${createOrderDto.User_id} not found`,
        );
      }
    }

    if (createOrderDto.Employee_id) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: createOrderDto.Employee_id },
      });
      if (!employee) {
        throw new NotFoundException(
          `Employee with ID ${createOrderDto.Employee_id} not found`,
        );
      }
    }

    if (createOrderDto.table_id) {
      const table = await this.prisma.table.findUnique({
        where: { id: createOrderDto.table_id },
      });
      if (!table) {
        throw new NotFoundException(
          `Table with ID ${createOrderDto.table_id} not found`,
        );
      }
    }

    if (createOrderDto.promotion_id) {
      const promotion = await this.prisma.promotion.findUnique({
        where: { id: createOrderDto.promotion_id },
      });
      if (!promotion) {
        throw new NotFoundException(
          `Promotion with ID ${createOrderDto.promotion_id} not found`,
        );
      }
    }

    const { order_details, ...orderData } = createOrderDto;
    const uniqueOrderId = `ORD${Date.now()}`;

    let estimatedReadyTime: Date | undefined = undefined;
    if (order_details && order_details.length > 0) {
      const totalPrepTime = order_details.reduce((total, detail) => {
        return total + (detail.preparation_time || 15);
      }, 0);

      const avgPrepTime = Math.max(totalPrepTime / order_details.length, 10);
      estimatedReadyTime = new Date(Date.now() + avgPrepTime * 60 * 1000);
    }

    const orderCreateInput: Prisma.OrderCreateInput = {
      order_id: uniqueOrderId,
      estimated_ready_time: estimatedReadyTime,
      status: orderData.status || 'pending',
      total_price: orderData.total_price,
      order_type: orderData.order_type,
      discount_amount: orderData.discount_amount,
      preparation_notes: orderData.preparation_notes,
      pickup_time: orderData.pickup_time,
      timeline: {
        create: {
          status: 'created',
          notes: 'Order created',
        },
      },
    };

    if (orderData.User_id) {
      orderCreateInput.user = { connect: { id: orderData.User_id } };
    }
    if (orderData.Employee_id) {
      orderCreateInput.employee = { connect: { id: orderData.Employee_id } };
    }
    if (orderData.table_id) {
      orderCreateInput.table = { connect: { id: orderData.table_id } };
    }
    if (orderData.promotion_id) {
      orderCreateInput.promotion = { connect: { id: orderData.promotion_id } };
    }

    const order = await this.prisma.order.create({
      data: orderCreateInput,
    });

    // Create order details
    if (order_details && order_details.length > 0) {
      await Promise.all(
        order_details.map(async (detail) => {
          if (!detail.food_menu_id && !detail.beverage_menu_id) {
            throw new BadRequestException(
              'Either food_menu_id or beverage_menu_id must be provided for each order detail',
            );
          }

          if (detail.food_menu_id) {
            const foodMenuItem = await this.prisma.foodMenu.findUnique({
              where: { id: detail.food_menu_id },
            });
            if (!foodMenuItem) {
              throw new NotFoundException(
                `Food menu item with ID ${detail.food_menu_id} not found`,
              );
            }
          }

          if (detail.beverage_menu_id) {
            const beverageMenuItem = await this.prisma.beverageMenu.findUnique({
              where: { id: detail.beverage_menu_id },
            });
            if (!beverageMenuItem) {
              throw new NotFoundException(
                `Beverage menu item with ID ${detail.beverage_menu_id} not found`,
              );
            }
          }

          await this.redisClient.lpush(
            'orders:process',
            JSON.stringify({
              orderId: order.id,
              tasks: [
                'notify_kitchen',
                'update_inventory',
                'calculate_statistics',
              ],
            }),
          );

          return this.prisma.orderDetail.create({
            data: {
              ...detail,
              order_id: order.id,
              preparation_time: detail.preparation_time || 15,
            },
          });
        }),
      );
    }

    // Create delivery if needed
    if (orderData.order_type === 'delivery' && orderData.delivery) {
      const deliveryCreateInput: Prisma.DeliveryCreateInput = {
        order: { connect: { id: order.id } },
        delivery_id: BigInt(Date.now()),
        estimated_delivery_time: new Date(Date.now() + 60 * 60 * 1000),
        delivery_address: orderData.delivery_address,
        customer_latitude: orderData.customer_latitude || null,
        customer_longitude: orderData.customer_longitude || null,
        customer_location_note: orderData.customer_location_note || null,
        delivery_fee: orderData.delivery.delivery_fee,
        customer_note: orderData.delivery.customer_note,
      };

      if (orderData.delivery.carrier_id) {
        deliveryCreateInput.carrier_id = orderData.delivery.carrier_id;
      }
      if (orderData.delivery.employee_id) {
        deliveryCreateInput.employee = {
          connect: { id: orderData.delivery.employee_id },
        };
      }

      await this.prisma.delivery.create({
        data: deliveryCreateInput,
      });
    }

    // 🔥 NEW: Send order creation notification
    try {
      const createdOrder = await this.findOne(order.id);

      // Notify customer about order creation
      if (createdOrder.user?.id) {
        await this.customerNotificationsService.createOrderStatusNotification(
          createdOrder,
          'confirmed',
          estimatedReadyTime
            ? `ເວລາເຄື່ອງໄວ້ປະມານ: ${estimatedReadyTime.toLocaleTimeString(
                'lo-LA',
                {
                  hour: '2-digit',
                  minute: '2-digit',
                },
              )}`
            : undefined,
        );
      }

      // Notify employees about new order
      await this.customerNotificationsService.create({
        message: `ມີຄຳສັ່ງຊື້ໃໝ່ #${uniqueOrderId} (${orderData.order_type})`,
        type: 'new_order',
        order_id: order.id,
        target_roles: ['admin', 'employee'],
        action_url: `/admin/orders/${order.id}`,
      });
    } catch (notificationError) {
      console.error(
        'Failed to send order creation notifications:',
        notificationError,
      );
      // Don't fail the order creation if notification fails
    }

    const result = await this.findOne(order.id);
    return result;
  }

  async findAll(
    status?: string,
    userId?: number,
    employeeId?: number,
    orderType?: string,
  ): Promise<OrderWithRelations[]> {
    const where: Prisma.OrderWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.User_id = userId;
    }

    if (employeeId) {
      where.Employee_id = employeeId;
    }

    if (orderType) {
      where.order_type = orderType;
    }

    const orders = await this.prisma.order.findMany({
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
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
        table: true,
        promotion: true,
        order_details: {
          include: {
            food_menu: true,
            beverage_menu: true,
          },
        },
        delivery: true,
        timeline: {
          orderBy: {
            timestamp: 'desc',
          },
        },
        time_updates: {
          orderBy: {
            created_at: 'desc',
          },
        },
      },
      orderBy: {
        create_at: 'desc',
      },
    });

    return orders as OrderWithRelations[];
  }

  async findOne(id: number): Promise<OrderWithRelations> {
    const cachedOrder = await this.cacheManager.get(`order:${id}`);
    if (cachedOrder) {
      return cachedOrder as OrderWithRelations;
    }

    const order = await this.prisma.order.findUnique({
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
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
        table: true,
        promotion: true,
        order_details: {
          include: {
            food_menu: true,
            beverage_menu: true,
          },
        },
        payments: true,
        delivery: true,
        timeline: {
          orderBy: {
            timestamp: 'desc',
          },
        },
        time_updates: {
          orderBy: {
            created_at: 'desc',
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    await this.cacheManager.set(`order:${id}`, order, 60000);

    return order as OrderWithRelations;
  }

  async findByOrderId(orderIdString: string): Promise<OrderWithRelations> {
    const order = await this.prisma.order.findUnique({
      where: { order_id: orderIdString },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
        table: true,
        promotion: true,
        order_details: {
          include: {
            food_menu: true,
            beverage_menu: true,
          },
        },
        payments: true,
        delivery: true,
        timeline: {
          orderBy: {
            timestamp: 'desc',
          },
        },
        time_updates: {
          orderBy: {
            created_at: 'desc',
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Order with order_id ${orderIdString} not found`,
      );
    }

    return order;
  }

  async update(
    id: number,
    updateOrderDto: UpdateOrderDto,
  ): Promise<OrderWithRelations> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const existingOrder = await this.findOne(id);

    if (updateOrderDto.User_id) {
      const user = await this.prisma.user.findUnique({
        where: { id: updateOrderDto.User_id },
      });
      if (!user) {
        throw new NotFoundException(
          `User with ID ${updateOrderDto.User_id} not found`,
        );
      }
    }

    if (updateOrderDto.Employee_id) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: updateOrderDto.Employee_id },
      });
      if (!employee) {
        throw new NotFoundException(
          `Employee with ID ${updateOrderDto.Employee_id} not found`,
        );
      }
    }

    if (updateOrderDto.table_id) {
      const table = await this.prisma.table.findUnique({
        where: { id: updateOrderDto.table_id },
      });
      if (!table) {
        throw new NotFoundException(
          `Table with ID ${updateOrderDto.table_id} not found`,
        );
      }
    }

    if (updateOrderDto.promotion_id) {
      const promotion = await this.prisma.promotion.findUnique({
        where: { id: updateOrderDto.promotion_id },
      });
      if (!promotion) {
        throw new NotFoundException(
          `Promotion with ID ${updateOrderDto.promotion_id} not found`,
        );
      }
    }

    const { order_details, ...orderData } = updateOrderDto;

    const orderUpdateInput: Prisma.OrderUpdateInput = {};

    if (orderData.status !== undefined)
      orderUpdateInput.status = orderData.status;
    if (orderData.total_price !== undefined)
      orderUpdateInput.total_price = orderData.total_price;
    if (orderData.order_type !== undefined)
      orderUpdateInput.order_type = orderData.order_type;
    if (orderData.pickup_time !== undefined)
      orderUpdateInput.pickup_time = orderData.pickup_time;
    if (orderData.discount_amount !== undefined)
      orderUpdateInput.discount_amount = orderData.discount_amount;
    if (orderData.preparation_notes !== undefined)
      orderUpdateInput.preparation_notes = orderData.preparation_notes;

    if (orderData.User_id !== undefined) {
      orderUpdateInput.user = { connect: { id: orderData.User_id } };
    }
    if (orderData.Employee_id !== undefined) {
      orderUpdateInput.employee = { connect: { id: orderData.Employee_id } };
    }
    if (orderData.table_id !== undefined) {
      orderUpdateInput.table = { connect: { id: orderData.table_id } };
    }
    if (orderData.promotion_id !== undefined) {
      orderUpdateInput.promotion = { connect: { id: orderData.promotion_id } };
    }

    await this.prisma.order.update({
      where: { id },
      data: orderUpdateInput,
    });

    // Update order details
    if (order_details && order_details.length > 0) {
      await Promise.all(
        order_details.map(async (detail) => {
          if (detail.id) {
            return this.prisma.orderDetail.update({
              where: { id: detail.id },
              data: {
                food_menu_id: detail.food_menu_id,
                beverage_menu_id: detail.beverage_menu_id,
                quantity: detail.quantity,
                price: detail.price,
                notes: detail.notes,
                status_id: detail.status_id,
                preparation_time: detail.preparation_time,
                is_ready: detail.is_ready,
              },
            });
          } else {
            return this.prisma.orderDetail.create({
              data: {
                ...detail,
                order_id: id,
                quantity: detail.quantity ?? 1,
                price: detail.price ?? 0,
                preparation_time: detail.preparation_time || 15,
              },
            });
          }
        }),
      );
    }

    await this.cacheManager.del(`order:${id}`);

    const result = await this.findOne(id);
    return result;
  }

  async updateStatus(
    id: number,
    status: string,
    employeeId?: number,
    notes?: string,
  ): Promise<OrderWithRelations> {
    const orderData = await this.findOne(id);

    await this.prisma.order.update({
      where: { id },
      data: { status },
    });

    await this.prisma.orderTimeline.create({
      data: {
        order_id: id,
        status,
        employee_id: employeeId,
        notes: notes || `Status updated to ${status}`,
      },
    });

    if (status === 'ready') {
      await this.prisma.order.update({
        where: { id },
        data: { actual_ready_time: new Date() },
      });
    }

    // Handle delivery status updates
    if (orderData.order_type === 'delivery' && status === 'in_delivery') {
      await this.prisma.delivery.update({
        where: { order_id: id },
        data: {
          status: 'delivery',
          pickup_from_kitchen_time: new Date(),
        },
      });
    }

    if (orderData.order_type === 'delivery' && status === 'delivered') {
      await this.prisma.delivery.update({
        where: { order_id: id },
        data: {
          status: 'delivered',
          actual_delivery_time: new Date(),
        },
      });
    }

    // 🔥 NEW: Send status update notification
    try {
      const updatedOrder = await this.findOne(id);

      // Send notification to customer
      if (updatedOrder.user?.id) {
        await this.customerNotificationsService.createOrderStatusNotification(
          updatedOrder,
          status,
          notes,
        );
      }

      // Send notification to employees for important status changes
      if (['ready', 'completed', 'cancelled'].includes(status)) {
        await this.customerNotificationsService.create({
          message: `ຄຳສັ່ງຊື້ #${updatedOrder.order_id} ປ່ຽນສະຖານະເປັນ: ${status}`,
          type: 'order_update',
          order_id: id,
          target_roles: ['admin', 'employee'],
          action_url: `/admin/orders/${id}`,
        });
      }
    } catch (notificationError) {
      console.error(
        'Failed to send status update notifications:',
        notificationError,
      );
      // Don't fail the status update if notification fails
    }

    await this.cacheManager.del(`order:${id}`);

    const result = await this.findOne(id);
    return result;
  }

  async updateTime(
    id: number,
    updateTimeDto: UpdateTimeDto,
  ): Promise<OrderWithRelations> {
    const orderData = await this.findOne(id);

    let previousTime: Date | null = null;
    if (updateTimeDto.timeType === 'estimated_ready_time') {
      previousTime = orderData.estimated_ready_time ?? null;
    } else if (updateTimeDto.timeType === 'pickup_time') {
      previousTime = orderData.pickup_time ?? null;
    } else if (orderData.order_type === 'delivery' && orderData.delivery) {
      if (updateTimeDto.timeType === 'estimated_delivery_time') {
        previousTime = orderData.delivery.estimated_delivery_time ?? null;
      }
    }

    if (
      updateTimeDto.timeType === 'estimated_ready_time' ||
      updateTimeDto.timeType === 'pickup_time'
    ) {
      await this.prisma.order.update({
        where: { id },
        data: {
          [updateTimeDto.timeType]: updateTimeDto.newTime,
        },
      });
    } else if (
      updateTimeDto.timeType === 'estimated_delivery_time' &&
      orderData.order_type === 'delivery'
    ) {
      await this.prisma.delivery.update({
        where: { order_id: id },
        data: {
          estimated_delivery_time: updateTimeDto.newTime,
        },
      });
    } else {
      throw new BadRequestException('Invalid time type');
    }

    await this.prisma.timeUpdate.create({
      data: {
        order_id: id,
        previous_time: previousTime,
        new_time: updateTimeDto.newTime,
        reason: updateTimeDto.reason,
        updated_by: updateTimeDto.employeeId,
        notified_customer: updateTimeDto.notifyCustomer || false,
      },
    });

    // 🔥 NEW: Send time update notification
    try {
      const updatedOrder = await this.findOne(id);

      if (
        updateTimeDto.notifyCustomer &&
        updatedOrder.user?.id &&
        previousTime
      ) {
        await this.customerNotificationsService.createOrderTimeChangeNotification(
          updatedOrder,
          previousTime,
          updateTimeDto.newTime,
          updateTimeDto.reason,
        );
      }

      // Also create a general notification
      if (updateTimeDto.notifyCustomer && updatedOrder.User_id) {
        await this.customerNotificationsService.create({
          user_id: updatedOrder.User_id,
          order_id: id,
          message:
            updateTimeDto.notificationMessage ||
            `ເວລາຄຳສັ່ງຊື້ #${updatedOrder.order_id} ມີການປ່ຽນແປງ. ເວລາໃໝ່: ${updateTimeDto.newTime.toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' })}`,
          type: 'time_change',
          action_url: `/orders/${updatedOrder.order_id}`,
        });
      }
    } catch (notificationError) {
      console.error(
        'Failed to send time update notifications:',
        notificationError,
      );
      // Don't fail the time update if notification fails
    }

    await this.cacheManager.del(`order:${id}`);

    const result = await this.findOne(id);
    return result;
  }

  async createOrderTimeline(
    id: number,
    status: string,
    employeeId?: number,
    notes?: string,
  ): Promise<OrderTimeline> {
    await this.findOne(id);

    const timeline = await this.prisma.orderTimeline.create({
      data: {
        order_id: id,
        status,
        employee_id: employeeId,
        notes,
      },
    });

    await this.cacheManager.del(`order:${id}`);

    return timeline;
  }

  async markOrderItemReady(
    orderId: number,
    orderDetailId: number,
  ): Promise<OrderWithRelations> {
    await this.findOne(orderId);

    const orderDetail = await this.prisma.orderDetail.findFirst({
      where: {
        id: orderDetailId,
        order_id: orderId,
      },
    });

    if (!orderDetail) {
      throw new NotFoundException(
        `Order detail with ID ${orderDetailId} not found for order ${orderId}`,
      );
    }

    await this.prisma.orderDetail.update({
      where: { id: orderDetailId },
      data: { is_ready: true },
    });

    const allOrderDetails = await this.prisma.orderDetail.findMany({
      where: { order_id: orderId },
    });

    const allReady = allOrderDetails.every((detail) => detail.is_ready);

    if (allReady) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          actual_ready_time: new Date(),
          status: 'ready',
        },
      });

      await this.prisma.orderTimeline.create({
        data: {
          order_id: orderId,
          status: 'ready',
          notes: 'All items are ready',
        },
      });

      // 🔥 NEW: Send ready notification
      try {
        const updatedOrder = await this.findOne(orderId);

        if (updatedOrder.user?.id) {
          await this.customerNotificationsService.createOrderStatusNotification(
            updatedOrder,
            'ready',
            'ເມນູທັງໝົດພ້ອມແລ້ວ',
          );
        }
      } catch (notificationError) {
        console.error('Failed to send ready notification:', notificationError);
      }
    }

    await this.cacheManager.del(`order:${orderId}`);

    const result = await this.findOne(orderId);
    return result;
  }

  async assignPickupCode(id: number): Promise<OrderWithRelations> {
    const orderData = await this.findOne(id);

    if (orderData.order_type !== 'pickup') {
      throw new BadRequestException(
        'Pickup code can only be assigned to pickup orders',
      );
    }

    const pickupCode = Math.floor(100000 + Math.random() * 900000).toString();

    await this.prisma.order.update({
      where: { id },
      data: { pickup_code: pickupCode },
    });

    // 🔥 NEW: Send pickup code notification
    try {
      if (orderData.User_id) {
        await this.customerNotificationsService.create({
          user_id: orderData.User_id,
          order_id: id,
          message: `ຄຳສັ່ງຊື້ #${orderData.order_id} ພ້ອມໃຫ້ມາຮັບແລ້ວ. ລະຫັດຮັບເອົາ: ${pickupCode}`,
          type: 'pickup_ready',
          action_url: `/orders/${orderData.order_id}`,
        });
      }
    } catch (notificationError) {
      console.error(
        'Failed to send pickup code notification:',
        notificationError,
      );
    }

    await this.cacheManager.del(`order:${id}`);

    const result = await this.findOne(id);
    return result;
  }

  async createOrderHistory(id: number): Promise<OrderHistory> {
    const orderData = await this.findOne(id);

    if (!orderData.User_id) {
      throw new NotFoundException('This order has no associated user');
    }

    const orderItems = orderData.order_details.map((detail) => {
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

    const orderHistory = await this.prisma.orderHistory.create({
      data: {
        user: { connect: { id: orderData.User_id } },
        order_id: orderData.order_id,
        order_date: orderData.create_at,
        total_amount: orderData.total_price,
        order_type: orderData.order_type,
        status: orderData.status,
        items: orderItems as InputJsonValue,
        payment_method: orderData.payments?.[0]?.method || null,
        delivery_address: orderData.delivery?.delivery_address || null,
      },
    });

    return orderHistory;
  }

  async remove(id: number): Promise<{ message: string }> {
    await this.findOne(id);

    await this.prisma.orderDetail.deleteMany({
      where: { order_id: id },
    });

    await this.prisma.timeUpdate.deleteMany({
      where: { order_id: id },
    });

    await this.prisma.orderTimeline.deleteMany({
      where: { order_id: id },
    });

    if (await this.prisma.delivery.findUnique({ where: { order_id: id } })) {
      await this.prisma.delivery.delete({
        where: { order_id: id },
      });
    }

    await this.prisma.order.delete({
      where: { id },
    });

    await this.cacheManager.del(`order:${id}`);

    return { message: 'Order deleted successfully' };
  }
}
