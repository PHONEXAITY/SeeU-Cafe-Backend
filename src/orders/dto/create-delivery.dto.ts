import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  @ApiProperty({
    description: 'Customer latitude coordinate',
    example: 19.8845,
    minimum: -90,
    maximum: 90,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  customer_latitude?: number;

  @ApiProperty({
    description: 'Customer longitude coordinate',
    example: 102.135,
    minimum: -180,
    maximum: 180,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  customer_longitude?: number;

  @ApiProperty({
    description: 'Additional location note for customer address',
    example: 'Near the temple, blue building',
    required: false,
  })
  @IsOptional()
  @IsString()
  customer_location_note?: string;
}
