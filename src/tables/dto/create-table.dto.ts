import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsInt, IsString, IsOptional, Min } from 'class-validator';

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
  })
  @IsString()
  @IsOptional()
  status?: string;
}
