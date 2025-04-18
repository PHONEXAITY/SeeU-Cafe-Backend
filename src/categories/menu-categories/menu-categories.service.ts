import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MenuCategory } from '@prisma/client';
import { FormattedMenuCategory } from '../interfaces/category.interface';

@Injectable()
export class MenuCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private readonly ALL_CATEGORIES_CACHE_KEY = 'all_menu_categories';
  private readonly CATEGORY_TYPE_CACHE_PREFIX = 'menu_categories_type_';
  private readonly CATEGORY_ID_CACHE_PREFIX = 'menu_category_id_';

  private async clearCategoryCaches(category?: MenuCategory): Promise<void> {
    await this.cacheManager.del(this.ALL_CATEGORIES_CACHE_KEY);

    if (category?.type) {
      await this.cacheManager.del(
        `${this.CATEGORY_TYPE_CACHE_PREFIX}${category.type}`,
      );
    }

    if (category?.id) {
      await this.cacheManager.del(
        `${this.CATEGORY_ID_CACHE_PREFIX}${category.id}`,
      );
    }
  }

  private formatCategory(category: MenuCategory): FormattedMenuCategory {
    return {
      ...category,
      category_id: category.category_id.toString(),
      foodMenus: [],
      beverageMenus: [],
    };
  }

  async create(
    createMenuCategoryDto: CreateMenuCategoryDto,
  ): Promise<FormattedMenuCategory> {
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

    const categoryId = BigInt(Date.now());

    const menuCategory = await this.prisma.menuCategory.create({
      data: {
        ...createMenuCategoryDto,
        category_id: categoryId,
      },
    });

    await this.clearCategoryCaches(menuCategory);

    return this.formatCategory(menuCategory);
  }

  async findAll(type?: string): Promise<FormattedMenuCategory[]> {
    const cacheKey = type
      ? `${this.CATEGORY_TYPE_CACHE_PREFIX}${type}`
      : this.ALL_CATEGORIES_CACHE_KEY;

    const cachedCategories =
      await this.cacheManager.get<FormattedMenuCategory[]>(cacheKey);
    if (cachedCategories) {
      return cachedCategories;
    }

    const where = type ? { type } : {};

    const categories = await this.prisma.menuCategory.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    });

    const formattedCategories = categories.map((category) =>
      this.formatCategory(category),
    );

    await this.cacheManager.set(cacheKey, formattedCategories);

    return formattedCategories;
  }

  async findOne(
    id: number,
  ): Promise<
    FormattedMenuCategory & { foodMenus: any[]; beverageMenus: any[] }
  > {
    const cacheKey = `${this.CATEGORY_ID_CACHE_PREFIX}${id}`;

    const cachedCategory = await this.cacheManager.get<
      FormattedMenuCategory & { foodMenus: any[]; beverageMenus: any[] }
    >(cacheKey);
    if (cachedCategory) {
      return cachedCategory;
    }

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

    const formattedCategory = {
      ...this.formatCategory(category),
      foodMenus: category.foodMenus,
      beverageMenus: category.beverageMenus,
    };

    await this.cacheManager.set(cacheKey, formattedCategory);

    return formattedCategory;
  }

  async update(
    id: number,
    updateMenuCategoryDto: UpdateMenuCategoryDto,
  ): Promise<FormattedMenuCategory> {
    await this.findOne(id);

    if (updateMenuCategoryDto.parent_id) {
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

    await this.clearCategoryCaches(updatedCategory);

    return this.formatCategory(updatedCategory);
  }

  async remove(id: number): Promise<{ message: string }> {
    const category = await this.findOne(id);

    const childCategories = await this.prisma.menuCategory.findMany({
      where: { parent_id: id },
    });

    if (childCategories.length > 0) {
      throw new ConflictException(
        'Cannot delete category with child categories',
      );
    }

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

    await this.clearCategoryCaches({
      id: category.id,
      type: category.type,
    } as MenuCategory);

    return { message: 'Menu category deleted successfully' };
  }
}
