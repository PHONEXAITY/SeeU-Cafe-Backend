import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    const { documents: _documents, ...employeeData } = createEmployeeDto;

    const existingEmployee = await this.prisma.employee.findUnique({
      where: { email: employeeData.email },
    });

    if (existingEmployee) {
      throw new ConflictException(
        `Employee with email '${employeeData.email}' already exists`,
      );
    }

    const employeeId = BigInt(Date.now());

    const employee = await this.prisma.employee.create({
      data: {
        ...employeeData,
        Employee_id: employeeId,
        status: employeeData.status || 'active',
      },
    });

    return {
      ...employee,
      Employee_id: employee.Employee_id.toString(),
    };
  }

  async findAll(filters: {
    search?: string;
    status?: string;
    position?: string;
  }) {
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { first_name: { contains: filters.search, mode: 'insensitive' } },
        { last_name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
      ];
    }

    if (filters.position) {
      where.position = filters.position;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const employees = await this.prisma.employee.findMany({
      where,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone: true,
        position: true,
        status: true,
        profile_photo: true,
        Employee_id: true,
        created_at: true,
        updated_at: true,
        documents: {
          select: {
            id: true,
            document_type: true,
          },
        },
      },
      orderBy: {
        last_name: 'asc',
      },
    });

    return employees.map((employee) => ({
      ...employee,
      Employee_id: employee.Employee_id.toString(),
    }));
  }

  async findOne(id: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        documents: true,
        orders: {
          orderBy: {
            create_at: 'desc', // Fixed from "created_at"
          },
          take: 10,
          select: {
            id: true,
            order_id: true,
            status: true,
            total_price: true,
          },
        },
        delivery: {
          orderBy: {
            actual_delivery_time: 'desc',
          },
          take: 10,
          select: {
            id: true,
            status: true,
            delivery_id: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    return {
      ...employee,
      Employee_id: employee.Employee_id.toString(),
    };
  }

  async findByEmail(email: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { email },
      include: {
        documents: true,
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with email '${email}' not found`);
    }

    return {
      ...employee,
      Employee_id: employee.Employee_id.toString(),
    };
  }

  async findByEmployeeId(employeeId: string) {
    let employeeIdBigInt: bigint;

    try {
      employeeIdBigInt = BigInt(employeeId);
    } catch {
      throw new BadRequestException('Invalid Employee ID format');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { Employee_id: employeeIdBigInt },
      include: {
        documents: true,
      },
    });

    if (!employee) {
      throw new NotFoundException(
        `Employee with Employee_id ${employeeId} not found`,
      );
    }

    return {
      ...employee,
      Employee_id: employee.Employee_id.toString(),
    };
  }

  async update(id: number, updateEmployeeDto: UpdateEmployeeDto) {
    const { documents: _documents, ...updateData } = updateEmployeeDto;

    await this.findOne(id);

    if (updateData.email) {
      const existingEmployee = await this.prisma.employee.findUnique({
        where: { email: updateData.email },
      });

      if (existingEmployee && existingEmployee.id !== id) {
        throw new ConflictException(
          `Employee with email '${updateData.email}' already exists`,
        );
      }
    }

    const updatedEmployee = await this.prisma.employee.update({
      where: { id },
      data: updateData,
    });

    return {
      ...updatedEmployee,
      Employee_id: updatedEmployee.Employee_id.toString(),
    };
  }

  async updateStatus(id: number, status: string) {
    const validStatuses = ['active', 'leave', 'inactive'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        `Status must be one of: ${validStatuses.join(', ')}`,
      );
    }

    await this.findOne(id);

    const updatedEmployee = await this.prisma.employee.update({
      where: { id },
      data: { status },
    });

    return {
      ...updatedEmployee,
      Employee_id: updatedEmployee.Employee_id.toString(),
    };
  }

  async updateProfilePhoto(id: number, photoUrl: string) {
    await this.findOne(id);

    if (!photoUrl || !photoUrl.startsWith('http')) {
      throw new BadRequestException('Invalid profile photo URL');
    }

    const updatedEmployee = await this.prisma.employee.update({
      where: { id },
      data: { profile_photo: photoUrl },
    });

    return {
      ...updatedEmployee,
      Employee_id: updatedEmployee.Employee_id.toString(),
    };
  }

  async remove(id: number) {
    const employee = await this.findOne(id);

    const ordersCount = await this.prisma.order.count({
      where: { Employee_id: id },
    });

    if (ordersCount > 0) {
      throw new ConflictException(
        'Cannot delete employee with associated orders',
      );
    }

    const deliveriesCount = await this.prisma.delivery.count({
      where: { employee_id: id },
    });

    if (deliveriesCount > 0) {
      throw new ConflictException(
        'Cannot delete employee with associated deliveries',
      );
    }

    await this.prisma.document.deleteMany({
      where: { employee_id: id },
    });

    await this.prisma.employee.delete({
      where: { id },
    });

    return {
      message: 'Employee deleted successfully',
      deletedEmployee: {
        ...employee,
        Employee_id: employee.Employee_id.toString(),
      },
    };
  }

  async getEmployeeStats() {
    const allEmployees = await this.findAll({});

    const total = allEmployees.length;
    const activeCount = allEmployees.filter(
      (emp) => emp.status === 'active',
    ).length;
    const leaveCount = allEmployees.filter(
      (emp) => emp.status === 'leave',
    ).length;
    const inactiveCount = allEmployees.filter(
      (emp) => emp.status === 'inactive',
    ).length;

    const positionCounts: { [key: string]: number } = {};
    allEmployees.forEach((emp) => {
      positionCounts[emp.position] = (positionCounts[emp.position] || 0) + 1;
    });

    return {
      total,
      active: activeCount,
      leave: leaveCount,
      inactive: inactiveCount,
      byPosition: positionCounts,
    };
  }
}
