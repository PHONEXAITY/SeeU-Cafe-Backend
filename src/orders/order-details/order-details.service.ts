import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDetailDto } from './dto/create-order-detail.dto';
import { UpdateOrderDetailDto } from './dto/update-order-detail.dto';

@Injectable()
export class OrderDetailsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(orderId: number, createOrderDetailDto: CreateOrderDetailDto) {
    // Check if order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Check if at least one menu item is provided
    if (
      !createOrderDetailDto.food_menu_id &&
      !createOrderDetailDto.beverage_menu_id
    ) {
      throw new Error(
        'Either food_menu_id or beverage_menu_id must be provided',
      );
    }

    // If food_menu_id is provided, check if it exists
    if (createOrderDetailDto.food_menu_id) {
      const foodMenuItem = await this.prisma.foodMenu.findUnique({
        where: { id: createOrderDetailDto.food_menu_id },
      });

      if (!foodMenuItem) {
        throw new NotFoundException(
          `Food menu item with ID ${createOrderDetailDto.food_menu_id} not found`,
        );
      }
    }

    // If beverage_menu_id is provided, check if it exists
    if (createOrderDetailDto.beverage_menu_id) {
      const beverageMenuItem = await this.prisma.beverageMenu.findUnique({
        where: { id: createOrderDetailDto.beverage_menu_id },
      });

      if (!beverageMenuItem) {
        throw new NotFoundException(
          `Beverage menu item with ID ${createOrderDetailDto.beverage_menu_id} not found`,
        );
      }
    }

    return this.prisma.orderDetail.create({
      data: {
        ...createOrderDetailDto,
        order_id: orderId,
      },
      include: {
        food_menu: true,
        beverage_menu: true,
      },
    });
  }

  async findAll(orderId: number) {
    // Check if order exists
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    return this.prisma.orderDetail.findMany({
      where: { order_id: orderId },
      include: {
        food_menu: true,
        beverage_menu: true,
      },
    });
  }

  async findOne(id: number) {
    const orderDetail = await this.prisma.orderDetail.findUnique({
      where: { id },
      include: {
        food_menu: true,
        beverage_menu: true,
      },
    });

    if (!orderDetail) {
      throw new NotFoundException(`Order detail with ID ${id} not found`);
    }

    return orderDetail;
  }

  async update(id: number, updateOrderDetailDto: UpdateOrderDetailDto) {
    // Check if order detail exists
    await this.findOne(id);

    // If food_menu_id is provided, check if it exists
    if (updateOrderDetailDto.food_menu_id) {
      const foodMenuItem = await this.prisma.foodMenu.findUnique({
        where: { id: updateOrderDetailDto.food_menu_id },
      });

      if (!foodMenuItem) {
        throw new NotFoundException(
          `Food menu item with ID ${updateOrderDetailDto.food_menu_id} not found`,
        );
      }
    }

    // If beverage_menu_id is provided, check if it exists
    if (updateOrderDetailDto.beverage_menu_id) {
      const beverageMenuItem = await this.prisma.beverageMenu.findUnique({
        where: { id: updateOrderDetailDto.beverage_menu_id },
      });

      if (!beverageMenuItem) {
        throw new NotFoundException(
          `Beverage menu item with ID ${updateOrderDetailDto.beverage_menu_id} not found`,
        );
      }
    }

    return this.prisma.orderDetail.update({
      where: { id },
      data: updateOrderDetailDto,
      include: {
        food_menu: true,
        beverage_menu: true,
      },
    });
  }

  async remove(id: number) {
    // Check if order detail exists
    await this.findOne(id);

    await this.prisma.orderDetail.delete({
      where: { id },
    });

    return { message: 'Order detail deleted successfully' };
  }
}
