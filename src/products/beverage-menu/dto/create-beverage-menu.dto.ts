import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsInt,
  IsUrl,
} from 'class-validator';

export class CreateBeverageMenuDto {
  @ApiProperty({
    description: 'The name of the beverage',
    example: 'Thai Iced Tea',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the beverage',
    example: 'Traditional Thai tea with milk and sugar, served over ice',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Regular price of the beverage (optional for beverages)',
    example: 3.99,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional() // Make price optional
  price?: number;

  @ApiPropertyOptional({
    description: 'Price for hot version of the beverage',
    example: 3.99,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  hot_price?: number;

  @ApiPropertyOptional({
    description: 'Price for iced version of the beverage',
    example: 4.49,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  ice_price?: number;

  @ApiProperty({
    description: 'Category ID for the beverage',
    example: 2,
  })
  @IsInt()
  @IsNotEmpty()
  category_id: number;

  @ApiPropertyOptional({
    description: 'Image URL for the beverage',
    example: 'https://res.cloudinary.com/your-cloud/image/upload/thai-tea.jpg',
  })
  @IsUrl()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({
    description: 'Status of the beverage',
    example: 'active',
    default: 'active',
  })
  @IsString()
  @IsOptional()
  status?: string;
}
