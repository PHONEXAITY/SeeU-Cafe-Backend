import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';
import { 
  OrderWebhookPayload, 
  SalesReportPayload, 
  TableStatusPayload 
} from './webhook.controller';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private mailTransporter: any; // เปลี่ยนจาก nodemailer.Transporter เป็น any

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService
  ) {
    // Log environment variables for debugging
    this.logger.log(`EMAIL_HOST: ${this.configService.get('EMAIL_HOST')}`);
    this.logger.log(`EMAIL_USER: ${this.configService.get('EMAIL_USER')}`);
    this.logger.log(`ADMIN_EMAIL: ${this.configService.get('ADMIN_EMAIL')}`);
    
    // Initialize asynchronously with delay
    setTimeout(() => {
      this.initializeMailTransporter().catch(error => {
        this.logger.error('Failed to initialize mail transporter:', error);
        this.mailTransporter = null;
      });
    }, 1000); // รอ 1 วินาที
  }

  private async initializeMailTransporter() {
    try {
      // @ts-ignore - ปิด TypeScript checking สำหรับ nodemailer
      const nodemailer = require('nodemailer');
      
      const emailHost = this.configService.get<string>('EMAIL_HOST');
      const emailUser = this.configService.get<string>('EMAIL_USER');
      const emailPassword = this.configService.get<string>('EMAIL_PASSWORD');
      
      this.logger.log(`Trying to initialize mail with: ${emailHost}, ${emailUser}`);
      
      if (!emailHost || !emailUser || !emailPassword) {
        this.logger.warn('Email configuration incomplete:', {
          hasHost: !!emailHost,
          hasUser: !!emailUser,
          hasPassword: !!emailPassword
        });
        this.mailTransporter = null;
        return;
      }

      if (!nodemailer || typeof nodemailer.createTransporter !== 'function') {
        this.logger.error('nodemailer.createTransporter is not a function');
        this.mailTransporter = null;
        return;
      }
      
      this.mailTransporter = nodemailer.createTransporter({
        host: emailHost,
        port: parseInt(this.configService.get<string>('EMAIL_PORT') || '587'),
        secure: false,
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });
      
      this.logger.log('Mail transporter initialized successfully');
      
      // ตรวจสอบ connection
      this.mailTransporter.verify((error: any, success: any) => {
        if (error) {
          this.logger.error('SMTP connection failed:', error.message);
          this.mailTransporter = null;
        } else {
          this.logger.log('SMTP connection verified successfully');
        }
      });
    } catch (error) {
      this.logger.error('Failed to initialize mail transporter:', error);
      this.mailTransporter = null;
    }
  }

  // 1. แจ้งเตือนเมื่อมี Order ใหม่ผ่าน Line
 async sendNewOrderNotification(payload: OrderWebhookPayload) {
  this.logger.log(`Sending new order notification for order: ${payload.orderId}`);
  
  // 🔥 แก้ไข: ตรวจสอบ payload structure
  console.log('📥 Received webhook payload:', {
    orderId: payload.orderId,
    totalPrice: payload.totalPrice,
    orderType: payload.orderType,
    itemsCount: payload.items?.length || 0,
    hasCustomerInfo: !!payload.customerInfo,
    payloadKeys: Object.keys(payload),
  });

  // Test mode สำหรับ demo
  if (payload.orderId?.toString().startsWith('TEST')) {
    return await this.sendTestOrderNotification(payload);
  }
  
  // ดึงข้อมูล order จริงจาก database
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
      table: true,
      delivery: true,
      promotion: true,
    }
  });

  if (!order) {
    this.logger.warn(`Order not found in database: ${payload.orderId}`);
    // ใช้ข้อมูลจาก payload แทน
    return await this.sendOrderNotificationFromPayload(payload);
  }

  // สำหรับ Line Messenger API
  const lineToken = this.configService.get<string>('LINE_CHANNEL_ACCESS_TOKEN');
  const lineUserId = this.configService.get<string>('LINE_ADMIN_USER_ID');
  
  if (!lineToken || !lineUserId) {
    this.logger.warn('Line credentials not configured, sending via email instead');
    return await this.sendOrderNotificationEmail(order, payload);
  }

  // 🔥 แก้ไข: ใช้ข้อมูลจาก payload หรือ database
  const itemsList = (payload.items || order.order_details).map(detail => {
    if (payload.items) {
      // ใช้ข้อมูลจาก payload
      return `• ${detail.name} x${detail.quantity} (฿${detail.price.toLocaleString()})`;
    } else {
      // ใช้ข้อมูลจาก database
      const itemName = detail.food_menu?.name || detail.beverage_menu?.name;
      return `• ${itemName} x${detail.quantity} (฿${detail.price.toLocaleString()})`;
    }
  }).join('\n');

  const customerName = payload.customerInfo?.name || 
                      `${order.user?.first_name || ''} ${order.user?.last_name || ''}`.trim() || 
                      'ลูกค้า';

  const customerPhone = payload.customerInfo?.phone || 
                       order.user?.phone || 
                       'ไม่ระบุ';

  const tableInfo = payload.tableNumber || order.table?.number;

  // 🔥 แก้ไข: สร้างข้อความที่มีข้อมูลครบถ้วน
  const message = `🔔 *ออเดอร์ใหม่!*
📋 รหัส: ${payload.orderId}
💰 ยอดรวม: ฿${payload.totalPrice.toLocaleString()}
📱 ประเภท: ${this.getOrderTypeText(payload.orderType)}
👤 ลูกค้า: ${customerName}
📞 เบอร์: ${customerPhone}
${tableInfo ? `🪑 โต๊ะ: ${tableInfo}` : ''}
${payload.deliveryAddress ? `🚚 ที่อยู่: ${payload.deliveryAddress}` : ''}

📝 รายการ:
${itemsList}

${payload.estimatedReadyTime ? `⏰ เวลาเสร็จโดยประมาณ: ${new Date(payload.estimatedReadyTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}` : ''}

กรุณาเตรียมออเดอร์`;

  try {
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
        }
      }
    );

    this.logger.log(`✅ Line notification sent successfully for order: ${payload.orderId}`);

    return { 
      sent: true, 
      via: 'line',
      messageId: (response.data as any)?.sentMessages?.[0]?.id,
      orderId: payload.orderId,
      customerName,
      itemsCount: payload.items?.length || order.order_details.length,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    this.logger.error('Failed to send Line notification:', error);
    // Fallback ส่งผ่าน email
    return await this.sendOrderNotificationEmail(order, payload);
  }
}
private async sendOrderNotificationFromPayload(payload: OrderWebhookPayload) {
  const lineToken = this.configService.get<string>('LINE_CHANNEL_ACCESS_TOKEN');
  const lineUserId = this.configService.get<string>('LINE_ADMIN_USER_ID');
  
  if (!lineToken || !lineUserId) {
    this.logger.warn('Line credentials not configured');
    return { sent: false, via: 'none', reason: 'No Line credentials' };
  }

  const itemsList = payload.items?.map(item => 
    `• ${item.name} x${item.quantity} (฿${item.price.toLocaleString()})`
  ).join('\n') || '• ไม่มีรายการสินค้า';

  const message = `🔔 *ออเดอร์ใหม่! (จาก Webhook)*
📋 รหัส: ${payload.orderId}
💰 ยอดรวม: ฿${payload.totalPrice.toLocaleString()}
📱 ประเภท: ${this.getOrderTypeText(payload.orderType)}
👤 ลูกค้า: ${payload.customerInfo?.name || 'ลูกค้า'}
📞 เบอร์: ${payload.customerInfo?.phone || 'ไม่ระบุ'}

📝 รายการ:
${itemsList}

⚠️ ไม่พบข้อมูลในฐานข้อมูล - กรุณาตรวจสอบ`;

  try {
    const response = await axios.post(
      'https://api.line.me/v2/bot/message/push',
      {
        to: lineUserId,
        messages: [{ type: 'text', text: message }]
      },
      {
        headers: {
          'Authorization': `Bearer ${lineToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return { 
      sent: true, 
      via: 'line-webhook-only',
      messageId: (response.data as any)?.sentMessages?.[0]?.id,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    this.logger.error('Failed to send webhook-only notification:', error);
    return { sent: false, via: 'line', error: error.message };
  }
}

  // Test mode สำหรับ demo
  private async sendTestOrderNotification(payload: OrderWebhookPayload) {
    this.logger.log(`Test mode: sending notification for ${payload.orderId}`);
    
    const testOrder = {
      order_id: payload.orderId,
      total_price: payload.totalPrice,
      order_type: payload.orderType,
      user: {
        first_name: payload.customerInfo?.name?.split(' ')[0] || 'Test',
        last_name: payload.customerInfo?.name?.split(' ')[1] || 'Customer',
        phone: payload.customerInfo?.phone || '0812345678',
        email: payload.customerInfo?.email || 'test@example.com'
      },
      order_details: [
        {
          food_menu: { name: 'กาแฟร้อน' },
          quantity: 1,
          price: 150
        },
        {
          food_menu: { name: 'ขนมเค้ก' },
          quantity: 1,
          price: 100
        }
      ],
      table: null
    };

    // ลอง Line API ก่อน
    const lineToken = this.configService.get<string>('LINE_CHANNEL_ACCESS_TOKEN');
    const lineUserId = this.configService.get<string>('LINE_ADMIN_USER_ID');
    
    if (lineToken && lineUserId) {
      const message = `🔔 *ออเดอร์ใหม่! (TEST)*
📋 รหัส: ${testOrder.order_id}
💰 ยอดรวม: ฿${testOrder.total_price.toLocaleString()}
📱 ประเภท: ${testOrder.order_type}
👤 ลูกค้า: ${testOrder.user.first_name} ${testOrder.user.last_name}
📞 เบอร์: ${testOrder.user.phone}

📝 รายการ:
• กาแฟร้อน x1 (฿150)
• ขนมเค้ก x1 (฿100)

🧪 นี่คือการทดสอบระบบ`;

      try {
        const response = await axios.post(
          'https://api.line.me/v2/bot/message/push',
          {
            to: lineUserId,
            messages: [{ type: 'text', text: message }]
          },
          {
            headers: {
              'Authorization': `Bearer ${lineToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        return { 
          sent: true, 
          via: 'line',
          mode: 'test',
          messageId: (response.data as any)?.sentMessages?.[0]?.id,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        this.logger.error('Failed to send Line notification:', error);
      }
    }

    // Fallback: ส่งผ่าน email
    return await this.sendOrderNotificationEmail(testOrder);
  }

  // Fallback: ส่งแจ้งเตือน order ผ่าน Email
 private async sendOrderNotificationEmail(order: any, payload?: OrderWebhookPayload) {
  const adminEmail = this.configService.get<string>('ADMIN_EMAIL') || 
                    this.configService.get<string>('EMAIL_USER');

  // ใช้ข้อมูลจาก payload ถ้ามี, ถ้าไม่มีใช้จาก order
  const orderData = payload ? {
    order_id: payload.orderId,
    total_price: payload.totalPrice,
    order_type: payload.orderType,
    user: {
      first_name: payload.customerInfo?.name?.split(' ')[0] || '',
      last_name: payload.customerInfo?.name?.split(' ')[1] || '',
      phone: payload.customerInfo?.phone || '',
    },
    order_details: payload.items || [],
    table: payload.tableNumber ? { number: payload.tableNumber } : null,
    delivery: payload.deliveryAddress ? { delivery_address: payload.deliveryAddress } : null,
  } : order;

  const itemsList = (payload?.items || order.order_details).map(detail => {
    if (payload?.items) {
      return `<li>${detail.name} x${detail.quantity} - ฿${detail.price.toLocaleString()}</li>`;
    } else {
      const itemName = detail.food_menu?.name || detail.beverage_menu?.name;
      return `<li>${itemName} x${detail.quantity} - ฿${detail.price.toLocaleString()}</li>`;
    }
  }).join('');

  const emailHtml = `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2c3e50;">🔔 ออเดอร์ใหม่!</h2>
    
    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p><strong>รหัสออเดอร์:</strong> ${orderData.order_id}</p>
      <p><strong>ยอดรวม:</strong> ฿${orderData.total_price.toLocaleString()}</p>
      <p><strong>ประเภท:</strong> ${this.getOrderTypeText(orderData.order_type)}</p>
      <p><strong>ลูกค้า:</strong> ${orderData.user?.first_name || 'ไม่ระบุ'} ${orderData.user?.last_name || ''}</p>
      <p><strong>เบอร์:</strong> ${orderData.user?.phone || 'ไม่ระบุ'}</p>
      ${orderData.table ? `<p><strong>โต๊ะ:</strong> ${orderData.table.number}</p>` : ''}
      ${orderData.delivery ? `<p><strong>ที่อยู่จัดส่ง:</strong> ${orderData.delivery.delivery_address}</p>` : ''}
    </div>

    <h3>รายการสินค้า:</h3>
    <ul style="list-style-type: none; padding: 0;">
      ${itemsList}
    </ul>
    
    <p style="color: #e74c3c; font-weight: bold;">กรุณาเตรียมออเดอร์</p>
    
    ${payload ? '<p style="color: #f39c12;"><em>ข้อมูลจาก Webhook</em></p>' : ''}
  </div>
  `;

  const mailOptions = {
    from: this.configService.get<string>('EMAIL_FROM'),
    to: adminEmail,
    subject: `🔔 ออเดอร์ใหม่ - ${orderData.order_id}`,
    html: emailHtml
  };

  try {
    if (!this.mailTransporter) {
      this.logger.warn('Mail transporter not available');
      return { 
        sent: false, 
        via: 'email',
        reason: 'Mail transporter not available',
        timestamp: new Date().toISOString()
      };
    }

    const result = await this.mailTransporter.sendMail(mailOptions);
    return { 
      sent: true, 
      via: 'email',
      messageId: result.messageId,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    this.logger.error('Failed to send notification email:', error);
    throw new HttpException(
      'Failed to send notification',
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}

private getOrderTypeText(orderType: string): string {
  switch (orderType) {
    case 'pickup': return 'รับเอง';
    case 'delivery': return 'จัดส่ง';
    case 'table': return 'ทานที่ร้าน';
    case 'dine-in': return 'ทานที่ร้าน';
    default: return orderType;
  }
}

  // 2. ส่งรายงานยอดขายผ่าน Email
  async sendSalesReport(payload: SalesReportPayload) {
    this.logger.log(`Generating sales report: ${payload.reportType}`);
    
    try {
      const { startDate, endDate } = this.getDateRange(payload.reportType);
      
      // ดึงข้อมูลยอดขายจาก database
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

      // ลองใช้ direct nodemailer แทน
      try {
        // @ts-ignore
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

        const emailHtml = this.generateSalesReportHtml(reportData, payload.reportType);
        
        const mailOptions = {
          from: 'phoneyang1@gmail.com',
          to: adminEmail,
          subject: `📊 รายงานยอดขาย${this.getReportTypeText(payload.reportType)} - ${new Date().toLocaleDateString('th-TH')}`,
          html: emailHtml
        };

        const result = await directTransporter.sendMail(mailOptions);
        
        return { 
          sent: true, 
          via: 'direct-nodemailer',
          messageId: result.messageId,
          reportType: payload.reportType,
          totalSales: reportData.totalSales,
          totalOrders: reportData.totalOrders,
          timestamp: new Date().toISOString()
        };
      } catch (directError) {
        this.logger.error('Direct nodemailer failed:', directError);
        
        // Fallback: ส่งผ่าน transporter เดิม
        if (!this.mailTransporter) {
          this.logger.warn('Mail transporter not available, returning report data only');
          return { 
            sent: false, 
            reason: 'Mail transporter not available',
            reportType: payload.reportType,
            totalSales: reportData.totalSales,
            totalOrders: reportData.totalOrders,
            reportData: reportData,
            timestamp: new Date().toISOString()
          };
        }

        const emailHtml = this.generateSalesReportHtml(reportData, payload.reportType);
        
        const mailOptions = {
          from: this.configService.get<string>('EMAIL_FROM'),
          to: adminEmail,
          subject: `📊 รายงานยอดขาย${this.getReportTypeText(payload.reportType)} - ${new Date().toLocaleDateString('th-TH')}`,
          html: emailHtml
        };

        const result = await this.mailTransporter.sendMail(mailOptions);
        
        return { 
          sent: true, 
          messageId: result.messageId,
          reportType: payload.reportType,
          totalSales: reportData.totalSales,
          totalOrders: reportData.totalOrders,
          timestamp: new Date().toISOString()
        };
      }
    } catch (error) {
      this.logger.error('Failed to send sales report email:', error);
      throw new HttpException(
        `Failed to send sales report: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // 3. ส่ง Pickup Code ผ่าน Email
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
      <h2 style="color: #27ae60;">🎫 รหัสรับสินค้า</h2>
      
      <div style="background: #f8f9fa; padding: 30px; text-align: center; border-radius: 8px; margin: 20px 0;">
        <h1 style="color: #2c3e50; font-size: 48px; margin: 0;">${order.pickup_code || 'N/A'}</h1>
        <p style="color: #7f8c8d; margin-top: 10px;">รหัสรับสินค้า</p>
      </div>

      <div style="background: #ecf0f1; padding: 20px; border-radius: 8px;">
        <p><strong>ออเดอร์:</strong> ${order.order_id}</p>
        <p><strong>ยอดรวม:</strong> ฿${order.total_price.toLocaleString()}</p>
        <p><strong>ประเภท:</strong> ${order.order_type}</p>
      </div>

      <p style="margin-top: 20px; color: #e74c3c;">
        <strong>วิธีรับสินค้า:</strong><br>
        1. แสดงรหัสนี้ที่เคาน์เตอร์<br>
        2. หรือบอกรหัส ${order.pickup_code || 'N/A'} กับเจ้าหน้าที่
      </p>
    </div>
    `;
    
    const mailOptions = {
      from: 'phoneyang1@gmail.com',
      to: order.user.email,
      subject: `🎫 รหัสรับสินค้า - ออเดอร์ ${order.order_id}`,
      html: emailHtml
    };

    try {
      // ใช้ direct nodemailer
      // @ts-ignore
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

  // 4. ส่งใบเสร็จ (แบบ HTML แทน PDF ก่อน)
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
        <td style="text-align: right;">฿${detail.price.toLocaleString()}</td>
      </tr>
      `;
    }).join('');

    const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1>SeeU Cafe</h1>
        <h2>ใบเสร็จรับเงิน</h2>
      </div>
      
      <div style="margin-bottom: 20px;">
        <p><strong>ออเดอร์:</strong> ${order.order_id}</p>
        <p><strong>วันที่:</strong> ${order.create_at.toLocaleDateString('th-TH')}</p>
        <p><strong>ลูกค้า:</strong> ${order.user.first_name} ${order.user.last_name || ''}</p>
        ${order.table ? `<p><strong>โต๊ะ:</strong> ${order.table.number}</p>` : ''}
      </div>
      
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f8f9fa;">
            <th style="padding: 8px; border-bottom: 1px solid #ddd;">รายการ</th>
            <th style="padding: 8px; border-bottom: 1px solid #ddd; width: 80px;">จำนวน</th>
            <th style="padding: 8px; border-bottom: 1px solid #ddd; width: 100px;">ราคา</th>
          </tr>
        </thead>
        <tbody>
          ${itemsList}
        </tbody>
      </table>
      
      <div style="margin-top: 20px; text-align: right;">
        <p style="font-weight: bold; font-size: 16px;">ยอดรวม: ฿${order.total_price.toLocaleString()}</p>
      </div>
      
      <div style="margin-top: 30px; text-align: center; color: #666;">
        <p>ขอบคุณที่ใช้บริการ</p>
        <p>SeeU Cafe</p>
      </div>
    </div>
    `;
    
    const mailOptions = {
      from: 'phoneyang1@gmail.com',
      to: order.user.email,
      subject: `🧾 ใบเสร็จ - ออเดอร์ ${order.order_id}`,
      html: emailHtml
    };

    try {
      // ใช้ direct nodemailer เหมือน sendSalesReport
      // @ts-ignore
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

  // 5. อัปเดตสถานะโต๊ะ
  async updateTableStatus(payload: TableStatusPayload) {
    this.logger.log(`Updating table ${payload.tableId} status to: ${payload.newStatus}`);
    
    try {
      const updatedTable = await this.prisma.table.update({
        where: { id: payload.tableId },
        data: { 
          status: payload.newStatus,
          updated_at: new Date(),
          // อัปเดตเวลาตามสถานะ
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

  // Helper Methods
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
    
    // นับสินค้าที่ขายดี
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
      <h2 style="color: #2c3e50;">📊 รายงานยอดขาย${this.getReportTypeText(reportType)}</h2>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #27ae60;">สรุปยอดขาย</h3>
        <p><strong>ยอดขายรวม:</strong> ฿${data.totalSales.toLocaleString()}</p>
        <p><strong>จำนวนออเดอร์:</strong> ${data.totalOrders} ออเดอร์</p>
        <p><strong>ยอดขายเฉลี่ย:</strong> ฿${data.totalOrders > 0 ? (data.totalSales / data.totalOrders).toLocaleString() : 0} ต่อออเดอร์</p>
      </div>

      <div style="background: #ecf0f1; padding: 20px; border-radius: 8px;">
        <h3 style="color: #e74c3c;">สินค้าขายดี Top 5</h3>
        <ol>${topItemsList}</ol>
      </div>
      
      <p style="margin-top: 20px; color: #7f8c8d; font-size: 12px;">
        รายงานสร้างเมื่อ: ${new Date().toLocaleString('th-TH')}
      </p>
    </div>
    `;
  }

  private getReportTypeText(type: string) {
    switch (type) {
      case 'daily': return 'รายวัน';
      case 'weekly': return 'รายสัปดาห์';
      case 'monthly': return 'รายเดือน';
      default: return '';
    }
  }
}