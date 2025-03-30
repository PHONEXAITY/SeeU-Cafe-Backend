import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsUrl,
  IsIn,
} from 'class-validator';

export class CreateMenuCategoryDto {
  @ApiProperty({
    description: 'The name of the menu category',
    example: 'Hot Drinks',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the menu category',
    example: 'All hot beverages including coffee and tea',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Image URL for the menu category',
    example:
      'https://res.cloudinary.com/your-cloud/image/upload/hot-drinks.jpg',
  })
  @IsUrl()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({
    description: 'Parent category ID for nested categories',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  parent_id?: number;

  @ApiPropertyOptional({
    description: 'Status of the menu category',
    example: 'active',
    default: 'active',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({
    description: 'Type of the category (food or beverage)',
    example: 'food',
    enum: ['food', 'beverage'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['food', 'beverage'])
  type: string;
}
