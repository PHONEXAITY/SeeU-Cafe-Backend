import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { PushNotificationsService } from './push-notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface JwtRequest extends Request {
  user: {
    id: number;
  };
}

@ApiTags('Push Notifications')
@Controller('push-notifications')
export class PushNotificationsController {
  constructor(
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Subscribe to push notifications' })
  async subscribe(
    @Req() req: JwtRequest,
    @Body() subscription: PushSubscription,
  ): Promise<void> {
    const userId = req.user.id;
    await this.pushNotificationsService.saveSubscription(userId, subscription);
  }

  @Post('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from push notifications' })
  async unsubscribe(@Body() { endpoint }: { endpoint: string }): Promise<void> {
    await this.pushNotificationsService.removeSubscription(endpoint);
  }
}
