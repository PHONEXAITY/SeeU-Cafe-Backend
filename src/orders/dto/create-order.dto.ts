import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOrderDetailDto } from '../order-details/dto/create-order-detail.dto';
import { CreateDeliveryDto } from './create-delivery.dto';

export class CreateOrderDto {
  @ApiProperty({
    description: 'Order type: pickup, delivery, or table',
    example: 'pickup',
    enum: ['pickup', 'delivery', 'table'],
  })
  @IsNotEmpty()
  @IsEnum(['pickup', 'delivery', 'table'])
  order_type: string;

  @ApiProperty({
    description: 'Total price of the order',
    example: 150.75,
  })
  @IsNotEmpty()
  @IsNumber()
  total_price: number;

  @ApiProperty({
    description: 'ID of the user who placed the order',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  User_id?: number;

  @ApiProperty({
    description: 'ID of the employee who handled the order',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  Employee_id?: number;

  @ApiProperty({
    description: 'ID of the table (for dine-in orders)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  table_id?: number;

  @ApiProperty({
    description: 'ID of the promotion applied to the order',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  promotion_id?: number;

  @ApiProperty({
    description: 'Discount amount from the promotion',
    example: 10.5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  discount_amount?: number;

  @ApiProperty({
    description: 'Status of the order',
    example: 'pending',
    required: false,
    default: 'pending',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    description: 'Pickup time (for pickup orders)',
    example: '2023-01-01T12:00:00Z',
    required: false,
  })
  @IsOptional()
  @Type(() => Date)
  pickup_time?: Date;

  @ApiProperty({
    description: 'Additional preparation notes',
    example: 'Customer is allergic to nuts',
    required: false,
  })
  @IsOptional()
  @IsString()
  preparation_notes?: string;

  @ApiProperty({
    description: 'Order details (items in the order)',
    type: [CreateOrderDetailDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderDetailDto)
  order_details?: CreateOrderDetailDto[];

  @ApiProperty({
    description: 'Delivery information (for delivery orders)',
    type: CreateDeliveryDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateDeliveryDto)
  delivery?: CreateDeliveryDto;
}
