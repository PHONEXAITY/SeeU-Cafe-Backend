import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateOrderTimelineDto {
  @ApiProperty({
    description: 'Order ID',
    example: 1,
  })
  @IsNotEmpty()
  @IsInt()
  order_id: number;

  @ApiProperty({
    description: 'Status of the order at this timeline point',
    example: 'cooking',
    enum: [
      'created',
      'cooking',
      'ready',
      'picked_up',
      'delivered',
      'completed',
      'cancelled',
    ],
  })
  @IsNotEmpty()
  @IsEnum([
    'created',
    'cooking',
    'ready',
    'picked_up',
    'delivered',
    'completed',
    'cancelled',
  ])
  status: string;

  @ApiProperty({
    description: 'ID of the employee responsible for this status change',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  employee_id?: number;

  @ApiProperty({
    description: 'Additional notes about this status change',
    example: 'Customer requested delivery to be postponed by 30 minutes',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
