import { PartialType } from '@nestjs/swagger';
import { CreateOrderDetailDto } from './create-order-detail.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional } from 'class-validator';

export class UpdateOrderDetailDto extends PartialType(CreateOrderDetailDto) {
  @ApiProperty({
    description: 'ID of the order detail (required for batch updates)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @IsInt()
  id?: number;
}
