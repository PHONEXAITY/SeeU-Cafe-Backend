import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import * as nodemailer from 'nodemailer';
import { 
  OrderWebhookPayload, 
  SalesReportPayload, 
  TableStatusPayload 
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
    private readonly prisma: PrismaService
  ) {
    this.logger.log(`EMAIL_HOST: ${this.configService.get('EMAIL_HOST')}`);
    this.logger.log(`EMAIL_USER: ${this.configService.get('EMAIL_USER')}`);
    this.logger.log(`ADMIN_EMAIL: ${this.configService.get('ADMIN_EMAIL')}`);
    
    setTimeout(() => {
      this.initializeMailTransporter().catch(error => {
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
      const emailHost = this.configService.get<string>('EMAIL_HOST', 'smtp.gmail.com');
      const emailUser = this.configService.get<string>('EMAIL_USER');
      const emailPassword = this.configService.get<string>('EMAIL_PASSWORD');
      const emailPort = parseInt(this.configService.get<string>('EMAIL_PORT', '587'));
      
      this.logger.log(`Initializing mail transporter: ${emailHost}:${emailPort}`);
      
      if (!emailHost || !emailUser || !emailPassword) {
        this.logger.warn('Email configuration incomplete');
        this.isTransporterInitialized = true;
        return;
      }

      // Primary configuration with proper TLS
      this.mailTransporter = nodemailer.createTransporter({
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
      await this.mailTransporter.verify();
      this.logger.log('✅ SMTP connection verified successfully');
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

      this.mailTransporter = nodemailer.createTransporter({
        service: 'gmail', // Use Gmail service preset
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
        tls: {
          rejectUnauthorized: false
        },
        pool: true,
        debug: process.env.NODE_ENV === 'development',
        logger: process.env.NODE_ENV === 'development',
      });
      
      await this.mailTransporter.verify();
      this.logger.log('✅ Fallback SMTP connection successful');
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
        this.logger.warn('Existing transporter failed verification, recreating...');
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
    const nodemailer = require('nodemailer');
    
    const directTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('EMAIL_USER'),
        pass: this.configService.get<string>('EMAIL_PASSWORD'),
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const result = await directTransporter.sendMail(mailOptions);
    
    this.logger.log('✅ Direct email sent successfully:', {
      messageId: result.messageId,
      to: mailOptions.to,
      subject: mailOptions.subject
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
        this.logger.log(`📧 Sending email (attempt ${attempt}/${maxRetries})...`);
        
        const transporter = await this.getWorkingTransporter();
        
        if (!transporter) {
          throw new Error('No working email transporter available');
        }

        const result = await transporter.sendMail(mailOptions);
        this.logger.log(`✅ Email sent successfully on attempt ${attempt}`, {
          messageId: result.messageId,
          to: mailOptions.to,
          subject: mailOptions.subject
        });
        return result;
        
      } catch (error) {
        this.logger.error(`❌ Email sending attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Reset transporter for next attempt
        this.mailTransporter = null;
        this.isTransporterInitialized = false;
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

 async sendNewOrderNotification(payload: OrderWebhookPayload): Promise<WebhookNotificationResult> {
    const requestId = Date.now().toString();
    this.logger.log(`📥 [${requestId}] Sending new order notification for order: ${payload.orderId}`);
    
    console.log(`📋 [${requestId}] Received webhook payload:`, {
      orderId: payload.orderId,
      totalPrice: payload.totalPrice,
      orderType: payload.orderType,
      itemsCount: payload.items?.length || 0,
      hasCustomerInfo: !!payload.customerInfo,
      customerName: payload.customerInfo?.name,
      timestamp: payload.timestamp,
    });

    const lineToken = this.configService.get<string>('LINE_CHANNEL_ACCESS_TOKEN');
    const lineUserId = this.configService.get<string>('LINE_ADMIN_USER_ID');
    
    if (!lineToken || !lineUserId) {
      this.logger.warn(`[${requestId}] Line credentials not configured, falling back to email`);
      return await this.sendOrderNotificationEmail(null, payload);
    }

    const itemsList = payload.items?.map(item => 
      `• ${item.name} x${item.quantity} (₭${item.price.toLocaleString()})`
    ).join('\n') || '• ບໍ່ມີລາຍການສິນຄ້າ';

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
        message += `\n\n⏰ ເວລາແລ້ວໂດຍປະມານ: ${readyTime.toLocaleTimeString('th-TH', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })}`;
      } catch (error) {
        this.logger.warn(`[${requestId}] Invalid estimated ready time: ${payload.estimatedReadyTime}`);
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
              text: message
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${lineToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
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
        requestId
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
private async sendOrderNotificationEmail(order: any, payload?: OrderWebhookPayload): Promise<WebhookNotificationResult> {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL') || 
                      this.configService.get<string>('EMAIL_USER');

    if (!adminEmail) {
      this.logger.warn('No admin email configured for fallback notification');
      return { 
        sent: false, 
        via: 'email',
        reason: 'No admin email configured',
        timestamp: new Date().toISOString()
      };
    }

    const orderData = payload ? {
      order_id: payload.orderId,
      total_price: payload.totalPrice,
      order_type: payload.orderType,
      user: {
        first_name: payload.customerInfo?.name?.split(' ')[0] || '',
        last_name: payload.customerInfo?.name?.split(' ').slice(1).join(' ') || '',
        phone: payload.customerInfo?.phone || '',
      },
      order_details: payload.items || [],
      table: payload.tableNumber ? { number: payload.tableNumber } : null,
      delivery: payload.deliveryAddress ? { delivery_address: payload.deliveryAddress } : null,
    } : order;

    const itemsList = (payload?.items || order?.order_details || []).map(detail => {
      if (payload?.items) {
        return `<li>${detail.name} x${detail.quantity} - ₭${detail.price.toLocaleString()}</li>`;
      } else {
        const itemName = detail.food_menu?.name || detail.beverage_menu?.name;
        return `<li>${itemName} x${detail.quantity} - ₭${detail.price.toLocaleString()}</li>`;
      }
    }).join('');

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
      html: emailHtml
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
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to send notification email after all retries:', error);
      return { 
        sent: false, 
        via: 'email',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

private getOrderTypeText(orderType: string): string {
  switch (orderType) {
    case 'pickup': return 'ຮັບເອງ';
    case 'delivery': return 'ຈັດສົ່ງ';
    case 'table': return 'ກິນທີ່ຮ້ານ';
    case 'dine-in': return 'ກິນທີ່ຮ້ານ';
    default: return orderType;
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
            lte: endDate
          },
          status: {
            in: ['completed', 'delivered']
          }
        },
        include: {
          order_details: {
            include: {
              food_menu: true,
              beverage_menu: true
            }
          },
          payments: true
        },
        orderBy: {
          create_at: 'desc'
        }
      });

      const reportData = this.processSalesData(salesData);
      
      const adminEmail = this.configService.get<string>('ADMIN_EMAIL') || 
                        this.configService.get<string>('EMAIL_USER');
      
      if (!adminEmail) {
        throw new Error('Admin email not configured');
      }

      const emailHtml = this.generateSalesReportHtml(reportData, payload.reportType);
      
      const mailOptions = {
        from: this.configService.get<string>('EMAIL_FROM'),
        to: adminEmail,
        subject: `📊 ລາຍງານຍອດຂາຍ${this.getReportTypeText(payload.reportType)} - ${new Date().toLocaleDateString('th-TH')}`,
        html: emailHtml
      };

      const result = await this.sendEmailWithRetry(mailOptions);
      
      return { 
        sent: true, 
        via: 'email',
        messageId: result.messageId,
        reportType: payload.reportType,
        totalSales: reportData.totalSales,
        totalOrders: reportData.totalOrders,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to send sales report email:', error);
      throw new HttpException(
        `Failed to send sales report: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async sendPickupCode(payload: OrderWebhookPayload) {
    this.logger.log(`Sending pickup code for order: ${payload.orderId}`);
    
    const order = await this.prisma.order.findUnique({
      where: { order_id: payload.orderId },
      include: {
        user: true
      }
    });

    if (!order || !order.user?.email) {
      throw new HttpException(
        'Order not found or customer email missing',
        HttpStatus.BAD_REQUEST
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
      html: emailHtml
    };

    try {
      const nodemailer = require('nodemailer');
      const directTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'phoneyang1@gmail.com',
          pass: 'sdzq dbrm xivu nujp'
        }
      });

      const result = await directTransporter.sendMail(mailOptions);
      
      return { 
        sent: true, 
        via: 'direct-nodemailer',
        messageId: result.messageId,
        pickupCode: order.pickup_code,
        customerEmail: order.user.email,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to send pickup code email:', error);
      throw new HttpException(
        'Failed to send pickup code',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async sendReceipt(payload: OrderWebhookPayload) {
    this.logger.log(`Sending receipt for order: ${payload.orderId}`);
    
    const order = await this.prisma.order.findUnique({
      where: { order_id: payload.orderId },
      include: {
        user: true,
        order_details: {
          include: {
            food_menu: true,
            beverage_menu: true
          }
        },
        payments: true,
        table: true
      }
    });

    if (!order || !order.user?.email) {
      throw new HttpException(
        'Order not found or customer email missing',
        HttpStatus.BAD_REQUEST
      );
    }

    const itemsList = order.order_details.map(detail => {
      const itemName = detail.food_menu?.name || detail.beverage_menu?.name;
      return `
      <tr>
        <td>${itemName}</td>
        <td style="text-align: center;">${detail.quantity}</td>
        <td style="text-align: right;">₭${detail.price.toLocaleString()}</td>
      </tr>
      `;
    }).join('');

    const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1>SeeU Cafe</h1>
        <h2>ໃບບິນຮັບເງີນ</h2>
      </div>
      
      <div style="margin-bottom: 20px;">
        <p><strong>ອໍເດີ້:</strong> ${order.order_id}</p>
        <p><strong>ວັນທີ່:</strong> ${order.create_at.toLocaleDateString('th-TH')}</p>
        <p><strong>ລູກຄ້າ:</strong> ${order.user.first_name} ${order.user.last_name || ''}</p>
        ${order.table ? `<p><strong>ໂຕະ:</strong> ${order.table.number}</p>` : ''}
      </div>
      
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f8f9fa;">
            <th style="padding: 8px; border-bottom: 1px solid #ddd;">ລາຍການ</th>
            <th style="padding: 8px; border-bottom: 1px solid #ddd; width: 80px;">ຈຳນວນ</th>
            <th style="padding: 8px; border-bottom: 1px solid #ddd; width: 100px;">ລາຄາ</th>
          </tr>
        </thead>
        <tbody>
          ${itemsList}
        </tbody>
      </table>
      
      <div style="margin-top: 20px; text-align: right;">
        <p style="font-weight: bold; font-size: 16px;">ຍອດລວມ: ₭${order.total_price.toLocaleString()}</p>
      </div>
      
      <div style="margin-top: 30px; text-align: center; color: #666;">
        <p>ຂອບໃຈທີ່ໃຊ້ບໍລິການ</p>
        <p>SeeU Cafe</p>
      </div>
    </div>
    `;
    
    const mailOptions = {
      from: 'phoneyang1@gmail.com',
      to: order.user.email,
      subject: `🧾 ໃບບິນ - ອໍເດີ້ ${order.order_id}`,
      html: emailHtml
    };

    try {
      const nodemailer = require('nodemailer');
      const directTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: 'phoneyang1@gmail.com',
          pass: 'sdzq dbrm xivu nujp'
        }
      });

      const result = await directTransporter.sendMail(mailOptions);
      
      return { 
        sent: true, 
        via: 'direct-nodemailer',
        messageId: result.messageId,
        receiptGenerated: true,
        customerEmail: order.user.email,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to send receipt email:', error);
      throw new HttpException(
        'Failed to send receipt',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async updateTableStatus(payload: TableStatusPayload) {
    this.logger.log(`Updating table ${payload.tableId} status to: ${payload.newStatus}`);
    
    try {
      const updatedTable = await this.prisma.table.update({
        where: { id: payload.tableId },
        data: { 
          status: payload.newStatus,
          updated_at: new Date(),
          ...(payload.newStatus === 'occupied' && {
            current_session_start: new Date()
          }),
          ...(payload.newStatus === 'available' && {
            current_session_start: null,
            expected_end_time: null
          })
        }
      });

      return { 
        updated: true, 
        tableId: payload.tableId,
        previousStatus: payload.currentStatus,
        newStatus: payload.newStatus,
        tableNumber: updatedTable.number,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to update table status:', error);
      throw new HttpException(
        'Failed to update table status',
        HttpStatus.INTERNAL_SERVER_ERROR
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
    const totalSales = orders.reduce((sum, order) => sum + order.total_price, 0);
    const totalOrders = orders.length;
    
    const itemCounts = {};
    orders.forEach(order => {
      order.order_details.forEach(detail => {
        const itemName = detail.food_menu?.name || detail.beverage_menu?.name;
        if (itemName) {
          itemCounts[itemName] = (itemCounts[itemName] || 0) + detail.quantity;
        }
      });
    });

    const topItems = Object.entries(itemCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return { totalSales, totalOrders, topItems, orders };
  }

  private generateSalesReportHtml(data: any, reportType: string) {
    const topItemsList = data.topItems.map(item => 
      `<li>${item.name}: ${item.count} ชิ้น</li>`
    ).join('');

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
      case 'daily': return 'ລາຍ';
      case 'weekly': return 'ລາຍອາທິດ';
      case 'monthly': return 'ລາຍເດືອນ';
      default: return '';
    }
  }
}