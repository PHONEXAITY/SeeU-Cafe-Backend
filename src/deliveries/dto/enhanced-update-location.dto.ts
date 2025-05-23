import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateLocationDto } from './update-location.dto';
export class EnhancedUpdateLocationDto extends UpdateLocationDto {
  @ApiPropertyOptional({
    description: 'GPS accuracy in meters',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  gpsAccuracy?: number;

  @ApiPropertyOptional({
    description: 'Force location update even if GPS is not accurate',
    example: false,
    default: false,
  })
  @IsOptional()
  forceUpdate?: boolean;
}
