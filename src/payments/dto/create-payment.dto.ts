import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsEnum,
  Min,
  IsInt,
  IsOptional,
  IsDateString,
} from 'class-validator';

enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  MOBILE_PAYMENT = 'mobile_payment',
  BANK_TRANSFER = 'bank_transfer',
  OTHER = 'other',
}

enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

export class CreatePaymentDto {
  @ApiProperty({
    description: 'ID of the order being paid for',
    example: 1,
  })
  @IsInt()
  @IsNotEmpty()
  order_id: number;

  @ApiProperty({
    description: 'Amount being paid',
    example: 29.99,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethod,
    example: PaymentMethod.CREDIT_CARD,
  })
  @IsString()
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  method: string;

  @ApiPropertyOptional({
    description: 'Payment date',
    example: '2023-01-01T12:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  payment_date?: string;

  @ApiPropertyOptional({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.COMPLETED,
    default: PaymentStatus.PENDING,
  })
  @IsString()
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: 'Delivery ID associated with the payment',
    example: 1,
  })
  @IsInt()
  @IsOptional()
  delivery_id?: number;
}
