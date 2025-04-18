import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsInt,
  IsString,
  IsOptional,
  Min,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTableDto {
  @ApiProperty({
    description: 'Unique table number',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  number: number;

  @ApiProperty({
    description: 'Table capacity (number of seats)',
    example: 4,
  })
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  capacity: number;

  @ApiPropertyOptional({
    description: 'Table status',
    example: 'available',
    default: 'available',
    enum: ['available', 'reserved', 'occupied', 'maintenance'],
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Current session start time (for occupied tables)',
    example: '2023-05-20T18:00:00Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  current_session_start?: Date;

  @ApiPropertyOptional({
    description: 'Expected end time for current session',
    example: '2023-05-20T20:00:00Z',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expected_end_time?: Date;
}
