import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';

@Injectable()
export class TablesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createTableDto: CreateTableDto) {
    // Check if table with the same number already exists
    const existingTable = await this.prisma.table.findUnique({
      where: { number: createTableDto.number },
    });

    if (existingTable) {
      throw new ConflictException(
        `Table with number ${createTableDto.number} already exists`,
      );
    }

    // Generate a unique table_id
    const tableId = BigInt(Date.now());

    const table = await this.prisma.table.create({
      data: {
        ...createTableDto,
        table_id: tableId,
      },
    });

    // แปลง table_id เป็น string
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

    // แปลง table_id เป็น string ในทุก object
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
        },
      },
    });

    if (!table) {
      throw new NotFoundException(`Table with ID ${id} not found`);
    }

    // แปลง table_id เป็น string
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
        },
      },
    });

    if (!table) {
      throw new NotFoundException(`Table with number ${number} not found`);
    }

    // แปลง table_id เป็น string
    return {
      ...table,
      table_id: table.table_id.toString(),
    };
  }

  async update(id: number, updateTableDto: UpdateTableDto) {
    // Check if table exists
    await this.findOne(id);

    // If table number is being updated, check if the new number is already in use
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

    // แปลง table_id เป็น string
    return {
      ...updatedTable,
      table_id: updatedTable.table_id.toString(),
    };
  }

  async updateStatus(id: number, status: string) {
    // Check if table exists
    await this.findOne(id);

    const updatedTable = await this.prisma.table.update({
      where: { id },
      data: { status },
    });

    // แปลง table_id เป็น string
    return {
      ...updatedTable,
      table_id: updatedTable.table_id.toString(),
    };
  }

  async remove(id: number) {
    // Check if table exists
    await this.findOne(id);

    // Check if table has associated orders
    const ordersCount = await this.prisma.order.count({
      where: { table_id: id },
    });

    if (ordersCount > 0) {
      throw new ConflictException('Cannot delete table with associated orders');
    }

    await this.prisma.table.delete({
      where: { id },
    });

    return { message: 'Table deleted successfully' };
  }
}
