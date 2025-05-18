import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsEnum,
  IsInt,
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  MinLength,
  Min,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { DeliveryStatus } from '../enums/delivery-status.enum';

export class CreateDeliveryDto {
  @ApiProperty({
    description: 'ID of the order to deliver',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
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

  @ApiProperty({
    description: 'Delivery address (minimum 10 characters)',
    example: '123 Main Street, Vientiane Capital, Laos',
    minLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10, {
    message: 'Delivery address must be at least 10 characters long',
  })
  @Transform(({ value }: { value: string }) => value?.trim())
  delivery_address: string;

  @ApiPropertyOptional({
    description: 'Customer contact phone number',
    example: '+856 20 12345678',
  })
  @IsString()
  @IsOptional()
  @Matches(/^[0-9+\s\-()]{8,15}$/, { message: 'Invalid phone number format' })
  @Transform(({ value }: { value: string }) => value?.trim())
  phone_number?: string;

  @ApiPropertyOptional({
    description: 'ID of the employee responsible for delivery',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  employee_id?: number;

  @ApiPropertyOptional({
    description: 'Estimated delivery time (ISO 8601 format)',
    example: '2023-12-01T15:30:00Z',
  })
  @IsDateString()
  @IsOptional()
  estimated_delivery_time?: string;

  @ApiPropertyOptional({
    description: 'Delivery fee in LAK',
    example: 15000,
    minimum: 0,
  })
  @IsNumber()
  @IsOptional()
  @Min(0, { message: 'Delivery fee must be a positive number' })
  @Type(() => Number)
  delivery_fee?: number;

  @ApiPropertyOptional({
    description: 'Customer note for delivery instructions',
    example: 'Please call when you arrive',
  })
  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: string }) => value?.trim())
  customer_note?: string;
}
