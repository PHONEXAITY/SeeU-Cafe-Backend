import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFoodMenuDto } from './dto/create-food-menu.dto';
import { UpdateFoodMenuDto } from './dto/update-food-menu.dto';
import { FoodMenu } from '@prisma/client';

@Injectable()
export class FoodMenuService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createFoodMenuDto: CreateFoodMenuDto) {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id: createFoodMenuDto.category_id },
    });

    if (!category) {
      throw new NotFoundException(
        `Category with ID ${createFoodMenuDto.category_id} not found`,
      );
    }

    const newFoodMenu = await this.prisma.foodMenu.create({
      data: createFoodMenuDto,
    });

    await this.cacheManager.del('food_menu_all');
    await this.cacheManager.del(
      `food_menu_category_${createFoodMenuDto.category_id}`,
    );

    return newFoodMenu;
  }

  async findAll(categoryId?: number, status?: string) {
    let cacheKey = 'food_menu_all';
    if (categoryId) {
      cacheKey = `food_menu_category_${categoryId}`;
    }
    if (status) {
      cacheKey += `_status_${status}`;
    }

    const cachedData = await this.cacheManager.get<FoodMenu[]>(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const where: any = {};

    if (categoryId) {
      where.category_id = categoryId;
    }

    if (status) {
      where.status = status;
    }

    const foodMenus = await this.prisma.foodMenu.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    await this.cacheManager.set(cacheKey, foodMenus);

    return foodMenus;
  }

  async findOne(id: number) {
    const cacheKey = `food_menu_${id}`;
    const cachedData = await this.cacheManager.get<
      FoodMenu & { category: { id: number; name: string } }
    >(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const foodMenu = await this.prisma.foodMenu.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!foodMenu) {
      throw new NotFoundException(`Food menu item with ID ${id} not found`);
    }

    await this.cacheManager.set(cacheKey, foodMenu);

    return foodMenu;
  }

  async update(id: number, updateFoodMenuDto: UpdateFoodMenuDto) {
    const existingMenu = await this.prisma.foodMenu.findUnique({
      where: { id },
      select: { category_id: true },
    });

    if (!existingMenu) {
      throw new NotFoundException(`Food menu item with ID ${id} not found`);
    }

    if (updateFoodMenuDto.category_id) {
      const category = await this.prisma.menuCategory.findUnique({
        where: { id: updateFoodMenuDto.category_id },
      });

      if (!category) {
        throw new NotFoundException(
          `Category with ID ${updateFoodMenuDto.category_id} not found`,
        );
      }
    }

    const updatedMenu = await this.prisma.foodMenu.update({
      where: { id },
      data: updateFoodMenuDto,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await this.cacheManager.del(`food_menu_${id}`);
    await this.cacheManager.del('food_menu_all');

    await this.cacheManager.del(
      `food_menu_category_${existingMenu.category_id}`,
    );

    if (
      updateFoodMenuDto.category_id &&
      updateFoodMenuDto.category_id !== existingMenu.category_id
    ) {
      await this.cacheManager.del(
        `food_menu_category_${updateFoodMenuDto.category_id}`,
      );
    }

    return updatedMenu;
  }

  async remove(id: number) {
    const foodMenu = await this.prisma.foodMenu.findUnique({
      where: { id },
      select: { category_id: true },
    });

    if (!foodMenu) {
      throw new NotFoundException(`Food menu item with ID ${id} not found`);
    }

    await this.prisma.foodMenu.delete({
      where: { id },
    });

    await this.cacheManager.del(`food_menu_${id}`);
    await this.cacheManager.del('food_menu_all');
    await this.cacheManager.del(`food_menu_category_${foodMenu.category_id}`);

    return { message: 'Food menu item deleted successfully' };
  }
}
