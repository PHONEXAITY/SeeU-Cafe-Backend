import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsInt,
  IsUrl,
} from 'class-validator';

export class UpdateBeverageMenuDto {
  @ApiPropertyOptional({
    description: 'The name of the beverage',
    example: 'Thai Iced Tea',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Description of the beverage',
    example: 'Traditional Thai tea with milk and sugar, served over ice',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Regular price of the beverage (can be null for beverages)',
    example: 3.99,
    minimum: 0,
    nullable: true,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number | null;

  @ApiPropertyOptional({
    description: 'Price for hot version of the beverage (can be null)',
    example: 3.99,
    minimum: 0,
    nullable: true,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  hot_price?: number | null;

  @ApiPropertyOptional({
    description: 'Price for iced version of the beverage (can be null)',
    example: 4.49,
    minimum: 0,
    nullable: true,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  ice_price?: number | null;

  @ApiPropertyOptional({
    description: 'Category ID for the beverage',
    example: 2,
  })
  @IsInt()
  @IsOptional()
  category_id?: number;

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
  })
  @IsString()
  @IsOptional()
  status?: string;
}
