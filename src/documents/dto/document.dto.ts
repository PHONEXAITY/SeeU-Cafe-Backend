import { ApiProperty } from '@nestjs/swagger';

export class DocumentDto {
  @ApiProperty({
    example: 1,
    description: 'The ID of the document',
  })
  id: number;

  @ApiProperty({
    example: null,
    description: 'The associated user ID',
    nullable: true,
  })
  user_id: number | null;

  @ApiProperty({
    example: 1,
    description: 'The associated employee ID',
    nullable: true,
  })
  employee_id: number | null;

  @ApiProperty({
    example: 'id_card',
    description: 'The type of document',
  })
  document_type: string;

  @ApiProperty({
    example: 'https://example.com/file.pdf',
    description: 'The file URL',
  })
  file_path: string;

  @ApiProperty({
    example: '2025-04-04T12:00:00Z',
    description: 'Upload date',
  })
  uploaded_at: Date;
}
