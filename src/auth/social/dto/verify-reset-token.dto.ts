import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyResetTokenDto {
  @ApiProperty({
    description: 'Password reset token',
    example: 'abcd1234efgh5678',
  })
  @IsNotEmpty()
  @IsString()
  token: string;
}
