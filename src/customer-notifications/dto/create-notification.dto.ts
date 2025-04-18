import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
} from 'class-validator';

enum NotificationType {
  ORDER_UPDATE = 'order_update',
  TIME_CHANGE = 'time_change',
  DELIVERY_UPDATE = 'delivery_update',
  PICKUP_READY = 'pickup_ready',
  PROMOTION = 'promotion',
}

export class CreateNotificationDto {
  @ApiProperty({
    description: 'ID of the user to send notification to',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  user_id: number;

  @ApiProperty({
    description: 'ID of the related order (if applicable)',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  order_id: number;

  @ApiProperty({
    description: 'Notification message',
    example: 'Your order will be ready in 15 minutes',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: 'Type of notification',
    enum: NotificationType,
    example: NotificationType.ORDER_UPDATE,
  })
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: string;

  @ApiPropertyOptional({
    description: 'URL to redirect when notification is clicked',
    example: '/orders/ORD1234567890',
  })
  @IsString()
  @IsOptional()
  action_url?: string;

  @ApiPropertyOptional({
    description: 'Whether the notification has been read',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  read?: boolean;
}
