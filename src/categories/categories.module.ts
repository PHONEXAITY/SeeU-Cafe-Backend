import { Module } from '@nestjs/common';
import { MenuCategoriesService } from './menu-categories/menu-categories.service';
import { MenuCategoriesController } from './menu-categories/menu-categories.controller';
import { BlogCategoriesService } from './blog-categories/blog-categories.service';
import { BlogCategoriesController } from './blog-categories/blog-categories.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [MenuCategoriesController, BlogCategoriesController],
  providers: [MenuCategoriesService, BlogCategoriesService],
  exports: [MenuCategoriesService, BlogCategoriesService],
})
export class CategoriesModule {}
