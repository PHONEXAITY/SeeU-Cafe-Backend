import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateDeliveryDto } from './create-delivery.dto';

export class UpdateDeliveryDto extends PartialType(
  OmitType(CreateDeliveryDto, ['order_id'] as const),
) {}
