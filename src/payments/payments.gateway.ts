import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
        ],
    credentials: true,
  },
})
@Injectable()
export class PaymentsGateway {
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('PaymentsGateway');

  constructor(private readonly prisma: PrismaService) {}

  afterInit() {
    this.logger.log('WebSocket Gateway Initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    client.rooms.forEach((room) => {
      if (room !== client.id) {
        client.leave(room);
        this.logger.log(`Client ${client.id} left room: ${room}`);
      }
    });
  }

  @SubscribeMessage('subscribeToPaymentStatus')
  async handleSubscribeToPaymentStatus(
    @MessageBody() data: { paymentId: number; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    if (!data.paymentId || !data.userId) {
      this.logger.error(`Invalid subscription data: ${JSON.stringify(data)}`);
      client.emit('error', {
        message: 'Invalid paymentId or userId',
      });
      return;
    }

    const room = `payment_${data.paymentId}`;

    if (client.rooms.has(room)) {
      this.logger.log(
        `Client ${client.id} already subscribed to room ${room} for payment ${data.paymentId}`,
      );
      return;
    }

    this.logger.log(
      `Client ${client.id} subscribed to payment ${data.paymentId} for user ${data.userId}`,
    );
    await client.join(room);

    const payment = await this.prisma.payment.findUnique({
      where: { id: data.paymentId },
      select: { status: true },
    });

    if (payment) {
      client.emit('paymentStatusUpdate', {
        paymentId: data.paymentId,
        status: payment.status,
      });
    } else {
      this.logger.warn(`Payment ${data.paymentId} not found`);
      client.emit('error', {
        message: `Payment ${data.paymentId} not found`,
      });
    }
  }

  broadcastPaymentStatusUpdate(paymentId: number, status: string) {
    const room = `payment_${paymentId}`;
    this.server.to(room).emit('paymentStatusUpdate', {
      paymentId,
      status,
    });
    this.logger.log(
      `Broadcasted payment status update to room ${room}: payment ${paymentId} - ${status}`,
    );
  }
}
