import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class UpdateLocationDto {
  @ApiProperty({
    description: 'Latitude coordinate',
    example: 17.9757,
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
    example: 102.6331,
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
    description: 'Additional location information or landmark',
    example: 'Near Victory Monument, in front of the bank',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: string }) => (value ? value.trim() : value))
  locationNote?: string;

  @ApiPropertyOptional({
    description: 'Whether to notify the customer about the location update',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  notifyCustomer?: boolean;
}
