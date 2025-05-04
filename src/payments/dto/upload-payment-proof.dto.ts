// src/payments/dto/upload-payment-proof.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty } from 'class-validator';

export class UploadPaymentProofDto {
  @ApiProperty({
    description: 'ID of the payment to attach proof to',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  payment_id: number;
}
