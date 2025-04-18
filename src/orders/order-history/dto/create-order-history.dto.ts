import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Prisma } from '@prisma/client';

export class CreateOrderHistoryDto {
  @ApiProperty({
    description: 'User ID',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  user_id: number;

  @ApiProperty({
    description: 'Order ID string (corresponds to Order.order_id)',
    example: 'ORD1234567890',
  })
  @IsNotEmpty()
  @IsString()
  order_id: string;

  @ApiProperty({
    description: 'Date the order was placed',
    example: '2023-01-01T12:00:00Z',
  })
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  order_date: Date;

  @ApiProperty({
    description: 'Total amount of the order',
    example: 150.75,
  })
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  total_amount: number;

  @ApiProperty({
    description: 'Type of order',
    example: 'delivery',
    enum: ['pickup', 'delivery', 'table'],
  })
  @IsNotEmpty()
  @IsEnum(['pickup', 'delivery', 'table'])
  order_type: string;

  @ApiProperty({
    description: 'Status of the order',
    example: 'completed',
  })
  @IsNotEmpty()
  @IsString()
  status: string;

  @ApiProperty({
    description: 'Order items in JSON format',
    example: '[{"name":"Pad Thai","quantity":2,"price":95,"notes":"Spicy"}]',
  })
  @IsNotEmpty()
  @IsObject()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Prisma.JsonValue;
      } catch (error) {
        console.error(error.message);
        return {} as Prisma.JsonValue;
      }
    }
    return (value || {}) as Prisma.JsonValue;
  })
  items: Prisma.JsonValue;

  @ApiPropertyOptional({
    description: 'Payment method used',
    example: 'credit_card',
    required: false,
  })
  @IsOptional()
  @IsString()
  payment_method?: string;

  @ApiPropertyOptional({
    description: 'Delivery address (for delivery orders)',
    example: '123 Main St, Bangkok, Thailand',
    required: false,
  })
  @IsOptional()
  @IsString()
  delivery_address?: string;

  @ApiPropertyOptional({
    description: 'Whether this order is marked as favorite',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_favorite?: boolean;

  @ApiPropertyOptional({
    description: 'Number of times this order has been re-ordered',
    example: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt()
  reorder_count?: number;
}
