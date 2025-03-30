import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createOrderDto: CreateOrderDto) {
    // Validate relations if provided
    if (createOrderDto.User_id) {
      const user = await this.prisma.user.findUnique({
        where: { id: createOrderDto.User_id },
      });
      if (!user) {
        throw new NotFoundException(
          `User with ID ${createOrderDto.User_id} not found`,
        );
      }
    }

    if (createOrderDto.Employee_id) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: createOrderDto.Employee_id },
      });
      if (!employee) {
        throw new NotFoundException(
          `Employee with ID ${createOrderDto.Employee_id} not found`,
        );
      }
    }

    if (createOrderDto.table_id) {
      const table = await this.prisma.table.findUnique({
        where: { id: createOrderDto.table_id },
      });
      if (!table) {
        throw new NotFoundException(
          `Table with ID ${createOrderDto.table_id} not found`,
        );
      }
    }

    if (createOrderDto.promotion_id) {
      const promotion = await this.prisma.promotion.findUnique({
        where: { id: createOrderDto.promotion_id },
      });
      if (!promotion) {
        throw new NotFoundException(
          `Promotion with ID ${createOrderDto.promotion_id} not found`,
        );
      }
    }

    const { order_details, ...orderData } = createOrderDto;

    // Generate a unique order_id
    const uniqueOrderId = `ORD${Date.now()}`;

    // Create the order
    const order = await this.prisma.order.create({
      data: {
        ...orderData,
        order_id: uniqueOrderId,
      },
    });

    // Create order details
    if (order_details && order_details.length > 0) {
      await Promise.all(
        order_details.map(async (detail) => {
          // Validate food_menu_id or beverage_menu_id
          if (!detail.food_menu_id && !detail.beverage_menu_id) {
            throw new BadRequestException(
              'Either food_menu_id or beverage_menu_id must be provided for each order detail',
            );
          }

          if (detail.food_menu_id) {
            const foodMenuItem = await this.prisma.foodMenu.findUnique({
              where: { id: detail.food_menu_id },
            });
            if (!foodMenuItem) {
              throw new NotFoundException(
                `Food menu item with ID ${detail.food_menu_id} not found`,
              );
            }
          }

          if (detail.beverage_menu_id) {
            const beverageMenuItem = await this.prisma.beverageMenu.findUnique({
              where: { id: detail.beverage_menu_id },
            });
            if (!beverageMenuItem) {
              throw new NotFoundException(
                `Beverage menu item with ID ${detail.beverage_menu_id} not found`,
              );
            }
          }

          return this.prisma.orderDetail.create({
            data: {
              ...detail,
              order_id: order.id,
            },
          });
        }),
      );
    }

    // Return the order with details
    return this.findOne(order.id);
  }

  async findAll(status?: string, userId?: number, employeeId?: number) {
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.User_id = userId;
    }

    if (employeeId) {
      where.Employee_id = employeeId;
    }

    return this.prisma.order.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
        table: true,
        promotion: true,
        order_details: {
          include: {
            food_menu: true,
            beverage_menu: true,
          },
        },
      },
      orderBy: {
        create_at: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
        table: true,
        promotion: true,
        order_details: {
          include: {
            food_menu: true,
            beverage_menu: true,
          },
        },
        payments: true,
        delivery: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async findByOrderId(orderIdString: string) {
    const order = await this.prisma.order.findUnique({
      where: { order_id: orderIdString },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
        table: true,
        promotion: true,
        order_details: {
          include: {
            food_menu: true,
            beverage_menu: true,
          },
        },
        payments: true,
        delivery: true,
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Order with order_id ${orderIdString} not found`,
      );
    }

    return order;
  }

  async update(id: number, updateOrderDto: UpdateOrderDto) {
    // Check if order exists
    await this.findOne(id);

    // Validate relations if provided
    if (updateOrderDto.User_id) {
      const user = await this.prisma.user.findUnique({
        where: { id: updateOrderDto.User_id },
      });
      if (!user) {
        throw new NotFoundException(
          `User with ID ${updateOrderDto.User_id} not found`,
        );
      }
    }

    if (updateOrderDto.Employee_id) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: updateOrderDto.Employee_id },
      });
      if (!employee) {
        throw new NotFoundException(
          `Employee with ID ${updateOrderDto.Employee_id} not found`,
        );
      }
    }

    if (updateOrderDto.table_id) {
      const table = await this.prisma.table.findUnique({
        where: { id: updateOrderDto.table_id },
      });
      if (!table) {
        throw new NotFoundException(
          `Table with ID ${updateOrderDto.table_id} not found`,
        );
      }
    }

    if (updateOrderDto.promotion_id) {
      const promotion = await this.prisma.promotion.findUnique({
        where: { id: updateOrderDto.promotion_id },
      });
      if (!promotion) {
        throw new NotFoundException(
          `Promotion with ID ${updateOrderDto.promotion_id} not found`,
        );
      }
    }

    const { order_details, ...orderData } = updateOrderDto;

    // Update the order
    await this.prisma.order.update({
      where: { id },
      data: orderData,
    });

    // Update order details if provided
    if (order_details && order_details.length > 0) {
      await Promise.all(
        order_details.map(async (detail) => {
          if (detail.id) {
            // Update existing order detail
            return this.prisma.orderDetail.update({
              where: { id: detail.id },
              data: {
                food_menu_id: detail.food_menu_id,
                beverage_menu_id: detail.beverage_menu_id,
                quantity: detail.quantity,
                price: detail.price,
                notes: detail.notes,
                status_id: detail.status_id,
              },
            });
          } else {
            // Create new order detail
            return this.prisma.orderDetail.create({
              data: {
                ...detail,
                order_id: id,
                quantity: detail.quantity ?? 1,
                price: detail.price ?? 0,
              },
            });
          }
        }),
      );
    }

    // Return the updated order with details
    return this.findOne(id);
  }

  async updateStatus(id: number, status: string) {
    // Check if order exists
    await this.findOne(id);

    return this.prisma.order.update({
      where: { id },
      data: { status },
    });
  }

  async remove(id: number) {
    // Check if order exists
    await this.findOne(id);

    // Delete associated order details first
    await this.prisma.orderDetail.deleteMany({
      where: { order_id: id },
    });

    // Delete the order
    await this.prisma.order.delete({
      where: { id },
    });

    return { message: 'Order deleted successfully' };
  }
}
