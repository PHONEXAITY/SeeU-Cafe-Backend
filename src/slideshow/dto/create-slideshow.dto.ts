import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUrl,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';

export class CreateSlideshowDto {
  @ApiProperty({
    description: 'Title of the slideshow item',
    example: 'Summer Promotion',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Image URL for the slideshow',
    example: 'https://res.cloudinary.com/your-cloud/image/upload/slide1.jpg',
  })
  @IsUrl()
  @IsNotEmpty()
  image: string;

  @ApiPropertyOptional({
    description: 'Link URL when the slide is clicked',
    example: 'https://seeu.cafe/promotions/summer',
  })
  @IsUrl()
  @IsOptional()
  link?: string;

  @ApiPropertyOptional({
    description: 'Display order of the slide (lower numbers appear first)',
    example: 1,
    default: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({
    description: 'Status of the slide',
    example: 'active',
    default: 'active',
  })
  @IsString()
  @IsOptional()
  status?: string;
}
