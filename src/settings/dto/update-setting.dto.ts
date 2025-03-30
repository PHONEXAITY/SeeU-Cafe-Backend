import { PartialType } from '@nestjs/swagger';
import { CreateSettingDto } from './create-setting.dto';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSettingDto extends PartialType(CreateSettingDto) {
  @ApiProperty({
    description: 'Value for the setting',
    example: 'SeeU Cafe - Coffee & Bakery',
  })
  @IsString()
  @IsNotEmpty()
  value: string;
}
