import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DeliveryStatus } from '../enums/delivery-status.enum';

export class UpdateStatusDto {
  @ApiProperty({
    description: 'New status of the delivery',
    enum: DeliveryStatus,
    example: DeliveryStatus.PREPARING,
  })
  @IsEnum(DeliveryStatus, {
    message: `Status must be one of ${Object.values(DeliveryStatus).join(', ')}`,
  })
  status: DeliveryStatus;

  @ApiPropertyOptional({
    description: 'Optional notes for the status update',
    example: 'Order is being prepared',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
