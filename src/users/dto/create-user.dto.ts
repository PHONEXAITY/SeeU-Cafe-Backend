// src/users/dto/create-user.dto.ts (Updated)
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'อีเมลของผู้ใช้',
    example: 'john@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'รหัสผ่านของผู้ใช้',
    example: 'Password123!',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(30)
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'รหัสผ่านอ่อนเกินไป',
  })
  password: string;

  @ApiPropertyOptional({
    description: 'ชื่อของผู้ใช้',
    example: 'John',
  })
  @IsString()
  @IsOptional()
  first_name?: string;

  @ApiPropertyOptional({
    description: 'นามสกุลของผู้ใช้',
    example: 'Doe',
  })
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiPropertyOptional({
    description: 'เบอร์โทรศัพท์ของผู้ใช้',
    example: '+1234567890',
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'ที่อยู่ของผู้ใช้',
    example: '123 Main St, City, Country',
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    description: 'รูปโปรไฟล์ URL',
    example: 'https://example.com/photo.jpg',
  })
  @IsString()
  @IsOptional()
  profile_photo?: string;

  @ApiPropertyOptional({
    description: 'ID ของบทบาท',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  role_id?: number;
}
