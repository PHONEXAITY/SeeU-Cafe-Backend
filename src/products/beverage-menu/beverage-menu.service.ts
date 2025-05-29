import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
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
    // 🔥 FIX: Enhanced validation for creation
    const hasHotPrice =
      createBeverageMenuDto.hot_price !== undefined &&
      createBeverageMenuDto.hot_price !== null;
    const hasIcePrice =
      createBeverageMenuDto.ice_price !== undefined &&
      createBeverageMenuDto.ice_price !== null;
    const hasRegularPrice =
      createBeverageMenuDto.price !== undefined &&
      createBeverageMenuDto.price !== null;

    if (!hasHotPrice && !hasIcePrice && !hasRegularPrice) {
      throw new BadRequestException(
        'At least one of hot_price, ice_price, or price must be provided',
      );
    }

    const category = await this.prisma.menuCategory.findUnique({
      where: { id: createBeverageMenuDto.category_id },
    });

    if (!category) {
      throw new NotFoundException(
        `Category with ID ${createBeverageMenuDto.category_id} not found`,
      );
    }

    // Prepare data for creation
    const createData = {
      name: createBeverageMenuDto.name,
      description: createBeverageMenuDto.description || '',
      category_id: createBeverageMenuDto.category_id,
      status: createBeverageMenuDto.status || 'active',
      image: createBeverageMenuDto.image || null,
      price: createBeverageMenuDto.price ?? null, // Allow null for beverages
      hot_price: createBeverageMenuDto.hot_price ?? null,
      ice_price: createBeverageMenuDto.ice_price ?? null,
    };

    console.log('🍺 Creating beverage with data:', createData);

    const newBeverageMenu = await this.prisma.beverageMenu.create({
      data: createData,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Clear cache
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
    console.log(
      `🍺 Updating beverage menu item ${id} with data:`,
      updateBeverageMenuDto,
    );

    const existingMenu = await this.prisma.beverageMenu.findUnique({
      where: { id },
      select: {
        category_id: true,
        hot_price: true,
        ice_price: true,
        price: true,
      },
    });

    if (!existingMenu) {
      throw new NotFoundException(`Beverage menu item with ID ${id} not found`);
    }

    // 🔥 FIX: Validate category if provided
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

    // 🔥 FIX: Enhanced validation for price updates
    // Only validate prices if at least one price field is being updated
    const isPriceUpdate =
      updateBeverageMenuDto.hot_price !== undefined ||
      updateBeverageMenuDto.ice_price !== undefined ||
      updateBeverageMenuDto.price !== undefined;

    if (isPriceUpdate) {
      // Determine what the final prices will be after update
      const finalHotPrice =
        updateBeverageMenuDto.hot_price !== undefined
          ? updateBeverageMenuDto.hot_price
          : existingMenu.hot_price;

      const finalIcePrice =
        updateBeverageMenuDto.ice_price !== undefined
          ? updateBeverageMenuDto.ice_price
          : existingMenu.ice_price;

      const finalRegularPrice =
        updateBeverageMenuDto.price !== undefined
          ? updateBeverageMenuDto.price
          : existingMenu.price;

      // Check if at least one price will be valid after update
      const hasValidPrice =
        (finalHotPrice !== null && finalHotPrice !== undefined) ||
        (finalIcePrice !== null && finalIcePrice !== undefined) ||
        (finalRegularPrice !== null && finalRegularPrice !== undefined);

      if (!hasValidPrice) {
        throw new BadRequestException(
          'At least one price (hot_price, ice_price, or price) must be provided and not null',
        );
      }
    }

    // 🔥 FIX: Prepare update data with proper null handling
    const updateData: any = {};

    // Handle basic fields
    if (updateBeverageMenuDto.name !== undefined) {
      updateData.name = updateBeverageMenuDto.name;
    }
    if (updateBeverageMenuDto.description !== undefined) {
      updateData.description = updateBeverageMenuDto.description || '';
    }
    if (updateBeverageMenuDto.category_id !== undefined) {
      updateData.category_id = updateBeverageMenuDto.category_id;
    }
    if (updateBeverageMenuDto.status !== undefined) {
      updateData.status = updateBeverageMenuDto.status;
    }
    if (updateBeverageMenuDto.image !== undefined) {
      updateData.image = updateBeverageMenuDto.image;
    }

    // Handle price fields - explicitly handle null values
    if (updateBeverageMenuDto.price !== undefined) {
      updateData.price = updateBeverageMenuDto.price;
    }
    if (updateBeverageMenuDto.hot_price !== undefined) {
      updateData.hot_price = updateBeverageMenuDto.hot_price;
    }
    if (updateBeverageMenuDto.ice_price !== undefined) {
      updateData.ice_price = updateBeverageMenuDto.ice_price;
    }

    console.log('🍺 Final update data being sent to Prisma:', updateData);

    try {
      const updatedMenu = await this.prisma.beverageMenu.update({
        where: { id },
        data: updateData,
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      console.log('🍺 Successfully updated beverage menu item:', updatedMenu);

      // Clear cache
      await this.cacheManager.del(`beverage_menu_${id}`);
      await this.cacheManager.del('beverage_menu_all');
      await this.cacheManager.del(
        `beverage_menu_category_${existingMenu.category_id}`,
      );

      // Clear cache for new category if changed
      if (
        updateBeverageMenuDto.category_id &&
        updateBeverageMenuDto.category_id !== existingMenu.category_id
      ) {
        await this.cacheManager.del(
          `beverage_menu_category_${updateBeverageMenuDto.category_id}`,
        );
      }

      return updatedMenu;
    } catch (error) {
      console.error('🍺 Error updating beverage menu item:', error);
      throw error;
    }
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

    // Clear cache
    await this.cacheManager.del(`beverage_menu_${id}`);
    await this.cacheManager.del('beverage_menu_all');
    await this.cacheManager.del(
      `beverage_menu_category_${beverageMenu.category_id}`,
    );

    return { message: 'Beverage menu item deleted successfully' };
  }
}
