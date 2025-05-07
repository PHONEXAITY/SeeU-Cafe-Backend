import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class EmailVerificationDto {
  @ApiProperty({
    description: 'Email address to verify',
    example: 'user@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Verification code (OTP)',
    example: '123456',
  })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  code: string;
}
