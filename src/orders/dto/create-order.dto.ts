import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsInt,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOrderDetailDto } from '../order-details/dto/create-order-detail.dto';

export class CreateOrderDto {
  @ApiPropertyOptional({
    description: 'ID of the user placing the order',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  User_id?: number;

  @ApiPropertyOptional({
    description: 'ID of the employee handling the order',
    example: 2,
  })
  @IsInt()
  @IsOptional()
  Employee_id?: number;

  @ApiPropertyOptional({
    description: 'ID of the table for dine-in orders',
    example: 3,
  })
  @IsInt()
  @IsOptional()
  table_id?: number;

  @ApiPropertyOptional({
    description: 'ID of the applied promotion',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  promotion_id?: number;

  @ApiPropertyOptional({
    description: 'Order status',
    example: 'pending',
    default: 'pending',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({
    description: 'Total price of the order',
    example: 29.99,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  total_price: number;

  @ApiPropertyOptional({
    description: 'Discount amount applied to the order',
    example: 5.0,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discount_amount?: number;

  @ApiProperty({
    description: 'Order items',
    type: [CreateOrderDetailDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderDetailDto)
  @IsNotEmpty()
  order_details: CreateOrderDetailDto[];
}
