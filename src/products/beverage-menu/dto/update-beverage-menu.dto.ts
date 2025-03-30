import { PartialType } from '@nestjs/swagger';
import { CreateBeverageMenuDto } from './create-beverage-menu.dto';

export class UpdateBeverageMenuDto extends PartialType(CreateBeverageMenuDto) {}
