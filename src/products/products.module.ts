import { Module } from '@nestjs/common';
import { FoodMenuService } from './food-menu/food-menu.service';
import { BeverageMenuService } from './beverage-menu/beverage-menu.service';
import { FoodMenuController } from './food-menu/food-menu.controller';
import { BeverageMenuController } from './beverage-menu/beverage-menu.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [FoodMenuController, BeverageMenuController],
  providers: [FoodMenuService, BeverageMenuService],
  exports: [FoodMenuService, BeverageMenuService],
})
export class ProductsModule {}
