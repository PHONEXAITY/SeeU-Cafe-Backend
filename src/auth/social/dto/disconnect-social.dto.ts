import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum SocialProvider {
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
}

export class DisconnectSocialDto {
  @ApiProperty({
    description: 'Social provider name',
    example: 'google',
    enum: SocialProvider,
  })
  @IsNotEmpty()
  @IsString()
  @IsEnum(SocialProvider)
  provider: SocialProvider;
}
