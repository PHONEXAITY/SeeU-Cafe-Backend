import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsInt,
  IsUrl,
  ValidateIf,
  IsNotEmpty,
} from 'class-validator';

export class UpdateBeverageMenuDto {
  @ApiPropertyOptional({
    description: 'The name of the beverage',
    example: 'Thai Iced Tea',
  })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.name !== undefined)
  @IsNotEmpty({ message: 'Name cannot be empty when provided' })
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
  @IsOptional()
  @ValidateIf((o) => o.price !== null && o.price !== undefined)
  @IsNumber({}, { message: 'Price must be a valid number' })
  @Min(0, { message: 'Price must be 0 or greater' })
  price?: number | null;

  @ApiPropertyOptional({
    description: 'Price for hot version of the beverage (can be null)',
    example: 3.99,
    minimum: 0,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => o.hot_price !== null && o.hot_price !== undefined)
  @IsNumber({}, { message: 'Hot price must be a valid number' })
  @Min(0, { message: 'Hot price must be 0 or greater' })
  hot_price?: number | null;

  @ApiPropertyOptional({
    description: 'Price for iced version of the beverage (can be null)',
    example: 4.49,
    minimum: 0,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => o.ice_price !== null && o.ice_price !== undefined)
  @IsNumber({}, { message: 'Ice price must be a valid number' })
  @Min(0, { message: 'Ice price must be 0 or greater' })
  ice_price?: number | null;

  @ApiPropertyOptional({
    description: 'Category ID for the beverage',
    example: 2,
  })
  @IsOptional()
  @IsInt({ message: 'Category ID must be an integer' })
  @Min(1, { message: 'Category ID must be greater than 0' })
  category_id?: number;

  @ApiPropertyOptional({
    description: 'Image URL for the beverage',
    example: 'https://res.cloudinary.com/your-cloud/image/upload/thai-tea.jpg',
  })
  @IsOptional()
  @IsUrl({}, { message: 'Image must be a valid URL' })
  image?: string;

  @ApiPropertyOptional({
    description: 'Status of the beverage',
    example: 'active',
    enum: ['active', 'inactive'],
  })
  @IsString()
  @IsOptional()
  status?: string;
}
