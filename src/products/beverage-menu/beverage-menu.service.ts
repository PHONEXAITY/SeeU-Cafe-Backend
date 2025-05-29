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
    console.log(`🍺 === UPDATE BEVERAGE MENU ITEM ${id} ===`);
    console.log(
      '🍺 Input DTO:',
      JSON.stringify(updateBeverageMenuDto, null, 2),
    );

    // 🔥 FIX: ตรวจสอบว่าสินค้าเครื่องดื่มมีอยู่จริงหรือไม่
    const existingMenu = await this.prisma.beverageMenu.findUnique({
      where: { id },
      select: {
        id: true,
        category_id: true,
        hot_price: true,
        ice_price: true,
        price: true,
        name: true,
        description: true,
        status: true,
        image: true,
      },
    });

    if (!existingMenu) {
      console.error(`🍺 Beverage menu item with ID ${id} not found`);
      throw new NotFoundException(`Beverage menu item with ID ${id} not found`);
    }

    console.log(
      '🍺 Existing menu item:',
      JSON.stringify(existingMenu, null, 2),
    );

    // 🔥 FIX: ตรวจสอบ category หากมีการเปลี่ยนแปลง
    if (
      updateBeverageMenuDto.category_id &&
      updateBeverageMenuDto.category_id !== existingMenu.category_id
    ) {
      const category = await this.prisma.menuCategory.findUnique({
        where: { id: updateBeverageMenuDto.category_id },
      });

      if (!category) {
        console.error(
          `🍺 Category with ID ${updateBeverageMenuDto.category_id} not found`,
        );
        throw new NotFoundException(
          `Category with ID ${updateBeverageMenuDto.category_id} not found`,
        );
      }
      console.log('🍺 Category validation passed:', category.name);
    }

    // 🔥 FIX: ตรวจสอบการอัปเดตราคา - ให้ยืดหยุ่นมากขึ้น
    const isPriceFieldBeingUpdated =
      updateBeverageMenuDto.hot_price !== undefined ||
      updateBeverageMenuDto.ice_price !== undefined ||
      updateBeverageMenuDto.price !== undefined;

    if (isPriceFieldBeingUpdated) {
      console.log('🍺 Price fields are being updated, validating...');

      // คำนวณราคาสุดท้ายหลังจากอัปเดต
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

      // ตรวจสอบว่ามีราคาอย่างน้อย 1 ค่าที่ไม่เป็น null
      const hasValidPrice =
        (finalHotPrice !== null &&
          finalHotPrice !== undefined &&
          finalHotPrice >= 0) ||
        (finalIcePrice !== null &&
          finalIcePrice !== undefined &&
          finalIcePrice >= 0) ||
        (finalRegularPrice !== null &&
          finalRegularPrice !== undefined &&
          finalRegularPrice >= 0);

      if (!hasValidPrice) {
        console.error('🍺 No valid prices after update');
        throw new BadRequestException(
          'At least one price (hot_price, ice_price, or price) must be provided and not null',
        );
      }

      console.log('🍺 Price validation passed:', {
        finalHotPrice,
        finalIcePrice,
        finalRegularPrice,
      });
    }

    // 🔥 FIX: เตรียมข้อมูลสำหรับอัปเดต
    const updateData: any = {};

    // จัดการฟิลด์พื้นฐาน
    if (updateBeverageMenuDto.name !== undefined) {
      updateData.name = updateBeverageMenuDto.name.trim();
    }

    if (updateBeverageMenuDto.description !== undefined) {
      updateData.description = updateBeverageMenuDto.description?.trim() || '';
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

    // 🔥 FIX: จัดการฟิลด์ราคาแบบชัดเจน
    if (updateBeverageMenuDto.price !== undefined) {
      updateData.price = updateBeverageMenuDto.price;
    }

    if (updateBeverageMenuDto.hot_price !== undefined) {
      updateData.hot_price = updateBeverageMenuDto.hot_price;
    }

    if (updateBeverageMenuDto.ice_price !== undefined) {
      updateData.ice_price = updateBeverageMenuDto.ice_price;
    }

    console.log('🍺 Final update data:', JSON.stringify(updateData, null, 2));

    try {
      // ทำการอัปเดตในฐานข้อมูล
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

      console.log(
        '🍺 Successfully updated beverage menu item:',
        JSON.stringify(updatedMenu, null, 2),
      );

      // ล้าง cache
      await Promise.all([
        this.cacheManager.del(`beverage_menu_${id}`),
        this.cacheManager.del('beverage_menu_all'),
        this.cacheManager.del(
          `beverage_menu_category_${existingMenu.category_id}`,
        ),
        // ล้าง cache สำหรับหมวดหมู่ใหม่ด้วย (ถ้ามีการเปลี่ยนแปลง)
        updateBeverageMenuDto.category_id &&
        updateBeverageMenuDto.category_id !== existingMenu.category_id
          ? this.cacheManager.del(
              `beverage_menu_category_${updateBeverageMenuDto.category_id}`,
            )
          : Promise.resolve(),
      ]);

      console.log('🍺 Cache cleared successfully');

      return updatedMenu;
    } catch (error) {
      console.error('🍺 === DATABASE UPDATE ERROR ===');
      console.error('🍺 Error details:', error);
      console.error('🍺 Error message:', error.message);
      console.error('🍺 Error code:', error.code);

      if (error.code === 'P2002') {
        throw new BadRequestException('Duplicate entry found');
      } else if (error.code === 'P2025') {
        throw new NotFoundException('Record to update not found');
      }

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
