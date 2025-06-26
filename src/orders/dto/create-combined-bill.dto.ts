import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  ArrayMinSize,
} from 'class-validator';

export class CreateCombinedBillDto {
  @ApiProperty({
    description: 'Array of table IDs to combine in one bill',
    example: [1, 2, 3],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(2, {
    message: 'At least 2 tables are required for combined billing',
  })
  @IsInt({ each: true })
  @IsNotEmpty()
  table_ids: number[];

  @ApiProperty({
    description: 'Payment method for the combined bill',
    example: 'cash',
    required: false,
  })
  @IsOptional()
  @IsString()
  payment_method?: string;

  @ApiProperty({
    description: 'Special notes for the combined bill',
    example: 'Company dinner - split equally',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Customer name for the combined bill',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  customer_name?: string;
}
