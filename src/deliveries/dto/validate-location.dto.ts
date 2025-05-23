import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ValidateLocationDto {
  @ApiProperty({
    description: 'Latitude coordinate',
    example: 19.8845,
    minimum: -90,
    maximum: 90,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  @Type(() => Number)
  latitude: number;

  @ApiProperty({
    description: 'Longitude coordinate',
    example: 102.135,
    minimum: -180,
    maximum: 180,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  @Type(() => Number)
  longitude: number;

  @ApiPropertyOptional({
    description: 'GPS accuracy in meters (optional)',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  accuracy?: number;

  @ApiPropertyOptional({
    description: 'Additional address information',
    example: 'ข้างวัดซังทอง, ถนนสีสะหวันวงศ์',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: string }) => (value ? value.trim() : value))
  address?: string;
}
