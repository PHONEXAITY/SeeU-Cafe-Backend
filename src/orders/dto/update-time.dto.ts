import { ApiProperty } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTimeDto {
  @ApiProperty({
    description: 'Type of time to update',
    enum: ['estimated_ready_time', 'pickup_time', 'estimated_delivery_time'],
    example: 'estimated_ready_time',
  })
  @IsNotEmpty()
  @IsEnum(['estimated_ready_time', 'pickup_time', 'estimated_delivery_time'])
  timeType: string;

  @ApiProperty({
    description: 'New time value',
    example: '2023-01-01T12:00:00Z',
  })
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  newTime: Date;

  @ApiProperty({
    description: 'Reason for time update',
    example: 'Kitchen is busy',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({
    description: 'ID of employee who updated the time',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  employeeId?: number;

  @ApiProperty({
    description: 'Whether to notify the customer about the time change',
    example: true,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  notifyCustomer?: boolean;

  @ApiProperty({
    description: 'Custom notification message to send to the customer',
    example: 'Your order will be ready in 30 minutes',
    required: false,
  })
  @IsOptional()
  @IsString()
  notificationMessage?: string;
}
