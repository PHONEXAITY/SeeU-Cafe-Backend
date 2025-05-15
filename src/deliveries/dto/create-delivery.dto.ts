import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsEnum,
  IsInt,
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DeliveryStatus } from '../enums/delivery-status.enum';

export class CreateDeliveryDto {
  @ApiProperty({
    description: 'ID of the order to deliver',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  order_id: number;

  @ApiPropertyOptional({
    description: 'Status of the delivery',
    enum: DeliveryStatus,
    example: DeliveryStatus.PENDING,
    default: DeliveryStatus.PENDING,
  })
  @IsEnum(DeliveryStatus)
  @IsOptional()
  status?: DeliveryStatus;

  @ApiPropertyOptional({
    description: 'Delivery address',
    example: '123 Main St, Bangkok, Thailand',
  })
  @IsString()
  @IsOptional()
  delivery_address?: string;

  @ApiPropertyOptional({
    description: 'Carrier ID or info',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  carrier_id?: number;

  @ApiPropertyOptional({
    description: 'ID of the employee responsible for delivery',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  employee_id?: number;

  @ApiPropertyOptional({
    description: 'Estimated delivery time',
    example: '2023-01-01T15:30:00Z',
  })
  @IsDateString()
  @IsOptional()
  estimated_delivery_time?: string;

  @ApiPropertyOptional({
    description: 'Delivery fee',
    example: 50,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  delivery_fee?: number;

  @ApiPropertyOptional({
    description: 'Customer note for delivery',
    example: 'Please leave at the front door',
  })
  @IsString()
  @IsOptional()
  customer_note?: string;
}
