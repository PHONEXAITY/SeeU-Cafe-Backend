import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class SplitBillItemDto {
  @ApiProperty({
    description: 'Table ID',
    example: 1,
  })
  @IsNumber()
  table_id: number;

  @ApiProperty({
    description: 'Amount to pay for this table',
    example: 500.0,
  })
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: 'Payment method for this table',
    example: 'cash',
    required: false,
  })
  @IsOptional()
  payment_method?: string;
}

export class SplitBillDto {
  @ApiProperty({
    description: 'Array of payment splits by table',
    type: [SplitBillItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitBillItemDto)
  splits: SplitBillItemDto[];

  @ApiProperty({
    description: 'Special notes for the split payment',
    example: 'Split payment for tables 1-3',
    required: false,
  })
  @IsOptional()
  notes?: string;
}
