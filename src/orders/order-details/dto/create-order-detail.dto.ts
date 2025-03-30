import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  IsString,
} from 'class-validator';

export class CreateOrderDetailDto {
  @ApiPropertyOptional({
    description: 'ID of the food menu item',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  food_menu_id?: number;

  @ApiPropertyOptional({
    description: 'ID of the beverage menu item',
    example: 2,
  })
  @IsInt()
  @IsOptional()
  beverage_menu_id?: number;

  @ApiProperty({
    description: 'Quantity of the item',
    example: 2,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;

  @ApiProperty({
    description: 'Price of the item',
    example: 9.99,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  price: number;

  @ApiPropertyOptional({
    description: 'Special notes for the item',
    example: 'No onions, extra spicy',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Status of the order item',
    example: 'pending',
    default: 'pending',
  })
  @IsString()
  @IsOptional()
  status_id?: string;
}
