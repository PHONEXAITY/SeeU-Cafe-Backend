import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { UpdateTableTimeDto } from './dto/update-table-time.dto';

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTableDto: CreateTableDto) {
    const existingTable = await this.prisma.table.findUnique({
      where: { number: createTableDto.number },
    });

    if (existingTable) {
      throw new ConflictException(
        `Table with number ${createTableDto.number} already exists`,
      );
    }

    const tableId = BigInt(Date.now());

    const table = await this.prisma.table.create({
      data: {
        ...createTableDto,
        table_id: tableId,
      },
    });

    return {
      ...table,
      table_id: table.table_id.toString(),
    };
  }

  async findAll(status?: string) {
    const where = status ? { status } : {};

    const tables = await this.prisma.table.findMany({
      where,
      orderBy: {
        number: 'asc',
      },
    });

    return tables.map((table) => ({
      ...table,
      table_id: table.table_id.toString(),
    }));
  }

  async findAvailableTables(capacity?: number) {
    const where: any = { status: 'available' };

    if (capacity) {
      where.capacity = {
        gte: capacity,
      };
    }

    const tables = await this.prisma.table.findMany({
      where,
      orderBy: [{ capacity: 'asc' }, { number: 'asc' }],
    });

    return tables.map((table) => ({
      ...table,
      table_id: table.table_id.toString(),
    }));
  }

  async findOne(id: number) {
    const table = await this.prisma.table.findUnique({
      where: { id },
      include: {
        orders: {
          where: {
            status: {
              in: ['pending', 'preparing', 'ready', 'served'],
            },
          },
          orderBy: {
            create_at: 'desc',
          },
          take: 5,
          include: {
            order_details: {
              include: {
                food_menu: true,
                beverage_menu: true,
              },
            },
          },
        },
      },
    });

    if (!table) {
      throw new NotFoundException(`Table with ID ${id} not found`);
    }

    return {
      ...table,
      table_id: table.table_id.toString(),
    };
  }

  async findByNumber(number: number) {
    const table = await this.prisma.table.findUnique({
      where: { number },
      include: {
        orders: {
          where: {
            status: {
              in: ['pending', 'preparing', 'ready', 'served'],
            },
          },
          orderBy: {
            create_at: 'desc',
          },
          take: 5,
          include: {
            order_details: {
              include: {
                food_menu: true,
                beverage_menu: true,
              },
            },
          },
        },
      },
    });

    if (!table) {
      throw new NotFoundException(`Table with number ${number} not found`);
    }

    return {
      ...table,
      table_id: table.table_id.toString(),
    };
  }

  async update(id: number, updateTableDto: UpdateTableDto) {
    await this.findOne(id);

    if (updateTableDto.number) {
      const existingTable = await this.prisma.table.findUnique({
        where: { number: updateTableDto.number },
      });

      if (existingTable && existingTable.id !== id) {
        throw new ConflictException(
          `Table with number ${updateTableDto.number} already exists`,
        );
      }
    }

    const updatedTable = await this.prisma.table.update({
      where: { id },
      data: updateTableDto,
    });

    return {
      ...updatedTable,
      table_id: updatedTable.table_id.toString(),
    };
  }

  async updateStatus(id: number, status: string) {
    const table = await this.findOne(id);

    const updatedTable = await this.prisma.table.update({
      where: { id },
      data: { status },
    });

    if (status === 'occupied' && table.status !== 'occupied') {
      await this.prisma.table.update({
        where: { id },
        data: {
          current_session_start: new Date(),
          expected_end_time: new Date(Date.now() + 2 * 60 * 60 * 1000),
        },
      });
    }

    if (status === 'available' && table.status === 'occupied') {
      await this.prisma.table.update({
        where: { id },
        data: {
          current_session_start: null,
          expected_end_time: null,
        },
      });
    }

    return {
      ...updatedTable,
      table_id: updatedTable.table_id.toString(),
    };
  }

  async updateTime(id: number, updateTableTimeDto: UpdateTableTimeDto) {
    const table = await this.findOne(id);

    if (table.status !== 'occupied') {
      throw new BadRequestException(
        'Cannot update time for a table that is not occupied',
      );
    }

    const updatedTable = await this.prisma.table.update({
      where: { id },
      data: {
        expected_end_time: updateTableTimeDto.expectedEndTime,
      },
    });

    if (
      updateTableTimeDto.notifyCustomers &&
      table.orders &&
      table.orders.length > 0
    ) {
      const activeOrders = table.orders.filter(
        (order) =>
          !['cancelled', 'completed', 'delivered'].includes(order.status),
      );

      for (const order of activeOrders) {
        if (order.User_id) {
          await this.prisma.customerNotification.create({
            data: {
              user_id: order.User_id,
              order_id: order.id,
              message:
                updateTableTimeDto.notificationMessage ||
                `Your table reservation time has been updated. New end time: ${updateTableTimeDto.expectedEndTime.toLocaleString()}`,
              type: 'time_change',
              action_url: `/orders/${order.order_id}`,
            },
          });
        }
      }
    }

    return {
      ...updatedTable,
      table_id: updatedTable.table_id.toString(),
    };
  }

  async startSession(id: number) {
    const table = await this.findOne(id);

    if (table.status === 'occupied') {
      throw new BadRequestException('Table is already occupied');
    }

    if (table.status !== 'available') {
      throw new BadRequestException(
        `Cannot start session for table with status: ${table.status}`,
      );
    }

    const updatedTable = await this.prisma.table.update({
      where: { id },
      data: {
        status: 'occupied',
        current_session_start: new Date(),
        expected_end_time: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    });

    return {
      ...updatedTable,
      table_id: updatedTable.table_id.toString(),
    };
  }

  async endSession(id: number) {
    const table = await this.findOne(id);

    if (table.status !== 'occupied') {
      throw new BadRequestException('Table is not currently occupied');
    }

    const activeOrders = await this.prisma.order.findMany({
      where: {
        table_id: id,
        status: {
          in: ['pending', 'preparing', 'ready', 'served'],
        },
      },
    });

    if (activeOrders.length > 0) {
      throw new ConflictException(
        'Cannot end session with active orders. Please complete or cancel all orders first.',
      );
    }

    const updatedTable = await this.prisma.table.update({
      where: { id },
      data: {
        status: 'available',
        current_session_start: null,
        expected_end_time: null,
      },
    });

    return {
      ...updatedTable,
      table_id: updatedTable.table_id.toString(),
    };
  }

  async remove(id: number) {
    await this.findOne(id);

    const ordersCount = await this.prisma.order.count({
      where: { table_id: id },
    });

    if (ordersCount > 0) {
      throw new ConflictException('Cannot delete table with associated orders');
    }

    await this.prisma.table.delete({
      where: { id },
    });

    return {
      message: 'Table deleted successfully',
    };
  }
}
