import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CreateGalleryUploadDto {
  @ApiPropertyOptional({
    description: 'Title of the gallery image',
    example: 'Coffee Shop Interior',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Category of the image',
    example: 'Interior',
  })
  @IsString()
  @IsOptional()
  category?: string;
}
