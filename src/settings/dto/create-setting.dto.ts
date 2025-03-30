import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateSettingDto {
  @ApiProperty({
    description: 'Key for the setting',
    example: 'site_title',
  })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({
    description: 'Value for the setting',
    example: 'SeeU Cafe',
  })
  @IsString()
  @IsNotEmpty()
  value: string;
}
