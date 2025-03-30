import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';

@Injectable()
export class MenuCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createMenuCategoryDto: CreateMenuCategoryDto) {
    // If parent_id is provided, verify it exists
    if (createMenuCategoryDto.parent_id) {
      const parentCategory = await this.prisma.menuCategory.findUnique({
        where: { id: createMenuCategoryDto.parent_id },
      });

      if (!parentCategory) {
        throw new NotFoundException(
          `Parent category with ID ${createMenuCategoryDto.parent_id} not found`,
        );
      }
    }

    // Generate a unique category_id
    const categoryId = BigInt(Date.now());

    const menuCategory = await this.prisma.menuCategory.create({
      data: {
        ...createMenuCategoryDto,
        category_id: categoryId,
      },
    });

    // แปลง category_id เป็น string
    return {
      ...menuCategory,
      category_id: menuCategory.category_id.toString(),
    };
  }

  async findAll(type?: string) {
    const where = type ? { type } : {};

    const categories = await this.prisma.menuCategory.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

    // แปลง category_id เป็น string ในทุก object
    return categories.map((category) => ({
      ...category,
      category_id: category.category_id.toString(),
    }));
  }

  async findOne(id: number) {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id },
      include: {
        foodMenus: true,
        beverageMenus: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Menu category with ID ${id} not found`);
    }

    // แปลง category_id เป็น string
    return {
      ...category,
      category_id: category.category_id.toString(),
    };
  }

  async update(id: number, updateMenuCategoryDto: UpdateMenuCategoryDto) {
    // Check if category exists
    await this.findOne(id);

    // If parent_id is being updated, verify the new parent exists
    if (updateMenuCategoryDto.parent_id) {
      // Check for circular reference (category can't be its own parent)
      if (updateMenuCategoryDto.parent_id === id) {
        throw new ConflictException('Category cannot be its own parent');
      }

      const parentCategory = await this.prisma.menuCategory.findUnique({
        where: { id: updateMenuCategoryDto.parent_id },
      });

      if (!parentCategory) {
        throw new NotFoundException(
          `Parent category with ID ${updateMenuCategoryDto.parent_id} not found`,
        );
      }
    }

    const updatedCategory = await this.prisma.menuCategory.update({
      where: { id },
      data: updateMenuCategoryDto,
    });

    // แปลง category_id เป็น string
    return {
      ...updatedCategory,
      category_id: updatedCategory.category_id.toString(),
    };
  }

  async remove(id: number) {
    // Check if category exists
    const category = await this.findOne(id);

    // Check if category has children categories
    const childCategories = await this.prisma.menuCategory.findMany({
      where: { parent_id: id },
    });

    if (childCategories.length > 0) {
      throw new ConflictException(
        'Cannot delete category with child categories',
      );
    }

    // Check if category has associated menu items
    if (category.type === 'food' && category.foodMenus.length > 0) {
      throw new ConflictException(
        'Cannot delete category with associated food menu items',
      );
    }

    if (category.type === 'beverage' && category.beverageMenus.length > 0) {
      throw new ConflictException(
        'Cannot delete category with associated beverage menu items',
      );
    }

    await this.prisma.menuCategory.delete({
      where: { id },
    });

    return { message: 'Menu category deleted successfully' };
  }
}
