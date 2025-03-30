import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsArray,
  IsUrl,
  IsOptional,
  IsEnum,
  Matches,
} from 'class-validator';

enum BlogStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export class CreateBlogDto {
  @ApiProperty({
    description: 'Title of the blog post',
    example: 'Coffee Brewing Techniques',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Content of the blog post',
    example: 'Lorem ipsum dolor sit amet...',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: 'Author of the blog post',
    example: 'John Doe',
  })
  @IsString()
  @IsOptional()
  author?: string;

  @ApiPropertyOptional({
    description: 'Image URL for the blog post',
    example:
      'https://res.cloudinary.com/your-cloud/image/upload/blog-image.jpg',
  })
  @IsUrl()
  @IsOptional()
  image?: string;

  @ApiPropertyOptional({
    description: 'Status of the blog post',
    enum: BlogStatus,
    example: BlogStatus.DRAFT,
    default: BlogStatus.DRAFT,
  })
  @IsEnum(BlogStatus)
  @IsOptional()
  status?: string;

  @ApiProperty({
    description: 'URL-friendly slug for the blog post',
    example: 'coffee-brewing-techniques',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must contain only lowercase letters, numbers, and hyphens',
  })
  slug: string;

  @ApiPropertyOptional({
    description: 'IDs of blog categories to assign to the post',
    type: [Number],
    example: [1, 2],
  })
  @IsArray()
  @IsOptional()
  categories?: number[];
}
