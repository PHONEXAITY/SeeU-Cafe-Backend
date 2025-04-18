import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTableTimeDto {
  @ApiProperty({
    description: 'Expected end time for table session',
    example: '2023-05-20T20:00:00Z',
  })
  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  expectedEndTime: Date;

  @ApiPropertyOptional({
    description: 'Whether to notify customers with active orders at this table',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  notifyCustomers?: boolean;

  @ApiPropertyOptional({
    description: 'Custom notification message to send to customers',
    example: 'Your table reservation has been extended by 30 minutes',
  })
  @IsOptional()
  @IsString()
  notificationMessage?: string;
}
