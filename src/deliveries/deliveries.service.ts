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
import { LocationService } from './services/location.service';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { UpdateDeliveryTimeDto } from './dto/update-delivery-time.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { EnhancedUpdateLocationDto } from './dto/enhanced-update-location.dto';
import { QueryDeliveryDto } from './dto/query-delivery.dto';
import { DeliveryStatus, DeliveryTimeType } from './enums/delivery-status.enum';
import { Prisma, Delivery } from '@prisma/client';
import {
  LocationHistoryEntry,
  DeliveryWithDetails,
  DeliveryLocationInfo,
} from './interface/types';

@Injectable()
export class DeliveriesService {
  protected readonly logger = new Logger(DeliveriesService.name);

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
    private readonly customerNotificationsService: CustomerNotificationsService,
  ) {}

  private calculateDeliveryDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ) {
    const R = 6371e3; // รัศมีโลกเป็นเมตร
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // in meters

    // Simple estimation: 1 minute per 100 meters + 10 minutes base
    const estimatedTime = 10 + distance / 100;

    // Simple fee calculation: 5000 LAK base + 1000 LAK per 500 meters
    const deliveryFee = 5000 + Math.ceil(distance / 500) * 1000;

    return {
      distance,
      estimatedTime,
      deliveryFee,
    };
  }

  public calculateDeliveryFeeForLocation(
    customerLat: number,
    customerLng: number,
    restaurantLat: number = 19.922828240529658,
    restaurantLng: number = 102.1863694746581,
  ) {
    const deliveryInfo = this.calculateDeliveryDistance(
      restaurantLat,
      restaurantLng,
      customerLat,
      customerLng,
    );

    return {
      distance: deliveryInfo.distance,
      estimatedTime: deliveryInfo.estimatedTime,
      deliveryFee: deliveryInfo.deliveryFee,
      isWithinDeliveryArea: this.isLocationWithinDeliveryArea(
        customerLat,
        customerLng,
      ),
    };
  }

  private isLocationWithinDeliveryArea(lat: number, lng: number): boolean {
    // Implement your delivery area check logic here
    return lat >= 19.85 && lat <= 19.92 && lng >= 102.1 && lng <= 102.18;
  }
  /**
   * Create a new delivery
   */
  async create(createDeliveryDto: CreateDeliveryDto): Promise<Delivery> {
    this.logger.log(
      `Creating delivery for order ${createDeliveryDto.order_id}`,
    );

    // Validate order exists and is eligible for delivery
    await this.validateOrderForDelivery(createDeliveryDto.order_id);

    // 🔥 Validate customer location (ตรวจสอบพิกัดลูกค้า)
    // eslint-disable-next-line @typescript-eslint/await-thenable
    const locationValidation = await this.validateCustomerLocation(
      createDeliveryDto.customer_latitude,
      createDeliveryDto.customer_longitude,
    );

    if (!locationValidation.isValid) {
      throw new BadRequestException(locationValidation.message);
    }

    // 🔥 Calculate delivery fee based on distance
    const restaurantLocation = { lat: 19.8845, lng: 102.135 }; // ตำแหน่งร้าน
    const deliveryInfo = this.calculateDeliveryDistance(
      restaurantLocation.lat,
      restaurantLocation.lng,
      createDeliveryDto.customer_latitude,
      createDeliveryDto.customer_longitude,
    );

    // ใช้ค่าจัดส่งที่คำนวณได้ หรือที่ระบุมา
    const finalDeliveryFee =
      createDeliveryDto.delivery_fee || deliveryInfo.deliveryFee;

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

    // Set default estimated delivery time based on distance
    const estimatedDeliveryTime = createDeliveryDto.estimated_delivery_time
      ? new Date(createDeliveryDto.estimated_delivery_time)
      : new Date(Date.now() + deliveryInfo.estimatedTime * 60 * 1000);

    const status = createDeliveryDto.status ?? DeliveryStatus.PENDING;

    try {
      const delivery = await this.prisma.delivery.create({
        data: {
          order_id: createDeliveryDto.order_id,
          delivery_id: deliveryId,
          status,
          delivery_address: createDeliveryDto.delivery_address,

          // 🔥 เก็บพิกัดลูกค้า
          customer_latitude: createDeliveryDto.customer_latitude,
          customer_longitude: createDeliveryDto.customer_longitude,
          customer_location_note: createDeliveryDto.customer_location_note,

          employee_id: createDeliveryDto.employee_id,
          estimated_delivery_time: estimatedDeliveryTime,
          delivery_fee: finalDeliveryFee,
          customer_note: createDeliveryDto.customer_note,
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

      // 🔥 NEW: Send delivery creation notification
      // 🔥 ส่งการแจ้งเตือนพร้อมข้อมูลระยะทาง
      try {
        if (delivery.order.user?.id) {
          const distanceText = `${(deliveryInfo.distance / 1000).toFixed(1)} ກມ.`;
          const feeText = `${finalDeliveryFee.toLocaleString()} LAK`;
          const timeText = estimatedDeliveryTime.toLocaleTimeString('lo-LA', {
            hour: '2-digit',
            minute: '2-digit',
          });

          await this.customerNotificationsService.create({
            user_id: delivery.order.user.id,
            order_id: delivery.order_id,
            message: `ການຈັດສົ່ງສຳລັບຄຳສັ່ງຊື້ #${delivery.order.order_id} ໄດ້ຖືກສ້າງແລ້ວ
ໄລຍະທາງ: ${distanceText} | ຄ່າສົ່ງ: ${feeText} | ເວລາຄາດຄະເນ: ${timeText}`,
            type: 'delivery_update',
            action_url: `/orders/${delivery.order.order_id}/track`,
          });
        }
      } catch (notificationError) {
        this.logger.error(
          'Failed to send delivery creation notifications:',
          notificationError,
        );
      }

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

  private validateCustomerLocation(
    latitude: number,
    longitude: number,
  ): { isValid: boolean; message: string } {
    // ตรวจสอบขอบเขตพื้นฐาน
    if (latitude < -90 || latitude > 90) {
      return {
        isValid: false,
        message: 'Latitude ຕ້ອງຢູ່ລະຫວ່າງ -90 ຫາ 90',
      };
    }

    if (longitude < -180 || longitude > 180) {
      return {
        isValid: false,
        message: 'Longitude ຕ້ອງຢູ່ລະຫວ່າງ -180 ຫາ 180',
      };
    }

    // ตรวจสอบว่าอยู่ในพื้นที่หลวงพระบางหรือไม่
    const isInLuangPrabang =
      latitude >= 19.85 &&
      latitude <= 19.92 &&
      longitude >= 102.1 &&
      longitude <= 102.18;

    if (!isInLuangPrabang) {
      return {
        isValid: false,
        message: 'ຕຳແໜ່ງນີ້ຢູ່ນອກເຂດການບໍລິການຂອງຫຼວງພະບາງ',
      };
    }

    return { isValid: true, message: 'Valid location' };
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

      // 🔥 NEW: Send time update notification
      try {
        if (
          updateTimeDto.notifyCustomer &&
          updateTimeDto.timeType === DeliveryTimeType.ESTIMATED_DELIVERY_TIME &&
          orderData.User_id
        ) {
          const deliveryTimeStr = newTimeDate.toLocaleTimeString('lo-LA', {
            hour: '2-digit',
            minute: '2-digit',
          });

          const message =
            updateTimeDto.notificationMessage ||
            `ເວລາການຈັດສົ່ງສຳລັບຄຳສັ່ງຊື້ #${orderData.order_id} ມີການປ່ຽນແປງ. ເວລາໃໝ່: ${deliveryTimeStr}`;

          await this.customerNotificationsService.create({
            user_id: orderData.User_id,
            order_id: delivery.order_id,
            message,
            type: 'time_change',
            action_url: `/orders/${orderData.order_id}`,
          });
        }
      } catch (notificationError) {
        this.logger.error(
          'Failed to send time update notification:',
          notificationError,
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

      // 🔥 NEW: Send location update notification
      try {
        if (
          updateLocationDto.notifyCustomer &&
          updatedDelivery.order?.user?.id
        ) {
          const employeeName = updatedDelivery.employee
            ? `${updatedDelivery.employee.first_name || ''} ${updatedDelivery.employee.last_name || ''}`.trim()
            : 'ພະນັກງານຈັດສົ່ງ';

          await this.customerNotificationsService.create({
            user_id: updatedDelivery.order.user.id,
            order_id: updatedDelivery.order_id,
            message: `${employeeName} ໄດ້ອັບເດດທີ່ຕັ້ງສຳລັບການຈັດສົ່ງຄຳສັ່ງຊື້ #${updatedDelivery.order.order_id}`,
            type: 'delivery_update',
            action_url: `/orders/${updatedDelivery.order.order_id}/track`,
          });
        }
      } catch (notificationError) {
        this.logger.error(
          'Failed to send location update notification:',
          notificationError,
        );
      }

      this.logger.log(`Successfully updated location for delivery ${id}`);

      return {
        id: updatedDelivery.id,
        order_id: updatedDelivery.order_id,
        customer_latitude: updatedDelivery.customer_latitude,
        customer_longitude: updatedDelivery.customer_longitude,
        customer_location_note: updatedDelivery.customer_location_note,
        delivery_address: updatedDelivery.delivery_address,
        latitude: updatedDelivery.last_latitude,
        longitude: updatedDelivery.last_longitude,
        lastUpdate: updatedDelivery.last_location_update,
        status: updatedDelivery.status,
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

        // พิกัดลูกค้า (จุดปลายทาง)
        customer_latitude: true,
        customer_longitude: true,
        customer_location_note: true,
        delivery_address: true,

        // พิกัดปัจจุบันของพนักงาน
        last_latitude: true,
        last_longitude: true,
        last_location_update: true,

        status: true,
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

      // ข้อมูลตำแหน่งลูกค้า (จุดปลายทาง)
      customer_latitude: delivery.customer_latitude,
      customer_longitude: delivery.customer_longitude,
      customer_location_note: delivery.customer_location_note,
      delivery_address: delivery.delivery_address,

      // ตำแหน่งปัจจุบันของพนักงานจัดส่ง
      latitude: delivery.last_latitude,
      longitude: delivery.last_longitude,
      lastUpdate: delivery.last_location_update,

      status: delivery.status,
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
    if (delivery.status === DeliveryStatus.DELIVERED) {
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

    if (!['confirmed', 'preparing', 'pending'].includes(order.status)) {
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
    // 🔥 NEW: Send notification to customer based on status
    try {
      if (delivery.order?.User_id) {
        const statusMessages = {
          [DeliveryStatus.PENDING]: `ການຈັດສົ່ງສຳລັບຄຳສັ່ງຊື້ #${delivery.order.order_id} ກຳລັງດຳເນີນການ`,
          [DeliveryStatus.PREPARING]: `ຮ້ານກຳລັງກະກຽມຄຳສັ່ງຊື້ #${delivery.order.order_id} ເພື່ອຈັດສົ່ງ`,
          [DeliveryStatus.OUT_FOR_DELIVERY]: `ພະນັກງານຈັດສົ່ງກຳລັງນຳສົ່ງຄຳສັ່ງຊື້ #${delivery.order.order_id} ມາຫາທ່ານ`,
          [DeliveryStatus.DELIVERED]: `ຄຳສັ່ງຊື້ #${delivery.order.order_id} ໄດ້ຖືກຈັດສົ່ງສຳເລັດແລ້ວ`,
          [DeliveryStatus.CANCELLED]: `ການຈັດສົ່ງສຳລັບຄຳສັ່ງຊື້ #${delivery.order.order_id} ຖືກຍົກເລີກ`,
        };

        const message =
          statusMessages[newStatus] || `ອັບເດດການຈັດສົ່ງ: ${newStatus}`;
        const finalMessage = notes ? `${message}. ${notes}` : message;

        await this.customerNotificationsService.create({
          user_id: delivery.order.User_id,
          order_id: delivery.order_id,
          message: finalMessage,
          type: 'delivery_update',
          action_url: `/orders/${delivery.order.order_id}`,
        });
      }

      // Notify employees about status changes
      await this.customerNotificationsService.create({
        message: `ການຈັດສົ່ງ #${delivery.delivery_id} ປ່ຽນສະຖານະເປັນ: ${newStatus}`,
        type: 'delivery_update',
        order_id: delivery.order_id,
        target_roles: ['admin', 'employee'],
        action_url: `/admin/deliveries/${delivery.id}`,
      });
    } catch (notificationError) {
      this.logger.error(
        'Failed to send status change notifications:',
        notificationError,
      );
    }

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

    // 🔥 NEW: Send specific notification for out for delivery
    try {
      if (delivery.order?.User_id) {
        const employeeName = delivery.employee
          ? `${delivery.employee.first_name || ''} ${delivery.employee.last_name || ''}`.trim()
          : 'ພະນັກງານຈັດສົ່ງ';

        await this.customerNotificationsService.create({
          user_id: delivery.order.User_id,
          order_id: delivery.order_id,
          message: `${employeeName} ໄດ້ຮັບຄຳສັ່ງຊື້ #${delivery.order.order_id} ແລ້ວ ແລະ ກຳລັງມາຫາທ່ານ`,
          type: 'delivery_started',
          action_url: `/orders/${delivery.order.order_id}/track`,
        });
      }
    } catch (notificationError) {
      this.logger.error(
        'Failed to send out for delivery notification:',
        notificationError,
      );
    }
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

    // 🔥 NEW: Send delivery completion notification
    try {
      if (delivery.order?.User_id) {
        await this.customerNotificationsService.create({
          user_id: delivery.order.User_id,
          order_id: delivery.order_id,
          message: `ຄຳສັ່ງຊື້ #${delivery.order.order_id} ໄດ້ຖືກຈັດສົ່ງສຳເລັດແລ້ວ! ຂອບໃຈທີ່ເລືອກໃຊ້ບໍລິການຂອງພວກເຮົາ`,
          type: 'order_delivered',
          action_url: `/orders/${delivery.order.order_id}`,
        });
      }
    } catch (notificationError) {
      this.logger.error(
        'Failed to send delivery completion notification:',
        notificationError,
      );
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

    // 🔥 NEW: Send cancellation notification
    try {
      if (delivery.order?.User_id) {
        const reason = notes ? `. ເຫດຜົນ: ${notes}` : '';
        await this.customerNotificationsService.create({
          user_id: delivery.order.User_id,
          order_id: delivery.order_id,
          message: `ການຈັດສົ່ງສຳລັບຄຳສັ່ງຊື້ #${delivery.order.order_id} ຖືກຍົກເລີກ${reason}`,
          type: 'order_cancelled',
          action_url: `/orders/${delivery.order.order_id}`,
        });
      }
    } catch (notificationError) {
      this.logger.error(
        'Failed to send cancellation notification:',
        notificationError,
      );
    }
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
export class EnhancedDeliveriesService extends DeliveriesService {
  constructor(
    prisma: PrismaService,
    customerNotificationsService: CustomerNotificationsService,
    private readonly locationService: LocationService,
  ) {
    super(prisma, customerNotificationsService);
  }
  /**
   * Enhanced location update with GPS validation
   */
  async updateLocationWithValidation(
    id: number,
    updateLocationDto: EnhancedUpdateLocationDto,
  ): Promise<DeliveryLocationInfo> {
    try {
      // Validate GPS accuracy
      const gpsValidation = this.locationService.validateGPSAccuracy(
        updateLocationDto.latitude,
        updateLocationDto.longitude,
        updateLocationDto.gpsAccuracy,
      );

      // If GPS is not accurate and not forced, suggest better location
      if (!gpsValidation.isAccurate && !updateLocationDto.forceUpdate) {
        const suggestions = this.locationService.suggestBetterLocation(
          updateLocationDto.latitude,
          updateLocationDto.longitude,
        );

        throw new BadRequestException({
          message: 'GPS ບໍ່ແມ່ນຢຳພໍ',
          gpsValidation,
          suggestions,
          canForceUpdate: true,
        });
      }

      // Adjust location for poor GPS areas
      const locationAdjustment = this.locationService.adjustLocationForPoorGPS(
        updateLocationDto.latitude,
        updateLocationDto.longitude,
        updateLocationDto.locationNote,
      );

      // Use adjusted location if needed
      const finalLocation = locationAdjustment.adjustedLocation;

      // Call parent method with adjusted coordinates
      const result = await super.updateLocation(id, {
        ...updateLocationDto,
        latitude: finalLocation.latitude,
        longitude: finalLocation.longitude,
        locationNote:
          updateLocationDto.locationNote +
          (locationAdjustment.reason !== 'ຕຳແໜ່ງ GPS ມີຄວາມແມ່ນຢຳດີ'
            ? ` (${locationAdjustment.reason})`
            : ''),
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return {
        ...result,
        gpsValidation,
        locationAdjustment,
      } as any;
    } catch (error) {
      this.logger.error(`GPS validation failed for delivery ${id}:`, error);
      throw error;
    }
  }

  /**
   * Calculate delivery fee based on distance
   */
  calculateDeliveryFeeForOrder(
    restaurantLat: number = 19.8845,
    restaurantLng: number = 102.135,
    customerLat: number,
    customerLng: number,
  ) {
    const distanceInfo = this.locationService.calculateDeliveryDistance(
      restaurantLat,
      restaurantLng,
      customerLat,
      customerLng,
    );

    return {
      distance: distanceInfo.distance,
      estimatedTime: distanceInfo.estimatedTime,
      deliveryFee: distanceInfo.deliveryFee,
      isWithinDeliveryArea: distanceInfo.isWithinDeliveryArea,
      formattedDistance: `${(distanceInfo.distance / 1000).toFixed(1)} ກມ.`,
      formattedFee: `${distanceInfo.deliveryFee.toLocaleString()} LAK`,
    };
  }
}
