import { Controller, Post, Body, Headers, Logger, Get } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { PrismaService } from '../prisma/prisma.service';

export interface OrderWebhookPayload {
  orderId: string;
  userId?: number;
  status: string;
  totalPrice: number;
  orderType: string;
  customerInfo?: {
    name: string;
    email?: string;
    phone?: string;
  };
  items?: Array<{
    id?: number;
    name: string;
    quantity: number;
    price: number;
    notes?: string;
    isReady?: boolean;
    preparationTime?: number;
  }>;
  tableNumber?: number;
  tableId?: number;
  deliveryAddress?: string;
  deliveryInfo?: {
    address: string;
    customerLatitude?: number;
    customerLongitude?: number;
    customerLocationNote?: string;
    deliveryFee?: number;
    estimatedDeliveryTime?: string;
  };
  estimatedReadyTime?: string;
  actualReadyTime?: string;
  promotionInfo?: {
    id: number;
    name: string;
    discountAmount: number;
  };
  preparationNotes?: string;
  createdAt?: string;
  timestamp: string;
}

export interface SalesReportPayload {
  reportType: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  totalSales: number;
  totalOrders: number;
  topItems?: any[];
}

export interface TableStatusPayload {
  tableId: number;
  currentStatus: string;
  newStatus: string;
  reason?: string;
}

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly prisma: PrismaService
  ) {}

  // Test endpoint
  @Get('test')
  test() {
    return { 
      message: 'Webhook endpoints are ready!',
      endpoints: [
        'POST /webhooks/order-notification',
        'POST /webhooks/sales-report', 
        'POST /webhooks/pickup-code',
        'POST /webhooks/receipt',
        'POST /webhooks/table-status',
        'GET /webhooks/tables-status'
      ],
      timestamp: new Date().toISOString()
    };
  }

  // 1. แจ้งเตือนเมื่อมี Order ใหม่ (Line Messenger)
