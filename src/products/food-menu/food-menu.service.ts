import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFoodMenuDto } from './dto/create-food-menu.dto';
import { UpdateFoodMenuDto } from './dto/update-food-menu.dto';

@Injectable()
export class FoodMenuService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createFoodMenuDto: CreateFoodMenuDto) {
    // Verify category exists
    const category = await this.prisma.menuCategory.findUnique({
      where: { id: createFoodMenuDto.category_id },
    });

    if (!category) {
      throw new NotFoundException(
        `Category with ID ${createFoodMenuDto.category_id} not found`,
      );
    }

    return this.prisma.foodMenu.create({
      data: createFoodMenuDto,
    });
  }

  async findAll(categoryId?: number, status?: string) {
    const where: any = {};

    if (categoryId) {
      where.category_id = categoryId;
    }

    if (status) {
      where.status = status;
    }

    return this.prisma.foodMenu.findMany({
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
  }

  async findOne(id: number) {
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

    return foodMenu;
  }

  async update(id: number, updateFoodMenuDto: UpdateFoodMenuDto) {
    // Check if food menu item exists
    await this.findOne(id);

    // If category is being updated, verify the new category exists
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

    return this.prisma.foodMenu.update({
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
  }

  async remove(id: number) {
    // Check if food menu item exists
    await this.findOne(id);

    await this.prisma.foodMenu.delete({
      where: { id },
    });

    return { message: 'Food menu item deleted successfully' };
  }
}
