import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { DeliveryTimeType } from '../enums/delivery-status.enum';

export class UpdateDeliveryTimeDto {
  @ApiProperty({
    description: 'Type of time to update',
    enum: DeliveryTimeType,
    example: DeliveryTimeType.ESTIMATED_DELIVERY_TIME,
  })
  @IsNotEmpty()
  @IsEnum(DeliveryTimeType)
  timeType: DeliveryTimeType;

  @ApiProperty({
    description: 'New time value (ISO 8601 format)',
    example: '2025-05-15T16:00:00Z',
  })
  @IsNotEmpty()
  @IsDateString()
  newTime: string;

  @ApiPropertyOptional({
    description: 'Reason for time update',
    example: 'Traffic delay due to construction',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(({ value }: { value: string }) => (value ? value.trim() : value))
  reason?: string;

  @ApiPropertyOptional({
    description: 'ID of employee who updated the time',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  employeeId?: number;

  @ApiPropertyOptional({
    description: 'Whether to notify the customer about the time change',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  notifyCustomer?: boolean;

  @ApiPropertyOptional({
    description: 'Custom notification message to send to the customer',
    example: 'Your delivery is slightly delayed due to heavy traffic',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: string }) => (value ? value.trim() : value))
  notificationMessage?: string;
}
