import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    // Check if employee with the same email already exists
    const existingEmployee = await this.prisma.employee.findUnique({
      where: { email: createEmployeeDto.email },
    });

    if (existingEmployee) {
      throw new ConflictException(
        `Employee with email '${createEmployeeDto.email}' already exists`,
      );
    }

    // Generate a unique employee_id
    const employeeId = BigInt(Date.now());

    const employee = await this.prisma.employee.create({
      data: {
        ...createEmployeeDto,
        Employee_id: employeeId,
      },
    });

    // แปลง Employee_id เป็น string
    return {
      ...employee,
      Employee_id: employee.Employee_id.toString(),
    };
  }

  async findAll(position?: string) {
    const where = position ? { position } : {};

    const employees = await this.prisma.employee.findMany({
      where,
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone: true,
        position: true,
        profile_photo: true,
        Employee_id: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: {
        last_name: 'asc',
      },
    });

    // แปลง Employee_id เป็น string ในทุก object
    return employees.map((employee) => ({
      ...employee,
      Employee_id: employee.Employee_id.toString(),
    }));
  }

  async findOne(id: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: {
            create_at: 'desc',
          },
          take: 10,
        },
        delivery: {
          orderBy: {
            delivered_time: 'desc',
          },
          take: 10,
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${id} not found`);
    }

    // แปลง Employee_id เป็น string
    return {
      ...employee,
      Employee_id: employee.Employee_id.toString(),
    };
  }

  async findByEmail(email: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { email },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with email '${email}' not found`);
    }

    // แปลง Employee_id เป็น string
    return {
      ...employee,
      Employee_id: employee.Employee_id.toString(),
    };
  }

  async update(id: number, updateEmployeeDto: UpdateEmployeeDto) {
    // Check if employee exists
    await this.findOne(id);

    // If email is being updated, check if the new email is already in use
    if (updateEmployeeDto.email) {
      const existingEmployee = await this.prisma.employee.findUnique({
        where: { email: updateEmployeeDto.email },
      });

      if (existingEmployee && existingEmployee.id !== id) {
        throw new ConflictException(
          `Employee with email '${updateEmployeeDto.email}' already exists`,
        );
      }
    }

    const updatedEmployee = await this.prisma.employee.update({
      where: { id },
      data: updateEmployeeDto,
    });

    // แปลง Employee_id เป็น string
    return {
      ...updatedEmployee,
      Employee_id: updatedEmployee.Employee_id.toString(),
    };
  }

  async remove(id: number) {
    // Check if employee exists
    await this.findOne(id);

    // Check if employee has associated orders
    const ordersCount = await this.prisma.order.count({
      where: { Employee_id: id },
    });

    if (ordersCount > 0) {
      throw new ConflictException(
        'Cannot delete employee with associated orders',
      );
    }

    // Check if employee has associated deliveries
    const deliveriesCount = await this.prisma.delivery.count({
      where: { employee_id: id },
    });

    if (deliveriesCount > 0) {
      throw new ConflictException(
        'Cannot delete employee with associated deliveries',
      );
    }

    await this.prisma.employee.delete({
      where: { id },
    });

    return { message: 'Employee deleted successfully' };
  }
}
