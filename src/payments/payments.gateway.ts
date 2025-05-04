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
    origin: [
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
  }

  @SubscribeMessage('subscribeToPaymentStatus')
  async handleSubscribeToPaymentStatus(
    @MessageBody() data: { paymentId: number; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(
      `Client ${client.id} subscribed to payment ${data.paymentId}`,
    );
    await client.join(`payment_${data.paymentId}`);

    const payment = await this.prisma.payment.findUnique({
      where: { id: data.paymentId },
      select: { status: true },
    });

    if (payment) {
      void client.emit('paymentStatusUpdate', {
        paymentId: data.paymentId,
        status: payment.status,
      });
    }
  }

  broadcastPaymentStatusUpdate(paymentId: number, status: string) {
    this.server.to(`payment_${paymentId}`).emit('paymentStatusUpdate', {
      paymentId,
      status,
    });
    this.logger.log(
      `Broadcasted payment status update: ${paymentId} - ${status}`,
    );
  }
}
