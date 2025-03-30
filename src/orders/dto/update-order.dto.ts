import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateOrderDto } from './create-order.dto';
import { IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateOrderDetailDto } from '../order-details/dto/update-order-detail.dto';

export class UpdateOrderDto extends PartialType(
  OmitType(CreateOrderDto, ['order_details'] as const),
) {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderDetailDto)
  @IsOptional()
  order_details?: UpdateOrderDetailDto[];
}
