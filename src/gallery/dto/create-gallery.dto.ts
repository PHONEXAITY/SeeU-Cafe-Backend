import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl, IsOptional } from 'class-validator';

export class CreateGalleryDto {
  @ApiPropertyOptional({
    description: 'Title of the gallery image',
    example: 'Coffee Shop Interior',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Image URL',
    example: 'https://res.cloudinary.com/your-cloud/image/upload/gallery1.jpg',
  })
  @IsUrl()
  @IsNotEmpty()
  image: string;

  @ApiPropertyOptional({
    description: 'Category of the image',
    example: 'Interior',
  })
  @IsString()
  @IsOptional()
  category?: string;
}
