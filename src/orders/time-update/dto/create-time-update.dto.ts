import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTimeUpdateDto {
  @ApiProperty({
    description: 'Order ID',
    example: 1,
  })
  @IsNotEmpty()
  @IsInt()
  order_id: number;

  @ApiProperty({
    description: 'Previous time before update',
    example: '2023-01-01T12:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  previous_time?: Date;

  @ApiProperty({
    description: 'New time after update',
    example: '2023-01-01T12:30:00Z',
  })
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  new_time: Date;

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
  updated_by?: number;

  @ApiProperty({
    description: 'Whether the customer was notified about this change',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  notified_customer?: boolean;

  @ApiProperty({
    description: 'Custom notification message to send to the customer',
    example: 'Your order will be ready in 30 minutes',
    required: false,
  })
  @IsOptional()
  @IsString()
  notification_message?: string;
}
