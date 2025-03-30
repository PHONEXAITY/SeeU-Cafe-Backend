import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBeverageMenuDto } from './dto/create-beverage-menu.dto';
import { UpdateBeverageMenuDto } from './dto/update-beverage-menu.dto';

@Injectable()
export class BeverageMenuService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBeverageMenuDto: CreateBeverageMenuDto) {
    // Verify category exists
    const category = await this.prisma.menuCategory.findUnique({
      where: { id: createBeverageMenuDto.category_id },
    });

    if (!category) {
      throw new NotFoundException(
        `Category with ID ${createBeverageMenuDto.category_id} not found`,
      );
    }

    return this.prisma.beverageMenu.create({
      data: createBeverageMenuDto,
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

    return this.prisma.beverageMenu.findMany({
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

    return beverageMenu;
  }

  async update(id: number, updateBeverageMenuDto: UpdateBeverageMenuDto) {
    // Check if beverage menu item exists
    await this.findOne(id);

    // If category is being updated, verify the new category exists
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

    return this.prisma.beverageMenu.update({
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
  }

  async remove(id: number) {
    // Check if beverage menu item exists
    await this.findOne(id);

    await this.prisma.beverageMenu.delete({
      where: { id },
    });

    return { message: 'Beverage menu item deleted successfully' };
  }
}
