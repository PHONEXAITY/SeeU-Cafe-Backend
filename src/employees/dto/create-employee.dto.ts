import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsPhoneNumber,
  IsOptional,
  IsNumber,
  IsUrl,
  IsDateString,
  IsEnum,
  Min,
} from 'class-validator';

enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

export class CreateEmployeeDto {
  @ApiProperty({
    description: 'First name of the employee',
    example: 'John',
  })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({
    description: 'Last name of the employee',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({
    description: 'Email of the employee',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    description: 'Phone number of the employee',
    example: '+66123456789',
  })
  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Address of the employee',
    example: '123 Main St, Bangkok, Thailand',
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({
    description: 'Position of the employee',
    example: 'Barista',
  })
  @IsString()
  @IsNotEmpty()
  position: string;

  @ApiPropertyOptional({
    description: 'Salary of the employee',
    example: 15000,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  salary?: number;

  @ApiPropertyOptional({
    description: 'Profile photo URL of the employee',
    example:
      'https://res.cloudinary.com/your-cloud/image/upload/employee-photo.jpg',
  })
  @IsUrl()
  @IsOptional()
  profile_photo?: string;

  @ApiPropertyOptional({
    description: 'Document IDs or URLs of the employee (JSON string)',
    example: '{"id_card": "url1", "work_permit": "url2"}',
  })
  @IsString()
  @IsOptional()
  documents?: string;

  @ApiPropertyOptional({
    description: 'Date of birth of the employee',
    example: '1990-01-01',
  })
  @IsDateString()
  @IsOptional()
  date_of_birth?: string;

  @ApiPropertyOptional({
    description: 'Gender of the employee',
    enum: Gender,
    example: Gender.MALE,
  })
  @IsEnum(Gender)
  @IsOptional()
  gender?: string;
}
