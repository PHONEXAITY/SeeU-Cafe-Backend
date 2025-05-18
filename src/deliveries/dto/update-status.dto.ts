import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { DeliveryStatus } from '../enums/delivery-status.enum';

export class UpdateStatusDto {
  @ApiProperty({
    description: 'New status of the delivery',
    enum: DeliveryStatus,
    example: DeliveryStatus.PREPARING,
  })
  @IsEnum(DeliveryStatus, {
    message: `Status must be one of: ${Object.values(DeliveryStatus).join(', ')}`,
  })
  status: DeliveryStatus;

  @ApiPropertyOptional({
    description: 'Optional notes for the status update',
    example: 'Order is being prepared by kitchen staff',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Notes cannot exceed 500 characters' })
  @Transform(({ value }: { value: string }) => (value ? value.trim() : value))
  notes?: string;
}
