import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import {
  OrderWebhookPayload,
  SalesReportPayload,
  TableStatusPayload,
} from './webhook.controller';

interface WebhookNotificationResult {
  sent: boolean;
  via: string;
  messageId?: string;
  customerName?: string;
  itemsCount?: number;
  reason?: string;
  fallbackReason?: string;
  error?: string;
  timestamp: string;
  requestId?: string;
}

interface LineApiResponse {
  sentMessages?: Array<{
    id: string;
  }>;
  [key: string]: any;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private mailTransporter: nodemailer.Transporter | null = null;
  private isTransporterInitialized = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.logger.log(`EMAIL_HOST: ${this.configService.get('EMAIL_HOST')}`);
    this.logger.log(`EMAIL_USER: ${this.configService.get('EMAIL_USER')}`);
    this.logger.log(`ADMIN_EMAIL: ${this.configService.get('ADMIN_EMAIL')}`);

    setTimeout(() => {
      this.initializeMailTransporter().catch((error) => {
        this.logger.error('Failed to initialize mail transporter:', error);
        this.mailTransporter = null;
      });
    }, 1000); // รอ 1 วินาที
  }

  private async initializeMailTransporter() {
    if (this.isTransporterInitialized) {
      return;
    }

    try {
      const emailHost = this.configService.get<string>(
        'EMAIL_HOST',
        'smtp.gmail.com',
      );
      const emailUser = this.configService.get<string>('EMAIL_USER');
      const emailPassword = this.configService.get<string>('EMAIL_PASSWORD');
      const emailPort = parseInt(
        this.configService.get<string>('EMAIL_PORT', '587'),
      );

      this.logger.log(
        `Initializing mail transporter: ${emailHost}:${emailPort}`,
      );

      if (!emailHost || !emailUser || !emailPassword) {
        this.logger.warn('Email configuration incomplete');
        this.isTransporterInitialized = true;
        return;
      }

      // Primary configuration with proper TLS
      this.mailTransporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort,
        secure: false, // Use STARTTLS for port 587
        requireTLS: true, // Force TLS
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
        tls: {
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2', // ✅ Use modern TLS
          ciphers: 'ECDHE-RSA-AES256-GCM-SHA384', // ✅ Modern cipher
          servername: emailHost,
        },
        pool: true, // Use connection pooling
        maxConnections: 5,
        maxMessages: 100,
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
        debug: process.env.NODE_ENV === 'development',
        logger: process.env.NODE_ENV === 'development',
      });

      this.logger.log('Mail transporter created, testing connection...');

      // Test the connection
      if (this.mailTransporter) {
        await this.mailTransporter.verify();
        this.logger.log('✅ SMTP connection verified successfully');
      }
      this.isTransporterInitialized = true;
    } catch (error) {
      this.logger.error('Primary SMTP configuration failed:', error.message);
      await this.initializeFallbackTransporter();
    }
  }

  private async initializeFallbackTransporter() {
    try {
      this.logger.log('🔄 Trying fallback transporter (Gmail service)...');

      const emailUser = this.configService.get<string>('EMAIL_USER');
      const emailPassword = this.configService.get<string>('EMAIL_PASSWORD');

      if (!emailUser || !emailPassword) {
        this.logger.error('Email credentials not available for fallback');
        this.isTransporterInitialized = true;
        return;
      }

      this.mailTransporter = nodemailer.createTransport({
        service: 'gmail', // Use Gmail service preset
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
        tls: {
          rejectUnauthorized: false,
        },
        pool: true,
        debug: process.env.NODE_ENV === 'development',
        logger: process.env.NODE_ENV === 'development',
      });

      if (this.mailTransporter) {
        await this.mailTransporter.verify();
        this.logger.log('✅ Fallback SMTP connection successful');
      }
      this.isTransporterInitialized = true;
    } catch (error) {
      this.logger.error('Fallback transporter also failed:', error.message);
      this.mailTransporter = null;
      this.isTransporterInitialized = true;
    }
  }

  private async getWorkingTransporter(): Promise<nodemailer.Transporter | null> {
    // Ensure transporter is initialized
    if (!this.isTransporterInitialized) {
      await this.initializeMailTransporter();
    }

    // If we have a working transporter, return it
    if (this.mailTransporter) {
      try {
        await this.mailTransporter.verify();
        return this.mailTransporter;
      } catch (error) {
        this.logger.warn(
          'Existing transporter failed verification, recreating...',
        );
        this.mailTransporter = null;
        this.isTransporterInitialized = false;
        await this.initializeMailTransporter();
        return this.mailTransporter;
      }
    }

    return null;
  }

  private async sendEmailDirect(mailOptions: any) {
    try {
      /* const nodemailer = require('nodemailer'); */

      const directTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: this.configService.get<string>('EMAIL_USER'),
          pass: this.configService.get<string>('EMAIL_PASSWORD'),
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      const result = await directTransporter.sendMail(mailOptions);

      this.logger.log('✅ Direct email sent successfully:', {
        messageId: result.messageId,
        to: mailOptions.to,
        subject: mailOptions.subject,
      });

      return result;
    } catch (error) {
      this.logger.error('❌ Direct email sending failed:', error);
      throw error;
    }
  }

  private async sendEmailWithRetry(mailOptions: any, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(
          `📧 Sending email (attempt ${attempt}/${maxRetries})...`,
        );

        const transporter = await this.getWorkingTransporter();

        if (!transporter) {
          throw new Error('No working email transporter available');
        }

        const result = await transporter.sendMail(mailOptions);
        this.logger.log(`✅ Email sent successfully on attempt ${attempt}`, {
          messageId: result.messageId,
          to: mailOptions.to,
          subject: mailOptions.subject,
        });
        return result;
      } catch (error) {
        this.logger.error(
          `❌ Email sending attempt ${attempt} failed:`,
          error.message,
        );

        if (attempt === maxRetries) {
          throw error;
        }

        // Reset transporter for next attempt
        this.mailTransporter = null;
        this.isTransporterInitialized = false;

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  async sendNewOrderNotification(
    payload: OrderWebhookPayload,
  ): Promise<WebhookNotificationResult> {
    const requestId = Date.now().toString();
    this.logger.log(
      `📥 [${requestId}] Sending new order notification for order: ${payload.orderId}`,
    );

    console.log(`📋 [${requestId}] Received webhook payload:`, {
      orderId: payload.orderId,
      totalPrice: payload.totalPrice,
      orderType: payload.orderType,
      itemsCount: payload.items?.length || 0,
      hasCustomerInfo: !!payload.customerInfo,
      customerName: payload.customerInfo?.name,
      timestamp: payload.timestamp,
    });

    const lineToken = this.configService.get<string>(
      'LINE_CHANNEL_ACCESS_TOKEN',
    );
    const lineUserId = this.configService.get<string>('LINE_ADMIN_USER_ID');

    if (!lineToken || !lineUserId) {
      this.logger.warn(
        `[${requestId}] Line credentials not configured, falling back to email`,
      );
      return await this.sendOrderNotificationEmail(null, payload);
    }

    const itemsList =
      payload.items
        ?.map(
          (item) =>
            `• ${item.name} x${item.quantity} (₭${item.price.toLocaleString()})`,
        )
        .join('\n') || '• ບໍ່ມີລາຍການສິນຄ້າ';

    const customerName = payload.customerInfo?.name || 'ລູກຄ້າ';
    const customerPhone = payload.customerInfo?.phone || 'ບໍ່ລະບຸ';

    const isTestOrder = payload.orderId?.toString().includes('TEST');
    const orderTypeText = this.getOrderTypeText(payload.orderType);

    let message = `🔔 *ອໍເດີ້ໃໝ່${isTestOrder ? ' (TEST)' : ''}*
📋 ລະຫັດ: ${payload.orderId}
💰 ຍອດລວມ: ₭${payload.totalPrice.toLocaleString()}
📱 ປະເພດ: ${orderTypeText}
👤 ລູກຄ້າ: ${customerName}
📞 ເບີໂທ: ${customerPhone}`;

    if (payload.tableNumber) {
      message += `\n🪑 ໂຕະ: ${payload.tableNumber}`;
    }

    if (payload.deliveryAddress) {
      message += `\n🚚 ທີ່ຢູ່: ${payload.deliveryAddress}`;
    }

    message += `\n\n📝 ລາຍການ:\n${itemsList}`;

    if (payload.estimatedReadyTime) {
      try {
        const readyTime = new Date(payload.estimatedReadyTime);
        message += `\n\n⏰ ເວລາແລ້ວໂດຍປະມານ: ${readyTime.toLocaleTimeString(
          'th-TH',
          {
            hour: '2-digit',
            minute: '2-digit',
          },
        )}`;
      } catch (error) {
        this.logger.warn(
          `[${requestId}] Invalid estimated ready time: ${payload.estimatedReadyTime}`,
        );
      }
    }

    message += `\n\n${isTestOrder ? '🧪 ນີ້ແມ່ນການທົດສອບລະບົບ' : '✅ ກະລຸນາກຽມອໍເດີ້'}`;

    try {
      this.logger.log(`[${requestId}] Sending to Line API...`);

      const response = await axios.post(
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

      const lineResponse = response.data as LineApiResponse;

      this.logger.log(`✅ [${requestId}] Line notification sent successfully`, {
        orderId: payload.orderId,
        responseStatus: response.status,
        messageLength: message.length,
      });

      return {
        sent: true,
        via: 'line',
        messageId: lineResponse?.sentMessages?.[0]?.id || 'unknown',
        customerName,
        itemsCount: payload.items?.length || 0,
        timestamp: new Date().toISOString(),
        requestId,
      };
    } catch (error) {
      this.logger.error(`❌ [${requestId}] Failed to send Line notification:`, {
        orderId: payload.orderId,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });

      return await this.sendOrderNotificationEmail(null, payload);
    }
  }

  private async sendOrderNotificationFromPayload(payload: OrderWebhookPayload) {
    return await this.sendNewOrderNotification(payload);
  }

  private async sendOrderNotificationEmail(
    order: any,
    payload?: OrderWebhookPayload,
  ): Promise<WebhookNotificationResult> {
    const adminEmail =
      this.configService.get<string>('ADMIN_EMAIL') ||
      this.configService.get<string>('EMAIL_USER');

    if (!adminEmail) {
      this.logger.warn('No admin email configured for fallback notification');
      return {
        sent: false,
        via: 'email',
        reason: 'No admin email configured',
        timestamp: new Date().toISOString(),
      };
    }

    const orderData = payload
      ? {
          order_id: payload.orderId,
          total_price: payload.totalPrice,
          order_type: payload.orderType,
          user: {
            first_name: payload.customerInfo?.name?.split(' ')[0] || '',
            last_name:
              payload.customerInfo?.name?.split(' ').slice(1).join(' ') || '',
            phone: payload.customerInfo?.phone || '',
          },
          order_details: payload.items || [],
          table: payload.tableNumber ? { number: payload.tableNumber } : null,
          delivery: payload.deliveryAddress
            ? { delivery_address: payload.deliveryAddress }
            : null,
        }
      : order;

    const itemsList = (payload?.items || order?.order_details || [])
      .map((detail) => {
        if (payload?.items) {
          return `<li>${detail.name} x${detail.quantity} - ₭${detail.price.toLocaleString()}</li>`;
        } else {
          const itemName = detail.food_menu?.name || detail.beverage_menu?.name;
          return `<li>${itemName} x${detail.quantity} - ₭${detail.price.toLocaleString()}</li>`;
        }
      })
      .join('');

    const isTestOrder = orderData.order_id?.toString().includes('TEST');
    const customerName = orderData.user?.first_name || 'ไม่ระบุ';

    const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">🔔 ອໍເດີ້ໃໝ່${isTestOrder ? ' (TEST)' : ''}!</h2>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>ລະຫັດອໍເດີ້:</strong> ${orderData.order_id}</p>
        <p><strong>ຍອດລວມ:</strong> ₭${orderData.total_price.toLocaleString()}</p>
        <p><strong>ປະເພດ:</strong> ${this.getOrderTypeText(orderData.order_type)}</p>
        <p><strong>ລູກຄ້າ:</strong> ${customerName} ${orderData.user?.last_name || ''}</p>
        <p><strong>ເບີໂທ:</strong> ${orderData.user?.phone || 'ไม่ระบุ'}</p>
        ${orderData.table ? `<p><strong>ໂຕະ:</strong> ${orderData.table.number}</p>` : ''}
        ${orderData.delivery ? `<p><strong>ທີ່ຢູ່ຈັດສົ່ງ:</strong> ${orderData.delivery.delivery_address}</p>` : ''}
      </div>

      <h3>ລາຍການສິນຄ້າ:</h3>
      <ul style="list-style-type: none; padding: 0;">
        ${itemsList}
      </ul>
      
      <p style="color: #e74c3c; font-weight: bold;">
        ${isTestOrder ? '🧪 ນີ່ແມ່ນການທົດສອບລະບົບ' : 'ກະລຸນາກຽມອໍເດີ້'}
      </p>
      
      <p style="color: #f39c12;"><em>ສົ່ງຜ່ານ Email (Line API ບໍ່ສາມາດໃຊ້ງານໄດ້)</em></p>
    </div>
    `;

    const mailOptions = {
      from: this.configService.get<string>('EMAIL_FROM'),
      to: adminEmail,
      subject: `🔔 ອໍເດີ້ໃໝ່${isTestOrder ? ' (TEST)' : ''} - ${orderData.order_id}`,
      html: emailHtml,
    };

    try {
      const result = await this.sendEmailWithRetry(mailOptions);

      return {
        sent: true,
        via: 'email',
        messageId: result.messageId,
        customerName,
        itemsCount: payload?.items?.length || 0,
        fallbackReason: 'Line API not available',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Failed to send notification email after all retries:',
        error,
      );
      return {
        sent: false,
        via: 'email',
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

  async sendSalesReport(payload: SalesReportPayload) {
    this.logger.log(`Generating sales report: ${payload.reportType}`);

    try {
      const { startDate, endDate } = this.getDateRange(payload.reportType);

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
        orderBy: {
          create_at: 'desc',
        },
      });

      const reportData = this.processSalesData(salesData);

      const adminEmail =
        this.configService.get<string>('ADMIN_EMAIL') ||
        this.configService.get<string>('EMAIL_USER');

      if (!adminEmail) {
        throw new Error('Admin email not configured');
      }

      const emailHtml = this.generateSalesReportHtml(
        reportData,
        payload.reportType,
      );

      const mailOptions = {
        from: this.configService.get<string>('EMAIL_FROM'),
        to: adminEmail,
        subject: `📊 ລາຍງານຍອດຂາຍ${this.getReportTypeText(payload.reportType)} - ${new Date().toLocaleDateString('th-TH')}`,
        html: emailHtml,
      };

      const result = await this.sendEmailWithRetry(mailOptions);

      return {
        sent: true,
        via: 'email',
        messageId: result.messageId,
        reportType: payload.reportType,
        totalSales: reportData.totalSales,
        totalOrders: reportData.totalOrders,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to send sales report email:', error);
      throw new HttpException(
        `Failed to send sales report: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendPickupCode(payload: OrderWebhookPayload) {
    this.logger.log(`Sending pickup code for order: ${payload.orderId}`);

    const order = await this.prisma.order.findUnique({
      where: { order_id: payload.orderId },
      include: {
        user: true,
      },
    });

    if (!order || !order.user?.email) {
      throw new HttpException(
        'Order not found or customer email missing',
        HttpStatus.BAD_REQUEST,
      );
    }

    const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #27ae60;">🎫 ລະຫັດຮັບສິນຄ້າ</h2>
      
      <div style="background: #f8f9fa; padding: 30px; text-align: center; border-radius: 8px; margin: 20px 0;">
        <h1 style="color: #2c3e50; font-size: 48px; margin: 0;">${order.pickup_code || 'N/A'}</h1>
        <p style="color: #7f8c8d; margin-top: 10px;">ລະຫັດຮັບສິນຄ້າ</p>
      </div>

      <div style="background: #ecf0f1; padding: 20px; border-radius: 8px;">
        <p><strong>ອໍເດີ້:</strong> ${order.order_id}</p>
        <p><strong>ຍອດລວມ:</strong> ₭${order.total_price.toLocaleString()}</p>
        <p><strong>ປະເພດ:</strong> ${order.order_type}</p>
      </div>

      <p style="margin-top: 20px; color: #e74c3c;">
        <strong>ວິທີຮັບສິນຄ້າ:</strong><br>
        1. ສະແດງລະຫັດນີ້ທີ່ເຄົາເຕີ້<br>
        2. ຫຼືບອກລະຫັດ ${order.pickup_code || 'N/A'} ກັບພະນັກງານ
      </p>
    </div>
    `;

    const mailOptions = {
      from: 'phoneyang1@gmail.com',
      to: order.user.email,
      subject: `🎫 ລະຫັດຮັບສິນຄ້າ - ອໍເດີ້ ${order.order_id}`,
      html: emailHtml,
    };

    try {
      /* const nodemailer = require('nodemailer'); */
      const directTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'phoneyang1@gmail.com',
          pass: 'sdzq dbrm xivu nujp',
        },
      });

      const result = await directTransporter.sendMail(mailOptions);

      return {
        sent: true,
        via: 'direct-nodemailer',
        messageId: result.messageId,
        pickupCode: order.pickup_code,
        customerEmail: order.user.email,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to send pickup code email:', error);
      throw new HttpException(
        'Failed to send pickup code',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async sendReceipt(payload: OrderWebhookPayload) {
    this.logger.log(`📧 Sending receipt for order: ${payload.orderId}`);

    try {
      // First, find the order with complete data
      const order = await this.prisma.order.findUnique({
        where: { order_id: payload.orderId },
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
                  name: true,
                  price: true,
                },
              },
              beverage_menu: {
                select: {
                  name: true,
                  hot_price: true,
                  ice_price: true,
                },
              },
            },
          },
          payments: {
            orderBy: {
              payment_date: 'desc',
            },
          },
          table: {
            select: {
              number: true,
            },
          },
          delivery: {
            select: {
              delivery_address: true,
              delivery_fee: true,
            },
          },
        },
      });

      if (!order) {
        throw new Error(`Order ${payload.orderId} not found in database`);
      }

      if (!order.user?.email) {
        throw new Error(
          `Customer email not found for order ${payload.orderId}`,
        );
      }

      // Validate order is completed
      if (!['confirmed', 'completed', 'delivered'].includes(order.status)) {
        this.logger.warn(
          `Order ${payload.orderId} status is ${order.status}, not completed`,
        );
        return {
          sent: false,
          via: 'email',
          reason: `Order status is ${order.status}, not completed`,
          orderId: payload.orderId,
          timestamp: new Date().toISOString(),
        };
      }

      // Check if payment is completed
      const completedPayment = order.payments?.find(
        (p) => p.status === 'completed',
      );
      if (!completedPayment) {
        this.logger.warn(
          `No completed payment found for order ${payload.orderId}`,
        );
        return {
          sent: false,
          via: 'email',
          reason: 'No completed payment found',
          orderId: payload.orderId,
          timestamp: new Date().toISOString(),
        };
      }

      // Prepare receipt data
      const customerName =
        `${order.user.first_name || ''} ${order.user.last_name || ''}`.trim() ||
        'ລູກຄ້າ';
      const receiptDate = new Date();

      // Calculate totals
      let subtotal = 0;
      const itemsList = order.order_details
        .map((detail) => {
          const itemName =
            detail.food_menu?.name ||
            detail.beverage_menu?.name ||
            'ບໍ່ລະບຸຊື່';
          const itemPrice = detail.price;
          const lineTotal = itemPrice * detail.quantity;
          subtotal += lineTotal;

          return `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 8px; text-align: left;">${itemName}</td>
        <td style="padding: 8px; text-align: center;">${detail.quantity}</td>
        <td style="padding: 8px; text-align: right;">₭${itemPrice.toLocaleString()}</td>
        <td style="padding: 8px; text-align: right; font-weight: bold;">₭${lineTotal.toLocaleString()}</td>
      </tr>
      `;
        })
        .join('');

      const deliveryFee = order.delivery?.delivery_fee || 0;
      const discountAmount = order.discount_amount || 0;
      const finalTotal = subtotal + deliveryFee - discountAmount;

      // Generate receipt HTML
      const receiptHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ໃບບິນ - ${order.order_id}</title>
      <style>
        body { font-family: 'Phetsarath_OT', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .receipt { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2c3e50; padding-bottom: 20px; }
        .logo { font-size: 28px; font-weight: bold; color: #2c3e50; margin-bottom: 5px; }
        .receipt-title { font-size: 20px; color: #e74c3c; margin-bottom: 10px; }
        .order-info { background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .items-table th { background: #34495e; color: white; padding: 12px; text-align: left; }
        .totals { margin-top: 20px; padding-top: 20px; border-top: 2px solid #bdc3c7; }
        .total-row { display: flex; justify-content: space-between; margin: 8px 0; }
        .final-total { font-size: 18px; font-weight: bold; color: #e74c3c; background: #f8f9fa; padding: 10px; border-radius: 5px; }
        .footer { text-align: center; margin-top: 30px; color: #7f8c8d; border-top: 1px solid #bdc3c7; padding-top: 20px; }
        .thank-you { color: #27ae60; font-weight: bold; font-size: 16px; }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <div class="logo">🏪 SeeU Cafe</div>
          <div class="receipt-title">ໃບບິນຮັບເງີນ / Receipt</div>
          <div style="color: #7f8c8d;">Luang Prabang, Laos</div>
        </div>
        
        <div class="order-info">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
              <strong>ລະຫັດອໍເດີ້ / Order ID:</strong><br>
              <span style="font-family: monospace; background: #fff; padding: 2px 6px; border-radius: 3px;">${order.order_id}</span>
            </div>
            <div>
              <strong>ວັນທີ່ / Date:</strong><br>
              ${receiptDate.toLocaleDateString('lo-LA', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })} <br>
              <small>${receiptDate.toLocaleTimeString('lo-LA')}</small>
            </div>
            <div>
              <strong>ລູກຄ້າ / Customer:</strong><br>
              ${customerName}
            </div>
            <div>
              <strong>ປະເພດອໍເດີ້ / Order Type:</strong><br>
              ${this.getOrderTypeText(order.order_type)}
            </div>
          </div>
          
          ${
            order.table
              ? `
          <div style="margin-top: 10px;">
            <strong>ໂຕະ / Table:</strong> ${order.table.number}
          </div>
          `
              : ''
          }
          
          ${
            order.delivery
              ? `
          <div style="margin-top: 10px;">
            <strong>ທີ່ຢູ່ຈັດສົ່ງ / Delivery Address:</strong><br>
            <span style="background: #fff3cd; padding: 4px 8px; border-radius: 3px; display: inline-block; margin-top: 5px;">
              📍 ${order.delivery.delivery_address}
            </span>
          </div>
          `
              : ''
          }
          
          <div style="margin-top: 10px;">
            <strong>ວິທີຊຳລະ / Payment Method:</strong> 
            ${this.getPaymentMethodText(completedPayment.method)}
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="text-align: left;">ລາຍການ / Item</th>
              <th style="text-align: center; width: 80px;">ຈຳນວນ / Qty</th>
              <th style="text-align: right; width: 100px;">ລາຄາ / Price</th>
              <th style="text-align: right; width: 120px;">ລວມ / Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsList}
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>ລວມຍ່ອຍ / Subtotal:</span>
            <span>₭${subtotal.toLocaleString()}</span>
          </div>
          
          ${
            deliveryFee > 0
              ? `
          <div class="total-row">
            <span>ຄ່າຈັດສົ່ງ / Delivery Fee:</span>
            <span>₭${deliveryFee.toLocaleString()}</span>
          </div>
          `
              : ''
          }
          
          ${
            discountAmount > 0
              ? `
          <div class="total-row" style="color: #27ae60;">
            <span>ສ່ວນຫຼຸດ / Discount:</span>
            <span>-₭${discountAmount.toLocaleString()}</span>
          </div>
          `
              : ''
          }
          
          <div class="total-row final-total">
            <span>ລວມທັງໝົດ / Grand Total:</span>
            <span>₭${finalTotal.toLocaleString()}</span>
          </div>
        </div>
        
        <div class="footer">
          <div class="thank-you">
            🙏 ຂອບໃຈທີ່ໃຊ້ບໍລິການ<br>
            Thank you for your business!
          </div>
          <div style="margin-top: 15px;">
            <div>📞 Phone: +856 20 5555 5555</div>
            <div>📧 Email: info@seeucafe.la</div>
            <div>🌐 Website: www.seeucafe.la</div>
          </div>
          <div style="margin-top: 15px; font-size: 12px;">
            Receipt generated on ${receiptDate.toISOString()}<br>
            Powered by SeeU Cafe POS System
          </div>
        </div>
      </div>
    </body>
    </html>
    `;

      // Prepare email options
      const emailSubject = `🧾 ໃບບິນ / Receipt - ອໍເດີ້ ${order.order_id}`;
      const emailFrom =
        this.configService.get<string>('EMAIL_FROM') || 'phoneyang1@gmail.com';

      const mailOptions = {
        from: `"SeeU Cafe" <${emailFrom}>`,
        to: order.user.email,
        subject: emailSubject,
        html: receiptHtml,
        attachments: [],
        headers: {
          'X-Order-ID': order.order_id,
          'X-Customer-ID': order.user.id.toString(),
          'X-Receipt-Type': 'final',
          'X-Mailer': 'SeeU Cafe POS System',
        },
      };

      // Send email using direct nodemailer
      try {
        /* const nodemailer = require('nodemailer'); */

        const directTransporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: this.configService.get<string>('EMAIL_USER'),
            pass: this.configService.get<string>('EMAIL_PASSWORD'),
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        const result = await directTransporter.sendMail(mailOptions);

        this.logger.log(`✅ Receipt sent successfully:`, {
          orderId: order.order_id,
          customerEmail: order.user.email,
          customerName,
          messageId: result.messageId,
          totalAmount: finalTotal,
        });

        return {
          sent: true,
          via: 'email',
          messageId: result.messageId,
          receiptGenerated: true,
          customerEmail: order.user.email,
          customerName,
          orderId: order.order_id,
          totalAmount: finalTotal,
          timestamp: new Date().toISOString(),
        };
      } catch (emailError) {
        this.logger.error('Failed to send receipt email:', emailError);
        throw new Error(`Email sending failed: ${emailError.message}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send receipt for order ${payload.orderId}:`,
        error,
      );
      throw error;
    }
  }

  private getPaymentMethodText(method: string): string {
    const methods = {
      cash: 'ເງິນສົດ / Cash',
      credit_card: 'ບັດເຄຣດິດ / Credit Card',
      debit_card: 'ບັດເດບິດ / Debit Card',
      mobile_payment: 'ຈ່າຍຜ່ານມືຖື / Mobile Payment',
      bank_transfer: 'ໂອນເງິນ / Bank Transfer',
      qr_code: 'QR Code Payment',
      other: 'ອື່ນໆ / Other',
    };
    return methods[method] || method;
  }

  async updateTableStatus(payload: TableStatusPayload) {
    this.logger.log(
      `Updating table ${payload.tableId} status to: ${payload.newStatus}`,
    );

    try {
      const updatedTable = await this.prisma.table.update({
        where: { id: payload.tableId },
        data: {
          status: payload.newStatus,
          updated_at: new Date(),
          ...(payload.newStatus === 'occupied' && {
            current_session_start: new Date(),
          }),
          ...(payload.newStatus === 'available' && {
            current_session_start: null,
            expected_end_time: null,
          }),
        },
      });

      return {
        updated: true,
        tableId: payload.tableId,
        previousStatus: payload.currentStatus,
        newStatus: payload.newStatus,
        tableNumber: updatedTable.number,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to update table status:', error);
      throw new HttpException(
        'Failed to update table status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private getDateRange(reportType: string) {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (reportType) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        const weekStart = now.getDate() - now.getDay();
        startDate = new Date(now.getFullYear(), now.getMonth(), weekStart);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    return { startDate, endDate };
  }

  private processSalesData(orders: any[]) {
    const totalSales = orders.reduce(
      (sum, order) => sum + order.total_price,
      0,
    );
    const totalOrders = orders.length;

    const itemCounts = {};
    orders.forEach((order) => {
      order.order_details.forEach((detail) => {
        const itemName = detail.food_menu?.name || detail.beverage_menu?.name;
        if (itemName) {
          itemCounts[itemName] = (itemCounts[itemName] || 0) + detail.quantity;
        }
      });
    });

    const topItems = Object.entries(itemCounts)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return { totalSales, totalOrders, topItems, orders };
  }

  private generateSalesReportHtml(data: any, reportType: string) {
    const topItemsList = data.topItems
      .map((item) => `<li>${item.name}: ${item.count} ชิ้น</li>`)
      .join('');

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2c3e50;">📊 ລາຍງານຍອດຂາຍ${this.getReportTypeText(reportType)}</h2>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #27ae60;">ສະຫຼູບຍອດຂາຍ</h3>
        <p><strong>ຍອດຂາຍລວມ:</strong> ₭${data.totalSales.toLocaleString()}</p>
        <p><strong>ຈຳນວນອໍເດີ້:</strong> ${data.totalOrders} ອໍເດີ້</p>
        <p><strong>ຍອດຂາຍສະເລ່ຍ:</strong> ₭${data.totalOrders > 0 ? (data.totalSales / data.totalOrders).toLocaleString() : 0} ຕໍ່ອໍເດີ້</p>
      </div>

      <div style="background: #ecf0f1; padding: 20px; border-radius: 8px;">
        <h3 style="color: #e74c3c;">ສິນຄ້າຂາຍດີ Top 5</h3>
        <ol>${topItemsList}</ol>
      </div>
      
      <p style="margin-top: 20px; color: #7f8c8d; font-size: 12px;">
        ລາຍງານສ້າງເມື່ອ: ${new Date().toLocaleString('th-TH')}
      </p>
    </div>
    `;
  }

  private getReportTypeText(type: string) {
    switch (type) {
      case 'daily':
        return 'ລາຍ';
      case 'weekly':
        return 'ລາຍອາທິດ';
      case 'monthly':
        return 'ລາຍເດືອນ';
      default:
        return '';
    }
  }
}
