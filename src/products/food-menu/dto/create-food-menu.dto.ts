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

export class CreateFoodMenuDto {
  @ApiProperty({
    description: 'The name of the food item',
    example: 'Pad Thai',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the food item',
    example:
      'Traditional Thai stir-fried noodle dish with tofu, eggs, and peanuts',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Price of the food item',
    example: 9.99,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  price: number;

  @ApiProperty({
    description: 'Category ID for the food item',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  category_id: number;

  @ApiPropertyOptional({
    description: 'Image URL for the food item',
    example: 'https://res.cloudinary.com/your-cloud/image/upload/pad-thai.jpg',
  })
  @IsUrl()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({
    description: 'Status of the food item',
    example: 'active',
    default: 'active',
  })
  @IsString()
  @IsOptional()
  status?: string;
}
