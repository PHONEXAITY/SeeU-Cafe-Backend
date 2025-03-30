import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsInt, IsUrl } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({
    description: 'ID of the user the document belongs to',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  user_id: number;

  @ApiProperty({
    description: 'Type of document',
    example: 'ID Card',
  })
  @IsString()
  @IsNotEmpty()
  document_type: string;

  @ApiProperty({
    description: 'File path or URL to the document',
    example: 'https://res.cloudinary.com/your-cloud/image/upload/id-card.jpg',
  })
  @IsUrl()
  @IsNotEmpty()
  file_path: string;
}
