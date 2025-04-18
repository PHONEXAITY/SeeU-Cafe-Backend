import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsNumber,
  IsUrl,
  IsDateString,
  IsEnum,
  Min,
  Matches,
} from 'class-validator';

enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other',
}

enum Status {
  ACTIVE = 'active',
  LEAVE = 'leave',
  INACTIVE = 'inactive',
}

export class UpdateEmployeeDto {
  @ApiPropertyOptional({
    description: 'First name of the employee',
    example: 'John',
  })
  @IsString()
  @IsOptional()
  first_name?: string;

  @ApiPropertyOptional({
    description: 'Last name of the employee',
    example: 'Doe',
  })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Email of the employee',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number of the employee',
    example: '0201234567',
  })
  @Matches(/^[0-9]{10,12}$/, {
    message: 'Phone must be a valid number with 10-12 digits',
  })
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Address of the employee',
    example: '123 Main St, Bangkok, Thailand',
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    description: 'Position of the employee',
    example: 'manager',
  })
  @IsString()
  @IsOptional()
  position?: string;

  @ApiPropertyOptional({
    description: 'Status of the employee',
    enum: Status,
    example: Status.ACTIVE,
  })
  @IsEnum(Status)
  @IsOptional()
  status?: string;

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
    example: 'https://example.com/photo.jpg',
  })
  @IsUrl({ require_protocol: true })
  @IsOptional()
  profile_photo?: string;

  @ApiPropertyOptional({
    description: 'Documents data (should be handled via separate API)',
    example: null,
  })
  @IsOptional()
  documents?: any;

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
