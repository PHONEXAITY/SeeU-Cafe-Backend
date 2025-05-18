// src/deliveries/deliveries.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerNotificationsService } from '../customer-notifications/customer-notifications.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { UpdateDeliveryTimeDto } from './dto/update-delivery-time.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { QueryDeliveryDto } from './dto/query-delivery.dto';
import { DeliveryStatus, DeliveryTimeType } from './enums/delivery-status.enum';
import { Prisma, Delivery } from '@prisma/client';
import {
  LocationHistoryEntry,
  DeliveryWithDetails,
  DeliveryLocationInfo,
  DeliveryNotificationPayload,
} from './interface/types';

@Injectable()
export class DeliveriesService {
  private readonly logger = new Logger(DeliveriesService.name);

  // Define valid status transitions based on business logic
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
    [DeliveryStatus.DELIVERED]: [], // No transitions allowed from delivered
    [DeliveryStatus.CANCELLED]: [], // No transitions allowed from cancelled
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: CustomerNotificationsService,
  ) {}

  /**
   * Create a new delivery
   */
  async create(createDeliveryDto: CreateDeliveryDto): Promise<Delivery> {
    this.logger.log(
      `Creating delivery for order ${createDeliveryDto.order_id}`,
    );

    // Validate order exists and is eligible for delivery
    await this.validateOrderForDelivery(createDeliveryDto.order_id);

    // Validate employee if provided
    if (createDeliveryDto.employee_id) {
      await this.validateEmployee(createDeliveryDto.employee_id);
    }

    // Check if delivery already exists for this order
    const existingDelivery = await this.prisma.delivery.findUnique({
      where: { order_id: createDeliveryDto.order_id },
    });

    if (existingDelivery) {
      throw new ConflictException(
        `Delivery for order ${createDeliveryDto.order_id} already exists`,
      );
    }

    // Generate unique delivery ID
    const deliveryId = BigInt(Date.now());

    // Set default estimated delivery time if not provided (1 hour from now)
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
          order: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  first_name: true,
                  last_name: true,
                  phone: true,
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

      // Update order status to reflect delivery creation
      if (status === DeliveryStatus.OUT_FOR_DELIVERY) {
        await this.updateOrderStatus(
          createDeliveryDto.order_id,
          'out_for_delivery',
          createDeliveryDto.employee_id,
          'Order assigned for delivery',
        );
      }

      // Send notification to customer
      await this.createDeliveryNotification(
        createDeliveryDto.order_id,
        status,
        estimatedDeliveryTime,
      );

      this.logger.log(
        `Successfully created delivery ${delivery.id} for order ${createDeliveryDto.order_id}`,
      );

      // Return delivery with converted delivery_id
      return {
        ...delivery,
        delivery_id: delivery.delivery_id.toString(),
      } as unknown as Delivery;
    } catch (error) {
      this.logger.error(
        `Failed to create delivery for order ${createDeliveryDto.order_id}:`,
        error,
      );
      throw new BadRequestException(
        `Failed to create delivery: ${error.message}`,
      );
    }
  }

  /**
   * Find all deliveries with filtering and pagination
   */
  async findAll(queryDto: QueryDeliveryDto = {}) {
    const {
      status,
      employeeId,
      search,
      from_date,
      to_date,
      page = 1,
      limit = 10,
    } = queryDto;

    // Build where clause with correct field names from Prisma schema
    const where: Prisma.DeliveryWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (employeeId) {
      where.employee_id = employeeId;
    }

    if (search) {
      where.OR = [
        { delivery_address: { contains: search, mode: 'insensitive' } },
        { customer_note: { contains: search, mode: 'insensitive' } },
        { order: { order_id: { contains: search, mode: 'insensitive' } } },
        {
          order: {
            user: {
              OR: [
                { first_name: { contains: search, mode: 'insensitive' } },
                { last_name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    // Fix: Use created_at from order relation, not directly from delivery
    if (from_date || to_date) {
      where.order = {
        create_at: {
          ...(from_date && { gte: new Date(from_date) }),
          ...(to_date && { lte: new Date(to_date) }),
        },
      };
    }

    try {
      // Get total count for pagination
      const totalCount = await this.prisma.delivery.count({ where });

      // Get paginated results
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
                  phone: true,
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
        orderBy: [
          { status: 'asc' }, // Active deliveries first
          { order: { create_at: 'desc' } },
        ],
        skip: (page - 1) * limit,
        take: limit,
      });

      // Convert BigInt to string for JSON serialization
      const serializedDeliveries = deliveries.map((delivery) => ({
        ...delivery,
        delivery_id: delivery.delivery_id.toString(),
      }));

      return {
        data: serializedDeliveries,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasNextPage: page * limit < totalCount,
          hasPreviousPage: page > 1,
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch deliveries:', error);
      throw new BadRequestException('Failed to fetch deliveries');
    }
  }

  /**
   * Find a single delivery by ID
   */
  async findOne(id: number): Promise<DeliveryWithDetails> {
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
                phone: true,
              },
            },
            order_details: {
              include: {
                food_menu: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                beverage_menu: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
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
            profile_photo: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery with ID ${id} not found`);
    }

    // Convert to DeliveryWithDetails format
    return {
      ...delivery,
      delivery_id: delivery.delivery_id.toString(),
      phone_number: delivery.customer_note || null, // Map from existing field
      created_at: delivery.order.create_at, // Map from order creation date
      updated_at: delivery.order.create_at, // Map from order creation date
    } as DeliveryWithDetails;
  }

  /**
   * Find delivery by order ID
   */
  async findByOrderId(orderId: number): Promise<DeliveryWithDetails> {
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
                phone: true,
              },
            },
            order_details: {
              include: {
                food_menu: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                beverage_menu: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
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
            profile_photo: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery for order ID ${orderId} not found`);
    }

    // Convert to DeliveryWithDetails format
    return {
      ...delivery,
      delivery_id: delivery.delivery_id.toString(),
      phone_number: delivery.customer_note || null, // Map from existing field
      created_at: delivery.order.create_at, // Map from order creation date
      updated_at: delivery.order.create_at, // Map from order creation date
    } as DeliveryWithDetails;
  }

  /**
   * Update delivery details
   */
  async update(
    id: number,
    updateDeliveryDto: UpdateDeliveryDto,
  ): Promise<Delivery> {
    const existingDelivery = await this.findOne(id);

    // Validate employee if being updated
    if (updateDeliveryDto.employee_id) {
      await this.validateEmployee(updateDeliveryDto.employee_id);
    }

    // Format the data for Prisma update
    const updateData: Prisma.DeliveryUpdateInput = { ...updateDeliveryDto };

    if (updateDeliveryDto.estimated_delivery_time) {
      updateData.estimated_delivery_time = new Date(
        updateDeliveryDto.estimated_delivery_time,
      );
    }

    try {
      const updatedDelivery = await this.prisma.delivery.update({
        where: { id },
        data: updateData,
        include: {
          order: true,
          employee: true,
        },
      });

      if (
        updateDeliveryDto.status &&
        updateDeliveryDto.status !== existingDelivery.status
      ) {
        await this.handleStatusChange(
          existingDelivery,
          updateDeliveryDto.status,
          updateDeliveryDto.employee_id ??
            existingDelivery.employee_id ??
            undefined,
        );
      }

      this.logger.log(`Successfully updated delivery ${id}`);

      // Return delivery with converted delivery_id
      return {
        ...updatedDelivery,
        delivery_id: updatedDelivery.delivery_id.toString(),
      } as unknown as Delivery;
    } catch (error) {
      this.logger.error(`Failed to update delivery ${id}:`, error);
      throw new BadRequestException(
        `Failed to update delivery: ${error.message}`,
      );
    }
  }

  /**
   * Update delivery status with validation
   */
  async updateStatus(
    id: number,
    updateStatusDto: UpdateStatusDto,
  ): Promise<Delivery> {
    const delivery = await this.findOne(id);
    const currentStatus = delivery.status;
    const newStatus = updateStatusDto.status;

    // Validate status transition
    if (!this.isValidStatusTransition(currentStatus, newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }

    // Special validation for OUT_FOR_DELIVERY
    if (
      newStatus === DeliveryStatus.OUT_FOR_DELIVERY &&
      !delivery.employee_id
    ) {
      throw new BadRequestException(
        'Employee must be assigned before setting status to OUT_FOR_DELIVERY',
      );
    }

    try {
      const updatedDelivery = await this.prisma.delivery.update({
        where: { id },
        data: {
          status: newStatus,
          notes: updateStatusDto.notes,
        },
        include: {
          order: true,
          employee: true,
        },
      });

      // Handle status-specific actions
      await this.handleStatusChange(
        delivery,
        newStatus,
        delivery.employee_id ?? undefined,
        updateStatusDto.notes,
      );

      this.logger.log(
        `Successfully updated delivery ${id} status to ${newStatus}`,
      );

      // Return delivery with converted delivery_id
      return {
        ...updatedDelivery,
        delivery_id: updatedDelivery.delivery_id.toString(),
      } as unknown as Delivery;
    } catch (error) {
      this.logger.error(`Failed to update status for delivery ${id}:`, error);
      throw new BadRequestException(
        `Failed to update delivery status: ${error.message}`,
      );
    }
  }

  /**
   * Update delivery time
   */
  async updateTime(
    id: number,
    updateTimeDto: UpdateDeliveryTimeDto,
  ): Promise<Delivery> {
    const delivery = await this.findOne(id);
    const orderData = delivery.order;

    let previousTime: Date | undefined;
    if (updateTimeDto.timeType === DeliveryTimeType.ESTIMATED_DELIVERY_TIME) {
      previousTime = delivery.estimated_delivery_time || undefined;
    } else if (
      updateTimeDto.timeType === DeliveryTimeType.PICKUP_FROM_KITCHEN_TIME
    ) {
      previousTime = delivery.pickup_from_kitchen_time || undefined;
    }

    try {
      const newTimeDate = new Date(updateTimeDto.newTime);

      // Validate that the new time is in the future
      if (newTimeDate <= new Date()) {
        throw new BadRequestException('Delivery time must be in the future');
      }

      const updatedDelivery = await this.prisma.delivery.update({
        where: { id },
        data: {
          [updateTimeDto.timeType]: newTimeDate,
        },
        include: {
          order: true,
          employee: true,
        },
      });

      // Create time update record
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

      // Send notification to customer if requested
      if (
        updateTimeDto.notifyCustomer &&
        updateTimeDto.timeType === DeliveryTimeType.ESTIMATED_DELIVERY_TIME
      ) {
        const deliveryTimeStr = newTimeDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });

        const message =
          updateTimeDto.notificationMessage ||
          `Your delivery time for order #${orderData.order_id} has been updated. New estimated delivery time: ${deliveryTimeStr}.`;

        await this.createDeliveryNotification(
          delivery.order_id,
          delivery.status,
          newTimeDate,
          message,
        );
      }

      this.logger.log(
        `Successfully updated ${updateTimeDto.timeType} for delivery ${id}`,
      );

      // Return delivery with converted delivery_id
      return {
        ...updatedDelivery,
        delivery_id: updatedDelivery.delivery_id.toString(),
      } as unknown as Delivery;
    } catch (error) {
      this.logger.error(`Failed to update time for delivery ${id}:`, error);
      throw new BadRequestException(
        `Failed to update delivery time: ${error.message}`,
      );
    }
  }

  /**
   * Update delivery location
   */
  async updateLocation(
    id: number,
    updateLocationDto: UpdateLocationDto,
  ): Promise<DeliveryLocationInfo> {
    const delivery = await this.findOne(id);

    // Only allow location updates for active deliveries
    if (delivery.status !== DeliveryStatus.OUT_FOR_DELIVERY) {
      throw new BadRequestException(
        'Location can only be updated for deliveries with status OUT_FOR_DELIVERY',
      );
    }

    try {
      // Parse existing location history
      const locationHistory = this.parseLocationHistory(delivery);

      // Add current location to history if it exists
      if (delivery.last_latitude && delivery.last_longitude) {
        locationHistory.push({
          latitude: delivery.last_latitude,
          longitude: delivery.last_longitude,
          timestamp: delivery.last_location_update || new Date(),
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
          location_history: JSON.stringify(locationHistory),
        },
        include: {
          order: {
            include: {
              user: {
                select: {
                  id: true,
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
              phone: true,
            },
          },
        },
      });

      // Send notification to customer if requested
      if (updateLocationDto.notifyCustomer && updatedDelivery.order?.user?.id) {
        await this.notifyLocationUpdate(updatedDelivery);
      }

      this.logger.log(`Successfully updated location for delivery ${id}`);

      return {
        id: updatedDelivery.id,
        order_id: updatedDelivery.order_id,
        latitude: updatedDelivery.last_latitude,
        longitude: updatedDelivery.last_longitude,
        lastUpdate: updatedDelivery.last_location_update,
        status: updatedDelivery.status,
        delivery_address: updatedDelivery.delivery_address,
        employee: updatedDelivery.employee,
        order: {
          order_id: updatedDelivery.order.order_id,
          User_id: updatedDelivery.order.User_id,
          user: updatedDelivery.order.user,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update location for delivery ${id}:`, error);
      throw new BadRequestException(
        `Failed to update delivery location: ${error.message}`,
      );
    }
  }

  /**
   * Get delivery location information
   */
  async getLocation(id: number): Promise<DeliveryLocationInfo> {
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

    return {
      id: delivery.id,
      order_id: delivery.order_id,
      latitude: delivery.last_latitude,
      longitude: delivery.last_longitude,
      lastUpdate: delivery.last_location_update,
      status: delivery.status,
      delivery_address: delivery.delivery_address,
      employee: delivery.employee,
      order: delivery.order,
    };
  }

  /**
   * Get delivery location history
   */
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

    const locationHistory = this.parseLocationHistory(delivery);

    // Add current location as the most recent entry
    if (delivery.last_latitude && delivery.last_longitude) {
      locationHistory.push({
        latitude: delivery.last_latitude,
        longitude: delivery.last_longitude,
        timestamp: delivery.last_location_update || new Date(),
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

  /**
   * Delete a delivery
   */
  async remove(id: number): Promise<{ message: string }> {
    const delivery = await this.findOne(id);

    // Only allow deletion if delivery hasn't been completed
    if (delivery.status === DeliveryStatus.OUT_FOR_DELIVERY) {
      throw new ForbiddenException('Cannot delete a completed delivery');
    }

    try {
      await this.prisma.delivery.delete({
        where: { id },
      });

      this.logger.log(`Successfully deleted delivery ${id}`);
      return { message: 'Delivery deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete delivery ${id}:`, error);
      throw new BadRequestException(
        `Failed to delete delivery: ${error.message}`,
      );
    }
  }

  // Private helper methods

  private async validateOrderForDelivery(orderId: number): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.order_type !== 'delivery') {
      throw new BadRequestException(
        `Order ${orderId} is not a delivery order (type: ${order.order_type})`,
      );
    }

    if (!['confirmed', 'preparing'].includes(order.status)) {
      throw new BadRequestException(
        `Order ${orderId} is not in a valid state for delivery creation (status: ${order.status})`,
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

    if (employee.status !== 'active') {
      throw new BadRequestException(`Employee ${employeeId} is not active`);
    }
  }

  private isValidStatusTransition(
    current: DeliveryStatus,
    target: DeliveryStatus,
  ): boolean {
    if (current === target) return true;
    return this.validStatusTransitions[current]?.includes(target) || false;
  }

  private async handleStatusChange(
    delivery: DeliveryWithDetails,
    newStatus: DeliveryStatus,
    employeeId?: number,
    notes?: string,
  ): Promise<void> {
    const estimatedTime = delivery.estimated_delivery_time || undefined;

    // Send notification to customer
    await this.createDeliveryNotification(
      delivery.order_id,
      newStatus,
      estimatedTime,
      notes,
    );

    // Create order timeline entry
    await this.prisma.orderTimeline.create({
      data: {
        order_id: delivery.order_id,
        status: newStatus,
        employee_id: employeeId,
        notes: notes || `Delivery status updated to ${newStatus}`,
        timestamp: new Date(),
      },
    });

    // Handle specific status changes
    switch (newStatus) {
      case DeliveryStatus.OUT_FOR_DELIVERY:
        await this.handleOutForDelivery(delivery, employeeId, notes);
        break;
      case DeliveryStatus.DELIVERED:
        await this.handleDeliveryCompletion(delivery, employeeId, notes);
        break;
      case DeliveryStatus.CANCELLED:
        await this.handleDeliveryCancellation(delivery, employeeId, notes);
        break;
    }
  }

  private async handleOutForDelivery(
    delivery: DeliveryWithDetails,
    employeeId?: number,
    notes?: string,
  ): Promise<void> {
    const now = new Date();

    // Set pickup time if not already set
    if (!delivery.pickup_from_kitchen_time) {
      await this.prisma.delivery.update({
        where: { id: delivery.id },
        data: { pickup_from_kitchen_time: now },
      });
    }

    // Update order status
    await this.updateOrderStatus(
      delivery.order_id,
      'out_for_delivery',
      employeeId,
      notes || 'Order picked up from kitchen for delivery',
    );
  }

  private async handleDeliveryCompletion(
    delivery: DeliveryWithDetails,
    employeeId?: number,
    notes?: string,
  ): Promise<void> {
    const now = new Date();

    // Set actual delivery time
    await this.prisma.delivery.update({
      where: { id: delivery.id },
      data: { actual_delivery_time: now },
    });

    // Update order status
    await this.updateOrderStatus(
      delivery.order_id,
      'delivered',
      employeeId,
      notes || 'Order delivered to customer',
    );

    // Create order history for the customer
    if (delivery.order?.User_id) {
      await this.createOrderHistory(delivery);
    }
  }

  private async handleDeliveryCancellation(
    delivery: DeliveryWithDetails,
    employeeId?: number,
    notes?: string,
  ): Promise<void> {
    // Update order status
    await this.updateOrderStatus(
      delivery.order_id,
      'cancelled',
      employeeId,
      notes || 'Delivery cancelled',
    );
  }

  private async updateOrderStatus(
    orderId: number,
    status: string,
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
        notes: notes || `Order status updated to ${status}`,
        timestamp: new Date(),
      },
    });
  }

  private async createOrderHistory(
    delivery: DeliveryWithDetails,
  ): Promise<void> {
    try {
      const orderData = delivery.order;
      const orderDetails = orderData.order_details || [];

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
          status: 'delivered',
          items,
          delivery_address: delivery.delivery_address,
        },
      });

      this.logger.log(`Created order history for order ${delivery.order_id}`);
    } catch (error) {
      this.logger.error(
        `Failed to create order history for order ${delivery.order_id}:`,
        error,
      );
    }
  }

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
        this.logger.warn(
          `No user found for order ${orderId}, skipping notification`,
        );
        return;
      }

      const message =
        customMessage ||
        this.generateStatusNotificationMessage(
          order.order_id,
          status,
          estimatedTime,
        );

      const notificationPayload: DeliveryNotificationPayload = {
        user_id: order.User_id,
        order_id: orderId,
        message,
        type: 'delivery_update',
        action_url: `/orders/${orderId}`,
        read: false,
      };

      await this.notificationsService.create(notificationPayload);
      this.logger.log(`Sent delivery notification for order ${orderId}`);
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
    const statusMessages = {
      [DeliveryStatus.PENDING]: `Your delivery order #${orderNumber} is being processed. We'll notify you when it's ready for delivery.`,
      [DeliveryStatus.PREPARING]: `Your order #${orderNumber} is being prepared. It will be ready for delivery soon.`,
      [DeliveryStatus.OUT_FOR_DELIVERY]: `Your order #${orderNumber} is on the way${estimatedTime ? ` and should arrive by ${estimatedTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : ''}.`,
      [DeliveryStatus.DELIVERED]: `Your order #${orderNumber} has been delivered. Enjoy your meal!`,
      [DeliveryStatus.CANCELLED]: `Your delivery for order #${orderNumber} has been cancelled. Please contact customer service for more information.`,
    };

    return (
      statusMessages[status] ||
      `Your delivery for order #${orderNumber} has been updated to status: ${status}`
    );
  }

  private async notifyLocationUpdate(delivery: any): Promise<void> {
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
        action_url: `/orders/${delivery.order_id}/track`,
        read: false,
      });

      this.logger.log(
        `Sent location update notification for delivery ${delivery.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send location notification for delivery ${delivery.id}:`,
        error,
      );
    }
  }

  private parseLocationHistory(delivery: any): LocationHistoryEntry[] {
    if (!delivery.location_history) {
      return [];
    }

    try {
      const history = JSON.parse(delivery.location_history as string);
      return Array.isArray(history) ? (history as LocationHistoryEntry[]) : [];
    } catch (error) {
      this.logger.warn(
        `Failed to parse location history for delivery ${delivery.id}:`,
        error,
      );
      return [];
    }
  }
}
