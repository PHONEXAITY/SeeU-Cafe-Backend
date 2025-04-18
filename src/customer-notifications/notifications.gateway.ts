import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';

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

  handleConnection(client: Socket) {
    const userId = this.getUserIdFromClient(client);
    if (userId) {
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, []);
      }
      const userConnections = this.userSockets.get(userId);
      if (userConnections) {
        userConnections.push(client);
      }

      console.log(`User ${userId} connected: ${client.id}`);
    }
  }

  handleDisconnect(client: Socket) {
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

      console.log(`User ${userId} disconnected: ${client.id}`);
    }
  }

  sendNotificationToUser(userId: number, notification: any) {
    const connections = this.userSockets.get(userId) || [];

    if (connections.length > 0) {
      connections.forEach((socket) => {
        socket.emit('notification', notification);
      });
      console.log(`Notification sent to user ${userId}`);
      return true;
    }

    console.log(`User ${userId} is not connected`);
    return false;
  }

  sendNotificationToAll(notification: any) {
    this.server.emit('notification', notification);
    console.log('Notification broadcast to all users');
  }

  private getUserIdFromClient(client: Socket): number | null {
    const userId = client.handshake.query.userId;
    return userId ? Number(userId) : null;
  }
}
