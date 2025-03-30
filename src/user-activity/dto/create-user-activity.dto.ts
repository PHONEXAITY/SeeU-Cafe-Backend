import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, IsOptional } from 'class-validator';

export class CreateUserActivityDto {
  @ApiProperty({
    description: 'ID of the user',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  user_id: number;

  @ApiProperty({
    description: 'Type of activity',
    example: 'login',
  })
  @IsString()
  @IsNotEmpty()
  activity_type: string;

  @ApiPropertyOptional({
    description: 'Description of the activity',
    example: 'User logged in successfully',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'IP address of the user',
    example: '192.168.1.1',
  })
  @IsString()
  @IsOptional()
  ip_address?: string;

  @ApiPropertyOptional({
    description: 'User agent information',
    example: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  })
  @IsString()
  @IsOptional()
  user_agent?: string;
}
