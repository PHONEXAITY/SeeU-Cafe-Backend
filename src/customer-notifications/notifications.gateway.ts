import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private userSockets: Map<number, Socket[]> = new Map();
  private roleSockets: Map<string, Socket[]> = new Map();
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly prisma: PrismaService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    // ดึง userId จาก handshake query
    const userId = this.getUserIdFromClient(client);
    if (userId) {
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, []);
      }
      const userConnections = this.userSockets.get(userId);
      if (userConnections) {
        userConnections.push(client);
      }
      this.logger.log(`User ${userId} connected: ${client.id}`);

      // ส่งข้อความยืนยันการเชื่อมต่อกลับไปยังไคลเอนต์
      client.emit('connection_status', {
        connected: true,
        userId,
        message: 'ເຊື່ອມຕໍ່ກັບລະບົບການແຈ້ງເຕືອນສຳເລັດແລ້ວ',
      });
    }

    // รับข้อมูลบทบาทจาก handshake query
    const role = this.getRoleFromClient(client);
    if (role) {
      if (!this.roleSockets.has(role)) {
        this.roleSockets.set(role, []);
      }
      const roleConnections = this.roleSockets.get(role);
      if (roleConnections) {
        roleConnections.push(client);
      }
      this.logger.log(`Client with role ${role} connected: ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // ลบ socket จาก userSockets
    const userId = this.getUserIdFromClient(client);
    if (userId) {
      const userConnections = this.userSockets.get(userId) || [];
      const updatedConnections = userConnections.filter(
        (socket) => socket.id !== client.id,
      );

      if (updatedConnections.length > 0) {
        this.userSockets.set(userId, updatedConnections);
      } else {
        this.userSockets.delete(userId);
      }
      this.logger.log(`User ${userId} disconnected: ${client.id}`);
    }

    // ลบ socket จาก roleSockets
    const role = this.getRoleFromClient(client);
    if (role) {
      const roleConnections = this.roleSockets.get(role) || [];
      const updatedConnections = roleConnections.filter(
        (socket) => socket.id !== client.id,
      );

      if (updatedConnections.length > 0) {
        this.roleSockets.set(role, updatedConnections);
      } else {
        this.roleSockets.delete(role);
      }
      this.logger.log(`Client with role ${role} disconnected: ${client.id}`);
    }
  }

  @SubscribeMessage('subscribe_role_notifications')
  handleRoleSubscription(client: Socket, payload: { role: string }) {
    this.logger.log(`Client ${client.id} subscribing to role: ${payload.role}`);

    if (!this.roleSockets.has(payload.role)) {
      this.roleSockets.set(payload.role, []);
    }
    const roleConnections = this.roleSockets.get(payload.role);
    if (roleConnections && !roleConnections.includes(client)) {
      roleConnections.push(client);
    }

    return {
      success: true,
      message: `Subscribed to ${payload.role} notifications`,
    };
  }

  @SubscribeMessage('unsubscribe_role_notifications')
  handleRoleUnsubscription(client: Socket, payload: { role: string }) {
    this.logger.log(
      `Client ${client.id} unsubscribing from role: ${payload.role}`,
    );

    if (this.roleSockets.has(payload.role)) {
      const roleConnections = this.roleSockets.get(payload.role) || [];
      const updatedConnections = roleConnections.filter(
        (socket) => socket.id !== client.id,
      );

      if (updatedConnections.length > 0) {
        this.roleSockets.set(payload.role, updatedConnections);
      } else {
        this.roleSockets.delete(payload.role);
      }
    }

    return {
      success: true,
      message: `Unsubscribed from ${payload.role} notifications`,
    };
  }

  /**
   * ส่งการแจ้งเตือนไปยังผู้ใช้เฉพาะราย
   */
  sendNotificationToUser(userId: number, notification: any): boolean {
    const connections = this.userSockets.get(userId) || [];
    if (connections.length > 0) {
      connections.forEach((socket) => {
        socket.emit('notification', notification);
      });
      this.logger.log(`Notification sent to user ${userId}`);
      return true;
    }
    this.logger.log(`User ${userId} is not connected`);
    return false;
  }

  /**
   * ส่งการแจ้งเตือนไปยังทุกคนที่เชื่อมต่อ
   */
  sendNotificationToAll(notification: any) {
    this.server.emit('notification', notification);
    this.logger.log('Notification broadcast to all users');
  }

  /**
   * ส่งการแจ้งเตือนไปยังผู้ใช้ที่มีบทบาทเฉพาะ
   */
  async sendNotificationToRoles(roles: string[], notification: any) {
    // ส่งผ่าน role-based subscriptions
    for (const role of roles) {
      const roleConnections = this.roleSockets.get(role) || [];
      roleConnections.forEach((socket) => {
        socket.emit('notification', notification);
      });
    }

    // ส่งผ่านข้อมูลบทบาทที่เก็บใน DB
    const users = await this.prisma.user.findMany({
      where: {
        role: { name: { in: roles } },
      },
    });

    await Promise.all(
      users.map((user) => this.sendNotificationToUser(user.id, notification)),
    );
    this.logger.log(`Notification sent to roles: ${roles.join(', ')}`);
  }

  /**
   * ส่งการแจ้งเตือนเกี่ยวกับสถานะออเดอร์ไปยังผู้ใช้และพนักงาน
   */
  async sendOrderStatusNotification(
    orderId: number,
    status: string,
    notification: any,
  ) {
    // ส่งการแจ้งเตือนไปยังผู้ใช้
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { user: true },
    });

    if (order?.User_id && order.user?.id) {
      this.sendNotificationToUser(order.user.id, notification);
    }

    // ส่งการแจ้งเตือนไปยังพนักงาน
    this.server.to('employee').emit('order_status', {
      ...notification,
      orderId,
      status,
    });
  }

  private getUserIdFromClient(client: Socket): number | null {
    const userId = client.handshake.query.userId;
    return userId ? Number(userId) : null;
  }

  private getRoleFromClient(client: Socket): string | null {
    const role = client.handshake.query.role;
    return role ? String(role) : null;
  }
}
