import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';

export class CreateSlideshowDto {
  @ApiProperty({ description: 'Slide title' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Slide subtitle', required: false })
  @IsString()
  @IsOptional()
  subtitle?: string;

  @ApiProperty({
    description: 'Image URL (will be populated from upload)',
    required: false,
  })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({ description: 'Link URL', required: false })
  @IsString()
  @IsOptional()
  link?: string;

  @ApiProperty({ description: 'Display order', required: false, default: 0 })
  @IsNumber()
  @IsOptional()
  order?: number;

  @ApiProperty({
    description: 'Slide status',
    enum: ['active', 'inactive', 'scheduled'],
    default: 'active',
  })
  @IsEnum(['active', 'inactive', 'scheduled'])
  @IsOptional()
  status?: string;

  @ApiProperty({ description: 'Button text', required: false })
  @IsString()
  @IsOptional()
  buttonText?: string;

  @ApiProperty({ description: 'Button link URL', required: false })
  @IsString()
  @IsOptional()
  buttonLink?: string;

  @ApiProperty({
    description: 'Button target',
    enum: ['_self', '_blank'],
    default: '_self',
    required: false,
  })
  @IsEnum(['_self', '_blank'])
  @IsOptional()
  buttonTarget?: string;

  @ApiProperty({
    description: 'Start date for scheduled slides',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  startDate?: Date | string;

  @ApiProperty({
    description: 'End date for scheduled slides',
    required: false,
  })
  @IsDateString()
  @IsOptional()
  endDate?: Date | string;
}
