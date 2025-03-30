import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';

@Injectable()
export class DeliveriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createDeliveryDto: CreateDeliveryDto) {
    // Check if order exists
    const order = await this.prisma.order.findUnique({
      where: { id: createDeliveryDto.order_id },
    });

    if (!order) {
      throw new NotFoundException(
        `Order with ID ${createDeliveryDto.order_id} not found`,
      );
    }

    // Check if delivery for this order already exists
    const existingDelivery = await this.prisma.delivery.findUnique({
      where: { order_id: createDeliveryDto.order_id },
    });

    if (existingDelivery) {
      throw new ConflictException(
        `Delivery for order with ID ${createDeliveryDto.order_id} already exists`,
      );
    }

    // Validate employee if provided
    if (createDeliveryDto.employee_id) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: createDeliveryDto.employee_id },
      });

      if (!employee) {
        throw new NotFoundException(
          `Employee with ID ${createDeliveryDto.employee_id} not found`,
        );
      }
    }

    // Generate a unique delivery_id
    const deliveryId = BigInt(Date.now());

    // Create the delivery
    const delivery = await this.prisma.delivery.create({
      data: {
        ...createDeliveryDto,
        delivery_id: deliveryId,
      },
      include: {
        order: true,
        employee: true,
      },
    });

    // Update order status to 'out_for_delivery' if not already
    if (order.status !== 'out_for_delivery' && order.status !== 'delivered') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'out_for_delivery' },
      });
    }

    // แปลง delivery_id เป็น string
    return {
      ...delivery,
      delivery_id: delivery.delivery_id.toString(),
    };
  }

  async findAll(status?: string, employeeId?: number) {
    const where: any = {}; // เปลี่ยนจาก let เป็น const

    if (status) {
      where.status = status;
    }

    if (employeeId) {
      where.employee_id = employeeId;
    }

    const deliveries = await this.prisma.delivery.findMany({
      where,
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: {
        delivered_time: 'desc',
      },
    });

    // แปลง delivery_id เป็น string ในทุก object
    return deliveries.map((delivery) => ({
      ...delivery,
      delivery_id: delivery.delivery_id.toString(),
    }));
  }

  async findOne(id: number) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
              },
            },
            order_details: {
              include: {
                food_menu: true,
                beverage_menu: true,
              },
            },
          },
        },
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            phone: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery with ID ${id} not found`);
    }

    // แปลง delivery_id เป็น string
    return {
      ...delivery,
      delivery_id: delivery.delivery_id.toString(),
    };
  }

  async findByOrderId(orderId: number) {
    const delivery = await this.prisma.delivery.findUnique({
      where: { order_id: orderId },
      include: {
        order: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                first_name: true,
                last_name: true,
              },
            },
            order_details: {
              include: {
                food_menu: true,
                beverage_menu: true,
              },
            },
          },
        },
        employee: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            phone: true,
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery for order ID ${orderId} not found`);
    }

    // แปลง delivery_id เป็น string
    return {
      ...delivery,
      delivery_id: delivery.delivery_id.toString(),
    };
  }

  async update(id: number, updateDeliveryDto: UpdateDeliveryDto) {
    // Check if delivery exists
    await this.findOne(id);

    // Validate order if provided
    if (updateDeliveryDto.order_id) {
      const order = await this.prisma.order.findUnique({
        where: { id: updateDeliveryDto.order_id },
      });

      if (!order) {
        throw new NotFoundException(
          `Order with ID ${updateDeliveryDto.order_id} not found`,
        );
      }

      // Check if another delivery already exists for this order
      const existingDelivery = await this.prisma.delivery.findUnique({
        where: { order_id: updateDeliveryDto.order_id },
      });

      if (existingDelivery && existingDelivery.id !== id) {
        throw new ConflictException(
          `Delivery for order with ID ${updateDeliveryDto.order_id} already exists`,
        );
      }
    }

    // Validate employee if provided
    if (updateDeliveryDto.employee_id) {
      const employee = await this.prisma.employee.findUnique({
        where: { id: updateDeliveryDto.employee_id },
      });

      if (!employee) {
        throw new NotFoundException(
          `Employee with ID ${updateDeliveryDto.employee_id} not found`,
        );
      }
    }

    // Store original status
    const delivery = await this.prisma.delivery.findUnique({
      where: { id },
      select: { status: true, order_id: true },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery with ID ${id} not found`);
    }

    // Update the delivery
    const updatedDelivery = await this.prisma.delivery.update({
      where: { id },
      data: updateDeliveryDto,
      include: {
        order: true,
        employee: true,
      },
    });

    // If status changed to 'delivered', update delivered_time and order status
    if (
      updateDeliveryDto.status === 'delivered' &&
      delivery.status !== 'delivered'
    ) {
      await this.prisma.delivery.update({
        where: { id },
        data: { delivered_time: new Date() },
      });

      await this.prisma.order.update({
        where: { id: delivery.order_id },
        data: { status: 'delivered' },
      });
    }

    // แปลง delivery_id เป็น string
    return {
      ...updatedDelivery,
      delivery_id: updatedDelivery.delivery_id.toString(),
    };
  }

  async updateStatus(id: number, status: string) {
    // Check if delivery exists
    const delivery = await this.findOne(id);

    // Update the status
    const updatedDelivery = await this.prisma.delivery.update({
      where: { id },
      data: { status },
    });

    // If status changed to 'delivered', update delivered_time and order status
    if (status === 'delivered' && delivery.status !== 'delivered') {
      await this.prisma.delivery.update({
        where: { id },
        data: { delivered_time: new Date() },
      });

      await this.prisma.order.update({
        where: { id: delivery.order_id },
        data: { status: 'delivered' },
      });
    }

    // แปลง delivery_id เป็น string
    return {
      ...updatedDelivery,
      delivery_id: updatedDelivery.delivery_id.toString(),
    };
  }

  async remove(id: number) {
    // Check if delivery exists
    await this.findOne(id);

    // Delete the delivery
    await this.prisma.delivery.delete({
      where: { id },
    });

    return { message: 'Delivery deleted successfully' };
  }
}
