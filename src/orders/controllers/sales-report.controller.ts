// src/orders/controllers/sales-report.controller.ts
import { Controller, Post, Param, UseGuards, Get } from '@nestjs/common';
import { OrdersService } from '../orders.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Sales Reports')
@Controller('sales-reports')
export class SalesReportController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('trigger/:reportType')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger sales report via n8n (Admin only)' })
  @ApiParam({
    name: 'reportType',
    enum: ['daily', 'weekly', 'monthly'],
    description: 'Type of sales report to generate',
  })
  @ApiResponse({
    status: 201,
    description: 'Sales report triggered successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async triggerSalesReport(
    @Param('reportType') reportType: 'daily' | 'weekly' | 'monthly',
  ) {
    return this.ordersService.triggerSalesReport(reportType);
  }

  @Get('test-webhook')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Test n8n webhook connectivity (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Webhook test completed',
  })
  async testWebhook() {
    try {
      // ส่ง test payload ไปยัง n8n
      const testPayload = {
        orderId: `TEST${Date.now()}`,
        userId: 1,
        status: 'pending',
        totalPrice: 250,
        orderType: 'pickup',
        customerInfo: {
          name: 'Test Customer',
          email: 'test@example.com',
          phone: '0812345678',
        },
        items: [
          {
            name: 'กาแฟร้อน',
            quantity: 1,
            price: 150,
          },
          {
            name: 'ขนมเค้ก',
            quantity: 1,
            price: 100,
          },
        ],
        timestamp: new Date().toISOString(),
      };

      // เรียกใช้ private method sendN8nWebhook
      const response = await this.ordersService['sendN8nWebhook']('order', {
        order_id: testPayload.orderId,
        User_id: testPayload.userId,
        status: testPayload.status,
        total_price: testPayload.totalPrice,
        order_type: testPayload.orderType,
        user: {
          first_name: 'Test',
          last_name: 'Customer',
          email: testPayload.customerInfo.email,
          phone: testPayload.customerInfo.phone,
        },
        order_details: testPayload.items.map((item) => ({
          food_menu: { name: item.name },
          quantity: item.quantity,
          price: item.price,
        })),
      });

      return {
        success: true,
        message: 'Test webhook sent successfully',
        payload: testPayload,
        response,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Test webhook failed',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Get('webhooks/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check n8n webhook configuration status (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook configuration status',
  })
  async checkWebhookStatus() {
    const webhookUrls = {
      order: process.env.N8N_WEBHOOK_URL,
      sales: process.env.N8N_SALES_WEBHOOK_URL,
      pickup: process.env.N8N_PICKUP_WEBHOOK_URL,
      receipt: process.env.N8N_RECEIPT_WEBHOOK_URL,
      table: process.env.N8N_TABLE_WEBHOOK_URL,
    };

    const status = Object.entries(webhookUrls).map(([type, url]) => ({
      type,
      configured: !!url,
      url: url
        ? url.replace(/\/webhook\/.*$/, '/webhook/***')
        : 'Not configured',
    }));

    const allConfigured = status.every((s) => s.configured);

    return {
      overallStatus: allConfigured
        ? 'All webhooks configured'
        : 'Some webhooks missing',
      configured: status.filter((s) => s.configured).length,
      total: status.length,
      webhooks: status,
      recommendations: allConfigured
        ? []
        : [
            'Configure missing webhook URLs in environment variables',
            'Ensure n8n service is running and accessible',
            'Check network connectivity between services',
          ],
      timestamp: new Date().toISOString(),
    };
  }
}
