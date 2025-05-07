import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class FacebookAuthDto {
  @ApiProperty({
    description: 'Facebook access token',
    example: 'EAABZAn0ZBZCmwBAHMQ2y9L4W8...',
  })
  @IsNotEmpty()
  @IsString()
  token: string;
}
