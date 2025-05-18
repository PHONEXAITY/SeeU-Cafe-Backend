import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsInt,
  IsDateString,
  IsString,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { DeliveryStatus } from '../enums/delivery-status.enum';

export class QueryDeliveryDto {
  @ApiPropertyOptional({
    description: 'Filter by delivery status',
    enum: DeliveryStatus,
  })
  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;

  @ApiPropertyOptional({
    description: 'Filter by employee ID',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  employeeId?: number;

  @ApiPropertyOptional({
    description: 'Search in delivery address or customer details',
    example: 'Vientiane',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => (value ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter from date (ISO 8601)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  from_date?: string;

  @ApiPropertyOptional({
    description: 'Filter to date (ISO 8601)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  to_date?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  limit?: number;
}
