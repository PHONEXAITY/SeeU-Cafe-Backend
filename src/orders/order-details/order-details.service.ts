import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDetailDto } from './dto/create-order-detail.dto';
import { UpdateOrderDetailDto } from './dto/update-order-detail.dto';

@Injectable()
export class OrderDetailsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(orderId: number, createOrderDetailDto: CreateOrderDetailDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (
      !createOrderDetailDto.food_menu_id &&
      !createOrderDetailDto.beverage_menu_id
    ) {
      throw new BadRequestException(
        'Either food_menu_id or beverage_menu_id must be provided',
      );
    }

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

    let preparationTime = createOrderDetailDto.preparation_time;
    if (!preparationTime) {
      if (createOrderDetailDto.food_menu_id) {
        preparationTime = 20;
      } else if (createOrderDetailDto.beverage_menu_id) {
        preparationTime = 5;
      } else {
        preparationTime = 15;
      }
    }

    const orderDetail = await this.prisma.orderDetail.create({
      data: {
        ...createOrderDetailDto,
        order_id: orderId,
        preparation_time: preparationTime,
        is_ready: false,
      },
      include: {
        food_menu: true,
        beverage_menu: true,
      },
    });

    if (order.estimated_ready_time === null) {
      const allOrderDetails = await this.prisma.orderDetail.findMany({
        where: { order_id: orderId },
      });

      const prepTimes: number[] = [];

      for (const detail of allOrderDetails) {
        if (
          detail.preparation_time !== undefined &&
          detail.preparation_time !== null
        ) {
          prepTimes.push(Number(detail.preparation_time));
        } else {
          prepTimes.push(0);
        }
      }

      prepTimes.push(preparationTime || 0);

      const maxPrepTime =
        prepTimes.length > 0 ? Math.max(...prepTimes) : preparationTime || 0;

      const estimatedReadyTime = new Date(Date.now() + maxPrepTime * 60 * 1000);

      await this.prisma.order.update({
        where: { id: orderId },
        data: { estimated_ready_time: estimatedReadyTime },
      });
    }

    return orderDetail;
  }

  async findAll(orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    const orderDetails = await this.prisma.orderDetail.findMany({
      where: { order_id: orderId },
      include: {
        food_menu: true,
        beverage_menu: true,
      },
    });

    return orderDetails;
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
    const existingDetail = await this.findOne(id);

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

    if (
      !updateOrderDetailDto.preparation_time &&
      existingDetail.preparation_time
    ) {
      updateOrderDetailDto.preparation_time = existingDetail.preparation_time;
    }

    const updatedDetail = await this.prisma.orderDetail.update({
      where: { id },
      data: updateOrderDetailDto,
      include: {
        food_menu: true,
        beverage_menu: true,
      },
    });

    if (updateOrderDetailDto.is_ready === true) {
      const orderId = existingDetail.order_id;

      const allOrderDetails = await this.prisma.orderDetail.findMany({
        where: { order_id: orderId },
      });

      const allReady = allOrderDetails.every((detail) =>
        detail.id === id ? true : detail.is_ready,
      );

      if (allReady) {
        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            actual_ready_time: new Date(),
            status: 'ready',
          },
        });

        await this.prisma.orderTimeline.create({
          data: {
            order_id: orderId,
            status: 'ready',
            notes: 'All items are ready',
          },
        });
      }
    }

    return updatedDetail;
  }

  async markReady(id: number) {
    const orderDetail = await this.findOne(id);

    const updatedDetail = await this.prisma.orderDetail.update({
      where: { id },
      data: { is_ready: true },
      include: {
        food_menu: true,
        beverage_menu: true,
      },
    });

    const allOrderDetails = await this.prisma.orderDetail.findMany({
      where: { order_id: orderDetail.order_id },
    });

    const allReady = allOrderDetails.every((detail) => detail.is_ready);

    if (allReady) {
      await this.prisma.order.update({
        where: { id: orderDetail.order_id },
        data: {
          actual_ready_time: new Date(),
          status: 'ready',
        },
      });

      await this.prisma.orderTimeline.create({
        data: {
          order_id: orderDetail.order_id,
          status: 'ready',
          notes: 'All items are ready',
        },
      });
    }

    return updatedDetail;
  }

  async remove(id: number) {
    const orderDetail = await this.findOne(id);

    const orderId = orderDetail.order_id;

    await this.prisma.orderDetail.delete({
      where: { id },
    });

    const remainingItems = await this.prisma.orderDetail.findMany({
      where: { order_id: orderId },
    });

    if (remainingItems.length > 0) {
      const prepTimes: number[] = [];

      for (const detail of remainingItems) {
        if (
          detail.preparation_time !== undefined &&
          detail.preparation_time !== null
        ) {
          prepTimes.push(Number(detail.preparation_time));
        } else {
          prepTimes.push(0);
        }
      }

      const maxPrepTime = prepTimes.length > 0 ? Math.max(...prepTimes) : 0;

      if (maxPrepTime > 0) {
        const estimatedReadyTime = new Date(
          Date.now() + maxPrepTime * 60 * 1000,
        );

        await this.prisma.order.update({
          where: { id: orderId },
          data: { estimated_ready_time: estimatedReadyTime },
        });
      }
    }

    return { message: 'Order detail deleted successfully' };
  }
}