@Post('order-notification')
async newOrderNotification(
  @Body() payload: OrderWebhookPayload,
  @Headers() headers: Record<string, string>
) {
  const requestId = Date.now().toString();
  
  // 🔥 Enhanced logging with request tracking
  this.logger.log(`📥 [${requestId}] New order notification received`, {
    orderId: payload.orderId,
    source: headers['x-webhook-source'] || 'unknown',
    userAgent: headers['user-agent'] || 'unknown',
    contentType: headers['content-type'] || 'unknown',
    contentLength: JSON.stringify(payload).length,
    timestamp: new Date().toISOString(),
  });

  // Log complete payload structure for debugging
  this.logger.debug(`📋 [${requestId}] Complete payload structure:`, {
    orderId: payload.orderId,
    userId: payload.userId,
    totalPrice: payload.totalPrice,
    orderType: payload.orderType,
    status: payload.status,
    customerInfo: {
      hasName: !!payload.customerInfo?.name,
      hasEmail: !!payload.customerInfo?.email,
      hasPhone: !!payload.customerInfo?.phone,
      name: payload.customerInfo?.name,
    },
    items: {
      count: payload.items?.length || 0,
      items: payload.items?.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        hasNotes: !!item.notes,
      })) || [],
    },
    orderDetails: {
      tableNumber: payload.tableNumber,
      hasDeliveryAddress: !!payload.deliveryAddress,
      deliveryAddress: payload.deliveryAddress?.substring(0, 50) + '...',
      estimatedReadyTime: payload.estimatedReadyTime,
    },
    payloadKeys: Object.keys(payload),
  });

  // Validate required fields
  const validationErrors = [];
  if (!payload.orderId) validationErrors.push('orderId is missing');
  if (!payload.totalPrice || payload.totalPrice <= 0) validationErrors.push('totalPrice is invalid');
  if (!payload.orderType) validationErrors.push('orderType is missing');
  if (!payload.items || payload.items.length === 0) validationErrors.push('items array is empty');

  if (validationErrors.length > 0) {
    this.logger.error(`❌ [${requestId}] Validation failed:`, {
      orderId: payload.orderId,
      errors: validationErrors,
    });
    
    return {
      success: false,
      error: 'Validation failed',
      details: validationErrors,
      orderId: payload.orderId,
      requestId,
    };
  }

  try {
    this.logger.log(`🔄 [${requestId}] Processing order notification...`);
    
    const result = await this.webhookService.sendNewOrderNotification(payload);
    
    this.logger.log(`✅ [${requestId}] Order notification processed successfully:`, {
      orderId: payload.orderId,
      sent: result.sent,
      via: result.via,
      messageId: result.messageId,
      customerName: result.customerName,
      itemsCount: result.itemsCount,
    });

    return { 
      success: true, 
      message: 'Order notification sent successfully',
      orderId: payload.orderId,
      requestId,
      result: {
        sent: result.sent,
        via: result.via,
        messageId: result.messageId,
        customerName: result.customerName,
        itemsCount: result.itemsCount,
      }
    };
  } catch (error) {
    this.logger.error(`❌ [${requestId}] Failed to send order notification:`, {
      orderId: payload.orderId,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });

    return { 
      success: false, 
      error: error.message,
      orderId: payload.orderId,
      requestId,
    };
  }
}

  // 2. ส่งรายงานยอดขาย (Gmail SMTP)
  @Post('sales-report')
  async salesReport(
    @Body() payload: SalesReportPayload,
    @Headers('x-webhook-source') source?: string
  ) {
    this.logger.log(`Sales report request: ${payload.reportType}`);
    
    try {
      const result = await this.webhookService.sendSalesReport(payload);
      return { 
        success: true, 
        message: 'Sales report sent successfully',
        reportType: payload.reportType,
        result 
      };
    } catch (error) {
      this.logger.error('Failed to send sales report:', error);
      return { 
        success: false, 
        error: error.message,
        reportType: payload.reportType 
      };
    }
  }

  // 3. ส่ง Pickup Code (Email)
  @Post('pickup-code')
  async pickupCode(
    @Body() payload: OrderWebhookPayload,
    @Headers('x-webhook-source') source?: string
  ) {
    this.logger.log(`Pickup code request: ${payload.orderId}`);
    
    try {
      const result = await this.webhookService.sendPickupCode(payload);
      return { 
        success: true, 
        message: 'Pickup code sent successfully',
        orderId: payload.orderId,
        pickupCode: payload.pickupCode,
        result 
      };
    } catch (error) {
      this.logger.error('Failed to send pickup code:', error);
      return { 
        success: false, 
        error: error.message,
        orderId: payload.orderId 
      };
    }
  }

  // 4. ส่งใบเสร็จ (PDF + Gmail)
  @Post('receipt')
  async receipt(
    @Body() payload: OrderWebhookPayload,
    @Headers('x-webhook-source') source?: string
  ) {
    this.logger.log(`Receipt request: ${payload.orderId}`);
    
    try {
      const result = await this.webhookService.sendReceipt(payload);
      return { 
        success: true, 
        message: 'Receipt sent successfully',
        orderId: payload.orderId,
        result 
      };
    } catch (error) {
      this.logger.error('Failed to send receipt:', error);
      return { 
        success: false, 
        error: error.message,
        orderId: payload.orderId 
      };
    }
  }

  // 5. อัปเดตสถานะโต๊ะ (Internal webhook)
  @Post('table-status')
  async tableStatus(
    @Body() payload: TableStatusPayload,
    @Headers('x-webhook-source') source?: string
  ) {
    this.logger.log(`Table status update: Table ${payload.tableId}`);
    
    try {
      const result = await this.webhookService.updateTableStatus(payload);
      return { 
        success: true, 
        message: 'Table status updated successfully',
        tableId: payload.tableId,
        newStatus: payload.newStatus,
        result 
      };
    } catch (error) {
      this.logger.error('Failed to update table status:', error);
      return { 
        success: false, 
        error: error.message,
        tableId: payload.tableId 
      };
    }
  }

  // Public endpoint สำหรับ n8n - get tables without auth
  @Get('tables-status')
  async getTablesForCleanup() {
    try {
      // ใช้ prisma service โดยตรงแทนการเรียก API
      const tables = await this.prisma.table.findMany({
        where: {
          status: 'occupied'
        },
        select: {
          id: true,
          number: true,
          status: true,
          current_session_start: true,
          expected_end_time: true
        }
      });

      return {
        success: true,
        tables: tables,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        tables: []
      };
    }
  }
}