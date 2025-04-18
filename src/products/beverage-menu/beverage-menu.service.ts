import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBeverageMenuDto } from './dto/create-beverage-menu.dto';
import { UpdateBeverageMenuDto } from './dto/update-beverage-menu.dto';
import { BeverageMenu } from '@prisma/client';

@Injectable()
export class BeverageMenuService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createBeverageMenuDto: CreateBeverageMenuDto) {
    const category = await this.prisma.menuCategory.findUnique({
      where: { id: createBeverageMenuDto.category_id },
    });

    if (!category) {
      throw new NotFoundException(
        `Category with ID ${createBeverageMenuDto.category_id} not found`,
      );
    }

    const newBeverageMenu = await this.prisma.beverageMenu.create({
      data: createBeverageMenuDto,
    });

    await this.cacheManager.del('beverage_menu_all');
    await this.cacheManager.del(
      `beverage_menu_category_${createBeverageMenuDto.category_id}`,
    );

    return newBeverageMenu;
  }

  async findAll(categoryId?: number, status?: string) {
    let cacheKey = 'beverage_menu_all';
    if (categoryId) {
      cacheKey = `beverage_menu_category_${categoryId}`;
    }
    if (status) {
      cacheKey += `_status_${status}`;
    }

    const cachedData = await this.cacheManager.get<BeverageMenu[]>(cacheKey);
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

    const beverageMenus = await this.prisma.beverageMenu.findMany({
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

    await this.cacheManager.set(cacheKey, beverageMenus);

    return beverageMenus;
  }

  async findOne(id: number) {
    const cacheKey = `beverage_menu_${id}`;
    const cachedData = await this.cacheManager.get<
      BeverageMenu & { category: { id: number; name: string } }
    >(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const beverageMenu = await this.prisma.beverageMenu.findUnique({
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

    if (!beverageMenu) {
      throw new NotFoundException(`Beverage menu item with ID ${id} not found`);
    }

    await this.cacheManager.set(cacheKey, beverageMenu);

    return beverageMenu;
  }

  async update(id: number, updateBeverageMenuDto: UpdateBeverageMenuDto) {
    const existingMenu = await this.prisma.beverageMenu.findUnique({
      where: { id },
      select: { category_id: true },
    });

    if (!existingMenu) {
      throw new NotFoundException(`Beverage menu item with ID ${id} not found`);
    }

    if (updateBeverageMenuDto.category_id) {
      const category = await this.prisma.menuCategory.findUnique({
        where: { id: updateBeverageMenuDto.category_id },
      });

      if (!category) {
        throw new NotFoundException(
          `Category with ID ${updateBeverageMenuDto.category_id} not found`,
        );
      }
    }

    const updatedMenu = await this.prisma.beverageMenu.update({
      where: { id },
      data: updateBeverageMenuDto,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await this.cacheManager.del(`beverage_menu_${id}`);
    await this.cacheManager.del('beverage_menu_all');

    await this.cacheManager.del(
      `beverage_menu_category_${existingMenu.category_id}`,
    );

    if (
      updateBeverageMenuDto.category_id &&
      updateBeverageMenuDto.category_id !== existingMenu.category_id
    ) {
      await this.cacheManager.del(
        `beverage_menu_category_${updateBeverageMenuDto.category_id}`,
      );
    }

    return updatedMenu;
  }

  async remove(id: number) {
    const beverageMenu = await this.prisma.beverageMenu.findUnique({
      where: { id },
      select: { category_id: true },
    });

    if (!beverageMenu) {
      throw new NotFoundException(`Beverage menu item with ID ${id} not found`);
    }

    await this.prisma.beverageMenu.delete({
      where: { id },
    });

    await this.cacheManager.del(`beverage_menu_${id}`);
    await this.cacheManager.del('beverage_menu_all');
    await this.cacheManager.del(
      `beverage_menu_category_${beverageMenu.category_id}`,
    );

    return { message: 'Beverage menu item deleted successfully' };
  }
}
