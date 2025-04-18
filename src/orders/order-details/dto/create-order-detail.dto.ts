import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';

export class CreateOrderDetailDto {
  @ApiProperty({
    description: 'ID of the food menu item',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  food_menu_id?: number;

  @ApiProperty({
    description: 'ID of the beverage menu item',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  beverage_menu_id?: number;

  @ApiProperty({
    description: 'Quantity of the item',
    example: 2,
  })
  @IsInt()
  quantity: number;

  @ApiProperty({
    description: 'Price of the item',
    example: 75.5,
  })
  @IsNumber()
  price: number;

  @ApiProperty({
    description: 'Special instructions for the item',
    example: 'No onions, extra sauce',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Status identifier for the item',
    example: 'pending',
    required: false,
  })
  @IsOptional()
  @IsString()
  status_id?: string;

  @ApiProperty({
    description: 'Preparation time in minutes',
    example: 15,
    required: false,
  })
  @IsOptional()
  @IsInt()
  preparation_time?: number;

  @ApiProperty({
    description: 'Whether the item is ready',
    example: false,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  is_ready?: boolean;
}
