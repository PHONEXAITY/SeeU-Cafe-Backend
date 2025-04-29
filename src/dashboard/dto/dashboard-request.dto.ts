import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetDashboardStatsDto {
  @ApiProperty({ required: false, description: 'Start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  dateStart?: string;

  @ApiProperty({ required: false, description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  dateEnd?: string;

  @ApiProperty({
    required: false,
    enum: ['today', 'week', 'month', 'year'],
    default: 'today',
  })
  @IsOptional()
  @IsEnum(['today', 'week', 'month', 'year'])
  timeRange?: string = 'today';
}

export class GetSalesAnalyticsDto {
  @ApiProperty({
    required: false,
    enum: ['today', 'week', 'month', 'year'],
    default: 'today',
  })
  @IsOptional()
  @IsEnum(['today', 'week', 'month', 'year'])
  timeRange?: string = 'today';
}

export class GetTrendingProductsDto {
  @ApiProperty({
    required: false,
    description: 'Product category (coffee, food, etc.)',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    required: false,
    description: 'Number of products to return',
    default: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 5;
}

export class GetRevenueChartDto {
  @ApiProperty({
    required: false,
    enum: ['daily', 'weekly', 'monthly', 'yearly'],
    default: 'monthly',
  })
  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly', 'yearly'])
  period?: string = 'monthly';
}

export class GetCustomerMapDto {
  @ApiProperty({
    required: false,
    enum: ['daily', 'weekly', 'monthly'],
    default: 'monthly',
  })
  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly'])
  period?: string = 'monthly';
}

export class GetRecentOrdersDto {
  @ApiProperty({
    required: false,
    description: 'Number of orders to return',
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;
}
