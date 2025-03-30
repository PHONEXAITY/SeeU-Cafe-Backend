import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsNumber,
  IsDate,
  IsOptional,
  /*  IsArray, */
  Min,
  IsInt,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export class CreatePromotionDto {
  @ApiProperty({
    description: 'Name of the promotion',
    example: 'Summer Sale',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Unique code for the promotion',
    example: 'SUMMER2023',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9_-]+$/, {
    message:
      'Code must contain only uppercase letters, numbers, underscores, and hyphens',
  })
  code: string;

  @ApiProperty({
    description: 'Type of discount',
    enum: DiscountType,
    example: DiscountType.PERCENTAGE,
  })
  @IsEnum(DiscountType)
  @IsNotEmpty()
  discount_type: string;

  @ApiProperty({
    description: 'Value of the discount (percentage or fixed amount)',
    example: 15,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  discount_value: number;

  @ApiProperty({
    description: 'Start date of the promotion',
    example: '2023-01-01T00:00:00Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  start_date: Date;

  @ApiProperty({
    description: 'End date of the promotion',
    example: '2023-12-31T23:59:59Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  end_date: Date;

  @ApiPropertyOptional({
    description: 'Minimum order amount to apply the promotion',
    example: 50,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  minimum_order?: number;

  @ApiPropertyOptional({
    description: 'Maximum discount amount (for percentage discounts)',
    example: 100,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maximum_discount?: number;

  @ApiPropertyOptional({
    description: 'Description of the promotion',
    example: 'Get 15% off on all orders during summer!',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Status of the promotion',
    example: 'active',
    default: 'active',
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of times the promotion can be used',
    example: 1000,
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  usage_limit?: number;

  @ApiPropertyOptional({
    description: 'Product categories the promotion applies to',
    example: 'hot_drinks,cold_drinks',
  })
  @IsString()
  @IsOptional()
  product_categories?: string;
}
