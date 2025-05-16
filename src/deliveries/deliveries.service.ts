import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerNotificationsService } from '../customer-notifications/customer-notifications.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { UpdateDeliveryTimeDto } from './dto/update-delivery-time.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { DeliveryStatus } from './enums/delivery-status.enum';
import { UpdateLocationDto } from './dto/update-location.dto';
import { Prisma, Delivery } from '@prisma/client';
import { LocationHistoryEntry } from './interface/types';

interface DeliveryWithRelations extends Delivery {
  order: {
    id: number;
    order_id: string;
    User_id: number | null;
    create_at: Date;
    total_price: number;
    user?: {
      id: number;
      email: string;
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  };
  employee?: {
    id: number;
    first_name: string;
    last_name: string;
    phone?: string | null;
  } | null;
}

@Injectable()
export class DeliveriesService {
  private readonly logger = new Logger(DeliveriesService.name);
  private readonly validStatusTransitions: Record<
    DeliveryStatus,
    DeliveryStatus[]
  > = {
    [DeliveryStatus.PENDING]: [
      DeliveryStatus.PREPARING,
      DeliveryStatus.CANCELLED,
    ],
    [DeliveryStatus.PREPARING]: [
      DeliveryStatus.OUT_FOR_DELIVERY,
      DeliveryStatus.CANCELLED,
    ],
    [DeliveryStatus.OUT_FOR_DELIVERY]: [
      DeliveryStatus.DELIVERED,
      DeliveryStatus.CANCELLED,
    ],
    [DeliveryStatus.DELIVERED]: [],
    [DeliveryStatus.CANCELLED]: [],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: CustomerNotificationsService,
  ) {}

