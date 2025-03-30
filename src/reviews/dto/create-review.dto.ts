import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CreateReviewDto {
  @ApiProperty({
    description: 'ID of the user submitting the review',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  user_id: number;

  @ApiProperty({
    description: 'Rating from 1 to 5',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsNotEmpty()
  rating: number;

  @ApiPropertyOptional({
    description: 'Comment or feedback',
    example: 'Great service and delicious coffee!',
  })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({
    description: 'Status of the review',
    example: 'pending',
    default: 'pending',
  })
  @IsString()
  @IsOptional()
  status?: string;
}
