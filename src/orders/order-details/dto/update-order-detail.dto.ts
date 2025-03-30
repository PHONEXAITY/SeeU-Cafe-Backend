import { ApiProperty, PartialType } from '@nestjs/swagger';
import { CreateOrderDetailDto } from './create-order-detail.dto';
import { IsInt, IsOptional } from 'class-validator';

export class UpdateOrderDetailDto extends PartialType(CreateOrderDetailDto) {
  @ApiProperty({
    description: 'ID of the order detail to update',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  id?: number;
}