  private async createDeliveryNotification(
    orderId: number,
    status: DeliveryStatus,
    estimatedTime?: Date,
    customMessage?: string,
  ): Promise<void> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        select: {
          User_id: true,
          order_id: true,
        },
      });

      if (!order?.User_id) {
        return;
      }

      let message = customMessage;
      if (!message) {
        message = this.generateStatusNotificationMessage(
          order.order_id,
          status,
          estimatedTime,
        );
      }

      await this.notificationsService.create({
        user_id: order.User_id,
        order_id: orderId,
        message,
        type: 'delivery_update',
        action_url: '/delivery',
        read: false,
      });
    } catch (error) {
      this.logger.error(
        `Failed to create delivery notification for order ${orderId}:`,
        error,
      );
    }
  }

  private generateStatusNotificationMessage(
    orderNumber: string,
    status: DeliveryStatus,
    estimatedTime?: Date,
  ): string {
    switch (status) {
      case DeliveryStatus.PENDING:
        return `Your delivery order #${orderNumber} is being processed. We'll notify you when it's ready for delivery.`;
      case DeliveryStatus.PREPARING:
        return `Your order #${orderNumber} is being prepared. It will be ready for delivery soon.`;
      case DeliveryStatus.OUT_FOR_DELIVERY: {
        const eta = estimatedTime
          ? `and should arrive by ${estimatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
          : '';
        return `Your order #${orderNumber} is on the way ${eta}.`;
      }
      case DeliveryStatus.DELIVERED:
        return `Your order #${orderNumber} has been delivered. Enjoy your meal!`;
      case DeliveryStatus.CANCELLED:
        return `Your delivery for order #${orderNumber} has been cancelled. Contact customer service for more information.`;
      default:
        return `Your delivery for order #${orderNumber} has been updated to status: ${String(status)}`;
    }
  }

  async create(createDeliveryDto: CreateDeliveryDto) {
    const { order_id, employee_id } = createDeliveryDto;

    const order = await this.prisma.order.findUnique({
      where: { id: order_id },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${order_id} not found`);
    }

    if (order.order_type !== 'delivery') {
      throw new BadRequestException(
        `Order with ID ${order_id} is not a delivery order. Order type: ${order.order_type}`,
      );
    }

    const existingDelivery = await this.prisma.delivery.findUnique({
      where: { order_id },
    });

    if (existingDelivery) {
      throw new ConflictException(
        `Delivery for order with ID ${order_id} already exists`,
      );
    }

    if (employee_id) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: employee_id },
      });

      if (!employee) {
        throw new NotFoundException(
          `Employee with ID ${employee_id} not found`,
        );
      }
    }

    const deliveryId = BigInt(Date.now());
    const estimatedDeliveryTime = createDeliveryDto.estimated_delivery_time
      ? new Date(createDeliveryDto.estimated_delivery_time)
      : new Date(Date.now() + 60 * 60 * 1000);

    const status = createDeliveryDto.status ?? DeliveryStatus.PENDING;

    try {
      const delivery = await this.prisma.delivery.create({
        data: {
          ...createDeliveryDto,
          delivery_id: deliveryId,
          estimated_delivery_time: estimatedDeliveryTime,
          status,
        },
        include: {
          order: true,
          employee: true,
        },
      });

      if (status === DeliveryStatus.OUT_FOR_DELIVERY) {
        await this.updateOrderStatus(order.id, status, employee_id);
      }

      await this.createDeliveryNotification(
        order.id,
        status,
        estimatedDeliveryTime,
      );

      return {
        ...delivery,
        delivery_id: delivery.delivery_id.toString(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to create delivery for order ${order_id}:`,
        error,
      );
      throw new BadRequestException(
        `Failed to create delivery for order ${order_id}`,
      );
    }
  }

  private async updateOrderStatus(
    orderId: number,
    status: DeliveryStatus,
    employeeId?: number,
    notes?: string,
  ): Promise<void> {
    await this.prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    await this.prisma.orderTimeline.create({
      data: {
        order_id: orderId,
        status,
        employee_id: employeeId,
        notes: notes || `Status updated to ${status}`,
        timestamp: new Date(),
      },
    });
  }

  async findAll(status?: DeliveryStatus, employeeId?: number) {
    const where: Prisma.DeliveryWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (employeeId) {
      where.employee_id = employeeId;
    }

    try {
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
    } catch (error) {
      this.logger.error('Failed to fetch deliveries:', error);
      throw new BadRequestException('Failed to fetch deliveries');
    }
  }

  async findOne(id: number): Promise<DeliveryWithRelations> {
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
      delivery_id: delivery.delivery_id,
    } as DeliveryWithRelations;
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
      await this.validateOrderForDelivery(updateDeliveryDto.order_id, id);
    }

    if (updateDeliveryDto.employee_id) {
      await this.validateEmployee(updateDeliveryDto.employee_id);
    }

    const data: Prisma.DeliveryUpdateInput = { ...updateDeliveryDto };
    if (updateDeliveryDto.estimated_delivery_time) {
      data.estimated_delivery_time = new Date(
        updateDeliveryDto.estimated_delivery_time,
      );
    }

    try {
      const updatedDelivery = await this.prisma.delivery.update({
        where: { id },
        data,
        include: {
          order: true,
          employee: true,
        },
      });

      const updatedStatus = updateDeliveryDto.status;
      const currentStatus = existingDelivery.status as DeliveryStatus;

      if (updatedStatus && updatedStatus !== currentStatus) {
        await this.handleStatusChange(
          existingDelivery,
          updatedStatus,
          updateDeliveryDto.employee_id ??
            existingDelivery.employee_id ??
            undefined,
        );
      }

      return {
        ...updatedDelivery,
        delivery_id: updatedDelivery.delivery_id.toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to update delivery ${id}:`, error);
      throw new BadRequestException(`Failed to update delivery ${id}`);
    }
  }

  private async validateOrderForDelivery(
    orderId: number,
    deliveryId?: number,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.order_type !== 'delivery') {
      throw new BadRequestException(
        `Order with ID ${orderId} is not a delivery order. Order type: ${order.order_type}`,
      );
    }

    const anotherDelivery = await this.prisma.delivery.findUnique({
      where: { order_id: orderId },
    });

    if (anotherDelivery && (!deliveryId || anotherDelivery.id !== deliveryId)) {
      throw new ConflictException(
        `Delivery for order with ID ${orderId} already exists`,
      );
    }
  }

  private async validateEmployee(employeeId: number): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }
  }

  private async handleStatusChange(
    delivery: DeliveryWithRelations,
    newStatus: DeliveryStatus,
    employeeId?: number,
    notes?: string,
  ): Promise<void> {
    const estimatedTime = delivery.estimated_delivery_time || undefined;

    await this.createDeliveryNotification(
      delivery.order_id,
      newStatus,
      estimatedTime,
      notes,
    );

    await this.prisma.orderTimeline.create({
      data: {
        order_id: delivery.order_id,
        status: newStatus,
        employee_id: employeeId,
        notes: notes || `Status updated to ${newStatus}`,
        timestamp: new Date(),
      },
    });

    if (
      newStatus === DeliveryStatus.DELIVERED &&
      (delivery.status as DeliveryStatus) !== DeliveryStatus.DELIVERED
    ) {
      await this.handleDeliveryCompletion(delivery, employeeId, notes);
    }

    if (
      newStatus === DeliveryStatus.OUT_FOR_DELIVERY &&
      (delivery.status as DeliveryStatus) !== DeliveryStatus.OUT_FOR_DELIVERY &&
      !delivery.pickup_from_kitchen_time
    ) {
      await this.handleOutForDelivery(delivery, employeeId, notes);
    }
  }

  private async handleDeliveryCompletion(
    delivery: DeliveryWithRelations,
    employeeId?: number,
    notes?: string,
  ): Promise<void> {
    const now = new Date();

    await this.prisma.delivery.update({
      where: { id: delivery.id },
      data: { actual_delivery_time: now },
    });

    await this.prisma.order.update({
      where: { id: delivery.order_id },
      data: { status: DeliveryStatus.DELIVERED },
    });

    await this.prisma.orderTimeline.create({
      data: {
        order_id: delivery.order_id,
        status: DeliveryStatus.DELIVERED,
        employee_id: employeeId,
        notes: notes || 'Order delivered to customer',
        timestamp: now,
      },
    });

    if (delivery.order?.User_id) {
      await this.createOrderHistory(delivery);
    }
  }

  private async createOrderHistory(
    delivery: DeliveryWithRelations,
  ): Promise<void> {
    try {
      const orderData = delivery.order;
      const orderDetails = await this.prisma.orderDetail.findMany({
        where: { order_id: delivery.order_id },
        include: { food_menu: true, beverage_menu: true },
      });

      const items = orderDetails.map((detail) => ({
        name:
          detail.food_menu?.name ||
          detail.beverage_menu?.name ||
          'Unknown Item',
        quantity: detail.quantity,
        price: detail.price,
        notes: detail.notes,
      }));

      await this.prisma.orderHistory.create({
        data: {
          user_id: orderData.User_id || 0,
          order_id: orderData.order_id,
          order_date: orderData.create_at,
          total_amount: orderData.total_price,
          order_type: 'delivery',
          status: DeliveryStatus.DELIVERED,
          items,
          delivery_address: delivery.delivery_address,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create order history for order ${delivery.order_id}:`,
        error,
      );
    }
  }

  private async handleOutForDelivery(
    delivery: DeliveryWithRelations,
    employeeId?: number,
    notes?: string,
  ): Promise<void> {
    await this.prisma.delivery.update({
      where: { id: delivery.id },
      data: { pickup_from_kitchen_time: new Date() },
    });

    await this.prisma.orderTimeline.create({
      data: {
        order_id: delivery.order_id,
        status: DeliveryStatus.OUT_FOR_DELIVERY,
        employee_id: employeeId,
        notes: notes || 'Order picked up from kitchen for delivery',
        timestamp: new Date(),
      },
    });
  }

  async updateStatus(id: number, updateStatusDto: UpdateStatusDto) {
    try {
      const { status, notes } = updateStatusDto;
      const delivery = await this.findOne(id);

      const currentStatus = delivery.status as DeliveryStatus;

      if (!this.validStatusTransitions[currentStatus].includes(status)) {
        throw new BadRequestException(
          `Cannot transition from ${currentStatus} to ${status}`,
        );
      }

      if (status === DeliveryStatus.OUT_FOR_DELIVERY && !delivery.employee_id) {
        throw new BadRequestException(
          'Employee ID is required for out_for_delivery status',
        );
      }

      const updatedDelivery = await this.prisma.delivery.update({
        where: { id },
        data: { status, notes },
      });

      if (status !== currentStatus) {
        const employeeId = delivery.employee_id ?? undefined;
        await this.handleStatusChange(delivery, status, employeeId, notes);
      }

      return {
        ...updatedDelivery,
        delivery_id: updatedDelivery.delivery_id.toString(),
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(`Failed to update status for delivery ${id}:`, error);
      throw new BadRequestException('Failed to update delivery status');
    }
  }

  async updateTime(id: number, updateTimeDto: UpdateDeliveryTimeDto) {
    const delivery = await this.findOne(id);
    const orderData = delivery.order;

    let previousTime: Date | undefined;
    if (updateTimeDto.timeType === 'estimated_delivery_time') {
      previousTime = delivery.estimated_delivery_time || undefined;
    } else if (updateTimeDto.timeType === 'pickup_from_kitchen_time') {
      previousTime = delivery.pickup_from_kitchen_time || undefined;
    }

    try {
      const newTimeDate = new Date(updateTimeDto.newTime);

      const updatedDelivery = await this.prisma.delivery.update({
        where: { id },
        data: {
          [updateTimeDto.timeType]: newTimeDate,
        },
      });

      await this.prisma.timeUpdate.create({
        data: {
          order_id: delivery.order_id,
          previous_time: previousTime,
          new_time: newTimeDate,
          reason: updateTimeDto.reason,
          updated_by: updateTimeDto.employeeId,
          notified_customer: updateTimeDto.notifyCustomer || false,
        },
      });

      if (
        updateTimeDto.notifyCustomer &&
        updateTimeDto.timeType === 'estimated_delivery_time'
      ) {
        const deliveryTimeStr = newTimeDate.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        const message =
          updateTimeDto.notificationMessage ||
          `Your delivery time for order #${orderData.order_id} has been updated. New estimated delivery time: ${deliveryTimeStr}.`;

        await this.createDeliveryNotification(
          delivery.order_id,
          delivery.status as DeliveryStatus,
          newTimeDate,
          message,
        );
      }

      return {
        ...updatedDelivery,
        delivery_id: updatedDelivery.delivery_id.toString(),
      };
    } catch (error) {
      this.logger.error(`Failed to update time for delivery ${id}:`, error);
      throw new BadRequestException(`Failed to update delivery time`);
    }
  }

  async updateLocation(id: number, updateLocationDto: UpdateLocationDto) {
    const delivery = await this.findOne(id);

    if (
      (delivery.status as DeliveryStatus) !== DeliveryStatus.OUT_FOR_DELIVERY
    ) {
      throw new BadRequestException(
        'Location can only be updated for deliveries that are out for delivery',
      );
    }

    try {
      const locationHistory = this.parseLocationHistory(delivery);

      if (delivery.last_latitude && delivery.last_longitude) {
        locationHistory.push({
          latitude: delivery.last_latitude,
          longitude: delivery.last_longitude,
          timestamp: delivery.last_location_update,
          note: updateLocationDto.locationNote || '',
        });
      }

      const now = new Date();
      const updatedDelivery = await this.prisma.delivery.update({
        where: { id },
        data: {
          last_latitude: updateLocationDto.latitude,
          last_longitude: updateLocationDto.longitude,
          last_location_update: now,
          location_history:
            locationHistory.length > 0
              ? JSON.stringify(locationHistory)
              : undefined,
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
          employee: true,
        },
      });

      if (updateLocationDto.notifyCustomer && updatedDelivery.order?.user?.id) {
        await this.notifyLocationUpdate(updatedDelivery);
      }

      return {
        ...updatedDelivery,
        delivery_id: updatedDelivery.delivery_id.toString(),
        location: {
          latitude: updatedDelivery.last_latitude,
          longitude: updatedDelivery.last_longitude,
          lastUpdate: updatedDelivery.last_location_update,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update location for delivery ${id}:`, error);
      throw new BadRequestException('Failed to update delivery location');
    }
  }

  private parseLocationHistory(
    delivery: DeliveryWithRelations,
  ): LocationHistoryEntry[] {
    if (!delivery.location_history) {
      return [];
    }

    try {
      return JSON.parse(
        delivery.location_history as string,
      ) as LocationHistoryEntry[];
    } catch {
      this.logger.warn(
        `Failed to parse location history for delivery ${delivery.id}`,
      );
      return [];
    }
  }

  private async notifyLocationUpdate(
    delivery: DeliveryWithRelations,
  ): Promise<void> {
    try {
      const employeeName = delivery.employee
        ? `${delivery.employee.first_name || ''} ${delivery.employee.last_name || ''}`.trim()
        : 'The delivery person';

      const message = `${employeeName} has updated their location for your order #${delivery.order.order_id}. You can track the delivery on the map.`;

      await this.notificationsService.create({
        user_id: delivery.order.user?.id || 0,
        order_id: delivery.order_id,
        message,
        type: 'location_update',
        action_url: `/delivery/${delivery.id}/track`,
        read: false,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send location notification for delivery ${delivery.id}:`,
        error,
      );
    }
  }

  async getLocation(id: number) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      select: {
        id: true,
        order_id: true,
        last_latitude: true,
        last_longitude: true,
        last_location_update: true,
        status: true,
        delivery_address: true,
        employee_id: true,
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            phone: true,
          },
        },
        order: {
          select: {
            order_id: true,
            User_id: true,
            user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery with ID ${id} not found`);
    }

    if (!delivery.last_latitude || !delivery.last_longitude) {
      return {
        id: delivery.id,
        order_id: delivery.order_id,
        location: null,
        message: 'No location data available for this delivery yet.',
        status: delivery.status,
        delivery_address: delivery.delivery_address,
        employee: delivery.employee,
        order: delivery.order,
      };
    }

    return {
      id: delivery.id,
      order_id: delivery.order_id,
      location: {
        latitude: delivery.last_latitude,
        longitude: delivery.last_longitude,
        lastUpdate: delivery.last_location_update,
      },
      status: delivery.status,
      delivery_address: delivery.delivery_address,
      employee: delivery.employee,
      order: delivery.order,
    };
  }

  async getLocationHistory(id: number) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      select: {
        id: true,
        order_id: true,
        location_history: true,
        status: true,
        last_latitude: true,
        last_longitude: true,
        last_location_update: true,
      },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery with ID ${id} not found`);
    }

    const locationHistory = this.parseLocationHistory(
      delivery as DeliveryWithRelations,
    );

    if (delivery.last_latitude && delivery.last_longitude) {
      locationHistory.push({
        latitude: delivery.last_latitude,
        longitude: delivery.last_longitude,
        timestamp: delivery.last_location_update,
        current: true,
      });
    }

    return {
      id: delivery.id,
      order_id: delivery.order_id,
      status: delivery.status,
      locationHistory,
    };
  }

  async remove(id: number) {
    await this.findOne(id);

    try {
      await this.prisma.delivery.delete({
        where: { id },
      });
      return { message: 'Delivery deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete delivery ${id}:`, error);
      throw new BadRequestException(`Failed to delete delivery ${id}`);
    }
  }
}
