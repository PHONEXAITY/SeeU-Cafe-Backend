import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsArray,
} from 'class-validator';

enum NotificationType {
  ORDER_UPDATE = 'order_update',
  TIME_CHANGE = 'time_change',
  DELIVERY_UPDATE = 'delivery_update',
  PICKUP_READY = 'pickup_ready',
  PROMOTION = 'promotion',
  INFO = 'info',
}

export class CreateNotificationDto {
  @ApiProperty({
    description:
      'ID of the user to send notification to (optional if targeting roles or broadcasting)',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  user_id?: number;

  @ApiPropertyOptional({
    description: 'ID of the related order (if applicable)',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  order_id?: number;

  @ApiProperty({
    description: 'Notification message content',
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

  @ApiPropertyOptional({
    description: 'Array of role names to target (e.g., ["admin", "employee"])',
    example: ['admin', 'employee'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  target_roles?: string[];

  @ApiPropertyOptional({
    description: 'Whether to broadcast the notification to all users',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  broadcast?: boolean;
}
