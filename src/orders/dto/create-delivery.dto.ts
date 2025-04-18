import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsInt,
} from 'class-validator';

export class CreateDeliveryDto {
  @ApiProperty({
    description: 'Delivery address',
    example: '123 Main St, Bangkok, Thailand',
  })
  @IsNotEmpty()
  @IsString()
  delivery_address: string;

  @ApiProperty({
    description: 'ID of the carrier (if applicable)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  carrier_id?: number;

  @ApiProperty({
    description: 'ID of the employee assigned to delivery',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  employee_id?: number;

  @ApiProperty({
    description: 'Delivery fee',
    example: 50,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  delivery_fee?: number;

  @ApiProperty({
    description: 'Customer note for delivery',
    example: 'Please leave at the front door',
    required: false,
  })
  @IsOptional()
  @IsString()
  customer_note?: string;
}
