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
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
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
interface WebhookPayload {
  orderId: string;
  userId?: number;
  status: string;
  totalPrice: number;
  orderType: string;
  customerInfo: {
    name: string;
    email?: string;
    phone?: string;
  };
  items: Array<{
    id?: number;
    name: string;
    quantity: number;
    price: number;
    notes?: string;
    isReady?: boolean;
    preparationTime?: number;
    menuType?: string;
    menuId?: number;
  }>;
  tableNumber?: number;
  tableId?: number;
  deliveryAddress?: string;
  deliveryInfo?: any;
  estimatedReadyTime?: string;
  actualReadyTime?: string;
  promotionInfo?: any;
  preparationNotes?: string;
  pickupCode?: string;
  timestamp: string;
  requestId: string;
  source: string;
}

@Injectable()
export class OrdersService {
  private readonly redisClient: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly customerNotificationsService: CustomerNotificationsService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
    });
  }

  private async sendN8nWebhook(
    webhookType: 'order' | 'pickup' | 'receipt',
    orderData: any,
    customData?: any,
  ) {
    const requestId = `${webhookType}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    let webhookUrl: string | undefined = ''; // 🔥 ประกาศที่นี่

    try {
      let payload: any = {};

      switch (webhookType) {
        case 'order':
          webhookUrl = this.configService.get<string>('N8N_WEBHOOK_URL');

          if (!webhookUrl) {
            console.error(`❌ [${requestId}] N8N_WEBHOOK_URL not configured!`);
            return {
              success: false,
              reason: 'N8N_WEBHOOK_URL not configured',
              webhookType,
              requestId,
            };
          }

          const customerName = orderData.user
            ? `${orderData.user.first_name || ''} ${orderData.user.last_name || ''}`.trim() ||
              'ລູກຄ້າ'
            : 'ลูกค้า';

          const items =
            orderData.order_details?.map((detail) => {
              const itemName =
                detail.food_menu?.name ||
                detail.beverage_menu?.name ||
                'ບໍ່ລະບຸຊື່';

              return {
                id: detail.id,
                name: itemName,
                quantity: detail.quantity || 1,
                price: Number(detail.price) || 0,
                notes: detail.notes || '',
                isReady: detail.is_ready || false,
                preparationTime: detail.preparation_time || null,
                menuType: detail.food_menu ? 'food' : 'beverage',
                menuId: detail.food_menu_id || detail.beverage_menu_id,
              };
            }) || [];

          payload = {
            orderId: orderData.order_id,
            userId: orderData.User_id,
            status: orderData.status,
            totalPrice: Number(orderData.total_price) || 0,
            orderType: orderData.order_type,

            customerInfo: {
              name: customerName,
              email: orderData.user?.email || null,
              phone: orderData.user?.phone || null,
            },

            items: items,

            tableNumber: orderData.table?.number || null,
            tableId: orderData.table?.id || null,

            deliveryAddress: orderData.delivery?.delivery_address || null,
            deliveryInfo: orderData.delivery
              ? {
                  address: orderData.delivery.delivery_address,
                  customerLatitude: orderData.delivery.customer_latitude,
                  customerLongitude: orderData.delivery.customer_longitude,
                  customerLocationNote:
                    orderData.delivery.customer_location_note,
                  deliveryFee: orderData.delivery.delivery_fee,
                  estimatedDeliveryTime:
                    orderData.delivery.estimated_delivery_time,
                }
              : null,

            estimatedReadyTime: orderData.estimated_ready_time,
            actualReadyTime: orderData.actual_ready_time,
            createdAt: orderData.create_at,

            promotionInfo: orderData.promotion
              ? {
                  id: orderData.promotion.id,
                  name: orderData.promotion.name,
                  discountAmount: orderData.discount_amount || 0,
                }
              : null,

            preparationNotes: orderData.preparation_notes || null,
            pickupCode: orderData.pickup_code || null,

            timestamp: new Date().toISOString(),
            requestId: requestId,
            source: 'seeu-cafe-backend',
          };

          break;

        case 'pickup':
          webhookUrl = this.configService.get<string>('N8N_PICKUP_WEBHOOK_URL');

          if (!webhookUrl) {
            console.error(
              `❌ [${requestId}] N8N_PICKUP_WEBHOOK_URL not configured!`,
            );
            return {
              success: false,
              reason: 'N8N_PICKUP_WEBHOOK_URL not configured',
              webhookType,
              requestId,
            };
          }

          const pickupCustomerName = orderData.user
            ? `${orderData.user.first_name || ''} ${orderData.user.last_name || ''}`.trim() ||
              'ລູກຄ້າ'
            : 'ລູກຄ້າ';

          payload = {
            orderId: orderData.order_id,
            userId: orderData.User_id,
            status: orderData.status,
            totalPrice: Number(orderData.total_price) || 0,
            orderType: orderData.order_type,
            pickupCode: orderData.pickup_code,
            customerInfo: {
              name: pickupCustomerName,
              email: orderData.user?.email || null,
              phone: orderData.user?.phone || null,
            },
            estimatedReadyTime: orderData.estimated_ready_time,
            actualReadyTime: orderData.actual_ready_time,
            timestamp: new Date().toISOString(),
            requestId: requestId,
            source: 'seeu-cafe-backend',
          };

          console.log(`📦 [${requestId}] Pickup payload:`, {
            orderId: payload.orderId,
            pickupCode: payload.pickupCode,
            customerName: payload.customerInfo.name,
            orderType: payload.orderType,
          });

          break;

        case 'receipt':
          webhookUrl = this.configService.get<string>(
            'N8N_RECEIPT_WEBHOOK_URL',
          );

          if (!webhookUrl) {
            console.error(
              `❌ [${requestId}] N8N_RECEIPT_WEBHOOK_URL not configured!`,
            );
            return {
              success: false,
              reason: 'N8N_RECEIPT_WEBHOOK_URL not configured',
              webhookType,
              requestId,
            };
          }

          const receiptCustomerName = orderData.user
            ? `${orderData.user.first_name || ''} ${orderData.user.last_name || ''}`.trim() ||
              'ລູກຄ້າ'
            : 'ລູກຄ້າ';

          const receiptItems =
            orderData.order_details?.map((detail) => ({
              name:
                detail.food_menu?.name ||
                detail.beverage_menu?.name ||
                'ບໍ່ລະບຸຊື່',
              quantity: detail.quantity || 1,
              price: Number(detail.price) || 0,
              notes: detail.notes || '',
            })) || [];

          payload = {
            orderId: orderData.order_id,
            userId: orderData.User_id,
            status: orderData.status,
            totalPrice: Number(orderData.total_price) || 0,
            orderType: orderData.order_type,
            customerInfo: {
              name: receiptCustomerName,
              email: orderData.user?.email || null,
              phone: orderData.user?.phone || null,
            },
            items: receiptItems,
            paymentMethod: orderData.payments?.[0]?.method || null,
            paidAt: orderData.payments?.[0]?.payment_date || null,
            completedAt: new Date().toISOString(),
            timestamp: new Date().toISOString(),
            requestId: requestId,
            source: 'seeu-cafe-backend',
          };

          console.log(`📦 [${requestId}] Receipt payload:`, {
            orderId: payload.orderId,
            totalPrice: payload.totalPrice,
            customerName: payload.customerInfo.name,
            itemsCount: payload.items.length,
            orderType: payload.orderType,
          });

          break;
      }

      const validation = this.validateWebhookPayload(payload, webhookType);
      if (!validation.isValid) {
        console.error(
          `❌ [${requestId}] Invalid webhook payload:`,
          validation.errors,
        );
        console.error(
          `❌ [${requestId}] Payload that failed validation:`,
          JSON.stringify(payload, null, 2),
        );
        return {
          success: false,
          reason: 'Invalid payload',
          errors: validation.errors,
          webhookType,
          requestId,
          payload: payload,
        };
      }

      console.log(`🔔 [${requestId}] Sending ${webhookType} webhook to n8n:`, {
        url: webhookUrl,
        orderId: orderData.order_id,
        requestId,
        payloadSize: JSON.stringify(payload).length,
        timestamp: new Date().toISOString(),
      });

      const response = await this.httpService.axiosRef.post(
        webhookUrl,
        payload,
        {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Source': 'seeu-cafe-backend',
            'X-Request-ID': requestId,
            'X-Order-ID': orderData.order_id,
            'X-Webhook-Type': webhookType,
            'User-Agent': 'SeeU-Cafe-Backend/1.0',
          },
        },
      );

      console.log(
        `✅ [${requestId}] N8N ${webhookType} webhook sent successfully:`,
        {
          orderId: orderData.order_id,
          requestId,
          status: response.status,
          statusText: response.statusText,
          responseSuccess: response.data?.success,
          responseMessage: response.data?.message,
          timestamp: new Date().toISOString(),
        },
      );

      return {
        success: true,
        webhookType,
        requestId,
        status: response.status,
        response: response.data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `❌ [${requestId}] Failed to send ${webhookType} webhook to n8n:`,
        {
          orderId: orderData.order_id,
          requestId,
          error: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data,
          webhookType,
          url: webhookUrl, // 🔥 ใช้ webhookUrl ที่ประกาศไว้ข้างบน
          isTimeoutError: error.code === 'ECONNABORTED',
          isNetworkError: error.code === 'ECONNREFUSED',
          timestamp: new Date().toISOString(),
        },
      );

      return {
        success: false,
        webhookType,
        requestId,
        error: error.message,
        status: error.response?.status,
        responseData: error.response?.data,
        errorCode: error.code,
        timestamp: new Date().toISOString(),
      };
    }
  }

  private validateWebhookPayload(payload: any, webhookType: string) {
    const errors: string[] = [];

    if (!payload.orderId) errors.push('orderId is required');
    if (!payload.totalPrice || payload.totalPrice <= 0)
      errors.push('totalPrice must be greater than 0');
    if (!payload.orderType) errors.push('orderType is required');
    if (!payload.customerInfo?.name)
      errors.push('customerInfo.name is required');

    switch (webhookType) {
      case 'order':
        if (
          !payload.items ||
          !Array.isArray(payload.items) ||
          payload.items.length === 0
        ) {
          errors.push('items array is required and must not be empty');
        } else {
          payload.items.forEach((item: any, index: number) => {
            if (!item.name) errors.push(`items[${index}].name is required`);
            if (!item.quantity || item.quantity <= 0)
              errors.push(`items[${index}].quantity must be greater than 0`);
            if (item.price === undefined || item.price < 0)
              errors.push(`items[${index}].price must be >= 0`);
          });
        }
        break;

      case 'pickup':
        if (!payload.pickupCode)
          errors.push('pickupCode is required for pickup webhook');
        break;

      case 'receipt':
        if (
          !payload.items ||
          !Array.isArray(payload.items) ||
          payload.items.length === 0
        ) {
          errors.push('items array is required for receipt webhook');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async create(createOrderDto: CreateOrderDto): Promise<OrderWithRelations> {
    console.log(
      'Creating order with data:',
      JSON.stringify(createOrderDto, null, 2),
    );

    if (createOrderDto.order_type === 'delivery') {
      const deliveryAddress =
        createOrderDto.delivery_address ||
        createOrderDto.delivery?.delivery_address;

      if (!deliveryAddress || deliveryAddress.trim().length < 5) {
        throw new BadRequestException(
          'Delivery address is required for delivery orders and must be at least 5 characters long',
        );
      }

      console.log('Delivery address validation passed:', deliveryAddress);
    }

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
      if (!['available', 'occupied'].includes(table.status)) {
        throw new BadRequestException(
          `Table #${table.number} is ${table.status} and cannot accept new orders`,
        );
      }

      console.log(
        `✅ Table #${table.number} is ${table.status}, proceeding with order`,
      );
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

    const { order_details, delivery, ...orderData } = createOrderDto;
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

    const result = await this.prisma.$transaction(async (prisma) => {
      const order = await prisma.order.create({
        data: orderCreateInput,
      });

      console.log('Order created successfully:', order.id);

      if (orderData.table_id && orderData.order_type === 'table') {
        const table = await prisma.table.findUnique({
          where: { id: orderData.table_id },
        });

        if (table) {
          await prisma.table.update({
            where: { id: orderData.table_id },
            data: {
              status: 'occupied',
              current_session_start: new Date(),
              expected_end_time: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 ชั่วโมง
            },
          });

          console.log(`✅ Table #${table.number} status updated to 'occupied'`);

          try {
            await this.customerNotificationsService.create({
              message: `ໂຕະ #${table.number} ມີລູກຄ້ານັ່ງແລ້ວ - ອໍເດີ້ #${uniqueOrderId}`,
              type: 'table_occupied',
              order_id: order.id,
              target_roles: ['admin', 'employee'],
              action_url: `/admin/tables/${orderData.table_id}`,
            });
          } catch (notificationError) {
            console.error(
              'Failed to send table occupied notification:',
              notificationError,
            );
          }
        }
      }

      return order;
    });

    const order = result;

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

    if (orderData.order_type === 'delivery') {
      console.log('Creating delivery for order:', order.id);

      const finalDeliveryAddress =
        createOrderDto.delivery_address ||
        createOrderDto.delivery?.delivery_address;

      let finalCustomerLatitude = createOrderDto.customer_latitude;
      let finalCustomerLongitude = createOrderDto.customer_longitude;

      if (!finalCustomerLatitude || !finalCustomerLongitude) {
        finalCustomerLatitude = createOrderDto.delivery?.customer_latitude;
        finalCustomerLongitude = createOrderDto.delivery?.customer_longitude;
      }

      const finalCustomerLocationNote =
        createOrderDto.customer_location_note ||
        createOrderDto.delivery?.customer_location_note;

      const finalDeliveryFee =
        createOrderDto.delivery_fee || delivery?.delivery_fee;

      const finalCustomerNote =
        createOrderDto.customer_note || delivery?.customer_note;

      console.log('Delivery data prepared:', {
        address: finalDeliveryAddress,
        coordinates: [finalCustomerLatitude, finalCustomerLongitude],
        fee: finalDeliveryFee,
        note: finalCustomerNote,
      });

      if (!finalDeliveryAddress) {
        throw new BadRequestException(
          'Delivery address is missing from order data',
        );
      }

      if (!finalCustomerLatitude || !finalCustomerLongitude) {
        throw new BadRequestException(
          'Customer coordinates are required for delivery orders',
        );
      }

      if (
        finalCustomerLatitude < 19.8 ||
        finalCustomerLatitude > 19.95 ||
        finalCustomerLongitude < 102.05 ||
        finalCustomerLongitude > 102.25
      ) {
        throw new BadRequestException(
          'Delivery location is outside our service area in Luang Prabang',
        );
      }

      try {
        const deliveryCreateInput: Prisma.DeliveryCreateInput = {
          order: { connect: { id: order.id } },
          delivery_id: BigInt(Date.now()),
          status: 'pending',
          delivery_address: finalDeliveryAddress,
          estimated_delivery_time: new Date(Date.now() + 60 * 60 * 1000),
          customer_latitude: Number(finalCustomerLatitude),
          customer_longitude: Number(finalCustomerLongitude),
          customer_location_note: finalCustomerLocationNote || null,
          delivery_fee: finalDeliveryFee || null,
          customer_note: finalCustomerNote || null,
        };

        if (createOrderDto.employee_id || delivery?.employee_id) {
          const employeeId =
            createOrderDto.employee_id || delivery?.employee_id;
          deliveryCreateInput.employee = { connect: { id: employeeId } };
        }

        if (delivery?.carrier_id) {
          deliveryCreateInput.carrier_id = delivery.carrier_id;
        }

        const createdDelivery = await this.prisma.delivery.create({
          data: deliveryCreateInput,
        });
      } catch (deliveryError) {
        console.error('Failed to create delivery:', deliveryError);

        await this.prisma.order.delete({ where: { id: order.id } });

        throw new BadRequestException(
          `Failed to create delivery: ${deliveryError.message}`,
        );
      }
    }

    try {
      const createdOrder = await this.findOne(order.id);

      if (createdOrder.user?.id) {
        await this.customerNotificationsService.createOrderStatusNotification(
          createdOrder,
          'confirmed',
          estimatedReadyTime
            ? `ເວລາເຄື່ອງໄດ້ປະມານ: ${estimatedReadyTime.toLocaleTimeString(
                'lo-LA',
                {
                  hour: '2-digit',
                  minute: '2-digit',
                },
              )}`
            : undefined,
        );
      }
      console.log('🚀 [ORDER_CREATE] Attempting to send webhook...');

      try {
        const lineResult = await this.sendLineNotificationDirect(createdOrder);
      } catch (lineError) {
        console.error('❌ [ORDER_CREATE] Line notification exception:', {
          error: lineError.message,
          stack: lineError.stack,
        });
      }
      await this.customerNotificationsService.create({
        message: `ມີຄຳສັ່ງຊື້ໃໝ່ #${uniqueOrderId} (${orderData.order_type})`,
        type: 'new_order',
        order_id: order.id,
        target_roles: ['admin', 'staff'],
        action_url: `/admin/orders/${order.id}`,
      });
    } catch (notificationError) {
      console.error(
        'Failed to send order creation notifications:',
        notificationError,
      );
    }

    const finalResult = await this.findOne(order.id);

    console.log('✅ [ORDER_CREATE] Order creation completed:', {
      orderId: finalResult.order_id,
      id: finalResult.id,
      totalPrice: finalResult.total_price,
    });
    return finalResult;
  }

  private async sendLineNotificationDirect(orderData: any) {
    try {
      const lineToken = this.configService.get<string>(
        'LINE_CHANNEL_ACCESS_TOKEN',
      );
      const lineUserId = this.configService.get<string>('LINE_ADMIN_USER_ID');

      if (!lineToken || !lineUserId) {
        console.warn('Line credentials not configured');
        return {
          success: false,
          via: 'line',
          error: 'Line credentials not configured',
        };
      }

      const customerName = orderData.user
        ? `${orderData.user.first_name || ''} ${orderData.user.last_name || ''}`.trim() ||
          'ລູກຄ້າ'
        : 'ลูกค้า';

      const itemsList =
        orderData.order_details
          ?.map((detail) => {
            const itemName =
              detail.food_menu?.name ||
              detail.beverage_menu?.name ||
              'ບໍ່ລະບຸຊື່';
            return `• ${itemName} x${detail.quantity} (₭${detail.price.toLocaleString()})`;
          })
          .join('\n') || '• ບໍ່ມີລາຍການສິນຄ້າ';

      const orderTypeText = this.getOrderTypeText(orderData.order_type);

      let message = `🔔 *ອໍເດີ້ໃໝ່!*
📋 ລະຫັດ: ${orderData.order_id}
💰 ຍອດລວມ: ₭${orderData.total_price.toLocaleString()}
📱 ປະເພດ: ${orderTypeText}
👤 ລູກຄ້າ: ${customerName}
📞 ເບີໂທ: ${orderData.user?.phone || 'ບໍ່ລະບຸ'}`;

      if (orderData.table?.number) {
        message += `\n🪑 ໂຕະ: ${orderData.table.number}`;
      }

      if (orderData.delivery?.delivery_address) {
        message += `\n🚚 ທີ່ຢູ່: ${orderData.delivery.delivery_address}`;
      }

      message += `\n\n📝 ລາຍການ:\n${itemsList}`;

      if (orderData.estimated_ready_time) {
        try {
          const readyTime = new Date(orderData.estimated_ready_time);
          message += `\n\n⏰ ເວລາແລ້ວໂດຍປະມານ: ${readyTime.toLocaleTimeString(
            'th-TH',
            {
              hour: '2-digit',
              minute: '2-digit',
            },
          )}`;
        } catch (error) {
          console.warn(
            'Invalid estimated ready time:',
            orderData.estimated_ready_time,
          );
        }
      }

      message += `\n\n✅ ກະລຸນາກຽມອໍເດີ້`;

      const response = await this.httpService.axiosRef.post(
        'https://api.line.me/v2/bot/message/push',
        {
          to: lineUserId,
          messages: [
            {
              type: 'text',
              text: message,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${lineToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      console.log(`✅ Line notification sent successfully:`, {
        orderId: orderData.order_id,
        responseStatus: response.status,
        messageLength: message.length,
      });

      return {
        success: true,
        via: 'line-direct',
        messageId: response.data?.sentMessages?.[0]?.id || 'unknown',
        messageLength: message.length,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`❌ Failed to send Line notification:`, {
        orderId: orderData.order_id,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      return {
        success: false,
        via: 'line-direct',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
  private getOrderTypeText(orderType: string): string {
    switch (orderType) {
      case 'pickup':
        return 'ຮັບເອງ';
      case 'delivery':
        return 'ຈັດສົ່ງ';
      case 'table':
        return 'ກິນທີ່ຮ້ານ';
      case 'dine-in':
        return 'ກິນທີ່ຮ້ານ';
      default:
        return orderType;
    }
  }
  async completeTableOrder(orderId: number): Promise<void> {
    const order = await this.findOne(orderId);

    if (order.order_type === 'table' && order.table_id) {
      const activeOrders = await this.prisma.order.findMany({
        where: {
          table_id: order.table_id,
          status: {
            in: ['pending', 'preparing', 'ready', 'served'],
          },
          id: {
            not: orderId, // ไม่รวมออเดอร์ปัจจุบัน
          },
        },
      });

      if (activeOrders.length === 0) {
        const table = await this.prisma.table.update({
          where: { id: order.table_id },
          data: {
            status: 'available',
            current_session_start: null,
            expected_end_time: null,
          },
        });

        console.log(`✅ Table #${table.number} released and now available`);

        try {
          await this.customerNotificationsService.create({
            message: `ໂຕະ #${table.number} ຫວ່າງແລ້ວ - ອໍເດີ້ #${order.order_id} ສຳເລັດ`,
            type: 'table_available',
            order_id: orderId,
            target_roles: ['admin', 'staff'],
            action_url: `/admin/tables/${order.table_id}`,
          });
        } catch (notificationError) {
          console.error(
            'Failed to send table available notification:',
            notificationError,
          );
        }
      } else {
        console.log(
          `⏳ Table #${order.table?.number} still has ${activeOrders.length} active orders`,
        );
      }
    }
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

    if (['completed', 'delivered'].includes(status)) {
      await this.completeTableOrder(id);

      try {
        console.log(
          `🔥 Order ${orderData.order_id} completed, checking payment status...`,
        );

        // Get the updated order with payment information
        const completedOrder = await this.findOne(id);

        // Check if there's a completed payment
        const hasCompletedPayment = completedOrder.payments?.some(
          (p) => p.status === 'completed',
        );

        if (hasCompletedPayment) {
          console.log(
            `✅ Order ${orderData.order_id} has completed payment, sending receipt...`,
          );

          const webhookResult = await this.sendN8nWebhook(
            'receipt',
            completedOrder,
          );
          console.log(`📧 Receipt webhook result:`, webhookResult);
        } else {
          console.log(
            `⏳ Order ${orderData.order_id} completed but payment not yet completed, receipt will be sent after payment`,
          );
        }
      } catch (webhookError) {
        console.error('❌ Receipt webhook failed:', webhookError);
      }
    }

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

    try {
      const updatedOrder = await this.findOne(id);

      if (updatedOrder.user?.id) {
        await this.customerNotificationsService.createOrderStatusNotification(
          updatedOrder,
          status,
          notes,
        );
      }

      if (['ready', 'completed', 'cancelled'].includes(status)) {
        await this.customerNotificationsService.create({
          message: `ຄຳສັ່ງຊື້ #${updatedOrder.order_id} ປ່ຽນສະຖານະເປັນ: ${status}`,
          type: 'order_update',
          order_id: id,
          target_roles: ['admin', 'staff'],
          action_url: `/admin/orders/${id}`,
        });
      }
    } catch (notificationError) {
      console.error(
        'Failed to send status update notifications:',
        notificationError,
      );
    }

    await this.cacheManager.del(`order:${id}`);

    const result = await this.findOne(id);
    return result;
  }

  async triggerSalesReport(reportType: 'daily' | 'weekly' | 'monthly') {
    try {
      const salesWebhookUrl = this.configService.get<string>(
        'N8N_SALES_WEBHOOK_URL',
      );

      if (!salesWebhookUrl) {
        throw new Error('N8N sales webhook URL not configured');
      }

      const now = new Date();
      let startDate: Date;
      let endDate: Date = now;

      switch (reportType) {
        case 'daily':
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          break;
        case 'weekly':
          const weekStart = now.getDate() - now.getDay();
          startDate = new Date(now.getFullYear(), now.getMonth(), weekStart);
          break;
        case 'monthly':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }

      const salesData = await this.prisma.order.findMany({
        where: {
          create_at: {
            gte: startDate,
            lte: endDate,
          },
          status: {
            in: ['completed', 'delivered'],
          },
        },
        include: {
          order_details: {
            include: {
              food_menu: true,
              beverage_menu: true,
            },
          },
          payments: true,
        },
      });

      const totalSales = salesData.reduce(
        (sum, order) => sum + order.total_price,
        0,
      );
      const totalOrders = salesData.length;

      const itemCounts = {};
      salesData.forEach((order) => {
        order.order_details.forEach((detail) => {
          const itemName = detail.food_menu?.name || detail.beverage_menu?.name;
          if (itemName) {
            itemCounts[itemName] =
              (itemCounts[itemName] || 0) + detail.quantity;
          }
        });
      });

      const topItems = Object.entries(itemCounts)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

      const payload = {
        reportType,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalSales,
        totalOrders,
        topItems,
        timestamp: new Date().toISOString(),
      };

      console.log('🔔 Sending sales report webhook to n8n:', salesWebhookUrl);

      const response = await this.httpService.axiosRef.post(
        salesWebhookUrl,
        payload,
        {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Source': 'seeu-cafe-backend',
          },
        },
      );

      console.log('✅ N8N sales report webhook sent successfully:', {
        reportType,
        totalSales,
        totalOrders,
        status: response.status,
      });

      return {
        success: true,
        reportType,
        totalSales,
        totalOrders,
        topItems,
        response: response.data,
      };
    } catch (error) {
      console.error('❌ Failed to send sales report webhook to n8n:', error);
      throw error;
    }
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
    try {
      console.log(`🚀 Sending pickup webhook for order: ${result.order_id}`);
      const webhookResult = await this.sendN8nWebhook('pickup', result);
      console.log(`✅ Pickup webhook result:`, webhookResult);
    } catch (webhookError) {
      console.error('❌ Pickup webhook failed:', webhookError);
    }
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
