import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsString,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateLocationDto {
  @ApiProperty({
    description: 'Latitude coordinate',
    example: 13.7563,
    minimum: -90,
    maximum: 90,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  latitude: number;

  @ApiProperty({
    description: 'Longitude coordinate',
    example: 100.5018,
    minimum: -180,
    maximum: 180,
  })
  @IsNotEmpty()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  longitude: number;

  @ApiPropertyOptional({
    description: 'Additional location information or landmark',
    example: 'Near Victory Monument, on Phayathai Road',
  })
  @IsOptional()
  @IsString()
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
