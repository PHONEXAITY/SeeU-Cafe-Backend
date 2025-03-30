import { PartialType } from '@nestjs/swagger';
import { CreateFoodMenuDto } from './create-food-menu.dto';

export class UpdateFoodMenuDto extends PartialType(CreateFoodMenuDto) {}
