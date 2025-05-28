/* eslint-disable no-case-declarations */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { GetEmployeeAnalyticsDto } from './dto/employee-analytics.dto';

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
            create_at: 'desc',
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

  async getEmployeeMetrics(query: GetEmployeeAnalyticsDto) {
    const { timeRange, position } = query;

    // สร้าง date filter ตาม timeRange
    const dateFilter = this.getTimeRangeFilter(timeRange);

    const currentPeriodFilter: any = {};

    // แก้ไข: ใช้ created_at แทน created_at
    if (dateFilter.gte) {
      currentPeriodFilter.created_at = { gte: dateFilter.gte };
    }

    if (position) {
      currentPeriodFilter.position = position;
    }

    // ข้อมูลพนักงานปัจจุบัน
    const currentEmployees = await this.prisma.employee.findMany({
      where: currentPeriodFilter,
    });

    // ข้อมูลพนักงานช่วงก่อนหน้า (สำหรับเปรียบเทียบ)
    const previousDateFilter = this.getPreviousTimeRangeFilter(timeRange);
    const previousPeriodFilter: any = {};

    if (previousDateFilter.gte && previousDateFilter.lte) {
      previousPeriodFilter.created_at = {
        gte: previousDateFilter.gte,
        lte: previousDateFilter.lte,
      };
    }

    if (position) {
      previousPeriodFilter.position = position;
    }

    const previousEmployees = await this.prisma.employee.findMany({
      where: previousPeriodFilter,
    });

    const totalEmployees = currentEmployees.length;
    const activeEmployees = currentEmployees.filter(
      (emp) => emp.status === 'active',
    ).length;
    const onLeave = currentEmployees.filter(
      (emp) => emp.status === 'leave',
    ).length;
    const inactive = currentEmployees.filter(
      (emp) => emp.status === 'inactive',
    ).length;

    const previousTotal = previousEmployees.length;
    const changeFromLastPeriod =
      previousTotal > 0
        ? ((totalEmployees - previousTotal) / previousTotal) * 100
        : 0;

    return {
      totalEmployees,
      activeEmployees,
      onLeave,
      inactive,
      changeFromLastPeriod: Number(changeFromLastPeriod.toFixed(2)),
    };
  }

  async getEmployeeActivity(query: GetEmployeeAnalyticsDto) {
    const { timeRange, position } = query;
    const dateFilter = this.getTimeRangeFilter(timeRange);

    const filter: any = {};

    if (dateFilter.gte) {
      filter.created_at = { gte: dateFilter.gte };
    }

    if (position) {
      filter.position = position;
    }

    const employees = await this.prisma.employee.findMany({
      where: filter,
      orderBy: { created_at: 'asc' },
    });

    // จัดกลุ่มข้อมูลตามวันที่
    const activityData = this.processEmployeeActivityData(employees, timeRange);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return activityData;
  }

  async getEmployeePositions(query: GetEmployeeAnalyticsDto) {
    const { timeRange, position } = query;
    const dateFilter = this.getTimeRangeFilter(timeRange);

    const filter: any = {};

    if (dateFilter.gte) {
      filter.created_at = { gte: dateFilter.gte };
    }

    if (position) {
      filter.position = position;
    }

    const employees = await this.prisma.employee.findMany({
      where: filter,
    });

    const positionLabels: { [key: string]: string } = {
      manager: 'ຜູ້ຈັດການ',
      staff: 'ພະນັກງານ',
      delivery: 'ພະນັກງານສົ່ງ',
      cashier: 'ພະນັກງານເກັບເງິນ',
      waiter: 'ພະນັກງານເສີບ',
      chef: 'ພໍ່ຄົວ',
    };

    const positionCounts: { [key: string]: number } = {};
    employees.forEach((emp) => {
      positionCounts[emp.position] = (positionCounts[emp.position] || 0) + 1;
    });

    const total = employees.length;
    const positionData = Object.entries(positionCounts).map(
      ([position, count]) => ({
        position,
        label: positionLabels[position] || position,
        count,
        percentage: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
      }),
    );

    return positionData;
  }

  async getEmployeePerformance(query: GetEmployeeAnalyticsDto) {
    const { timeRange, position } = query;
    const dateFilter = this.getTimeRangeFilter(timeRange);

    const filter: any = {
      status: 'active',
    };

    if (position) {
      filter.position = position;
    }

    // แก้ไขการ query เพื่อรวม relations ที่ถูกต้อง
    const employees = await this.prisma.employee.findMany({
      where: filter,
      include: {
        // ตรวจสอบ schema ว่า employee มี relation กับ orders หรือไม่
        // หากไม่มี ให้ใช้วิธีการ query แยก
        orders: {
          where: {
            create_at: dateFilter.gte ? { gte: dateFilter.gte } : undefined,
          },
        },
        // ตรวจสอบ schema ว่า employee มี relation กับ delivery หรือไม่
        delivery: {
          where: {
            // แก้ไข: ใช้ field ที่ถูกต้องตาม schema
            actual_delivery_time: dateFilter.gte
              ? { gte: dateFilter.gte }
              : undefined,
          },
        },
      },
    });

    const performanceData = employees.map((employee) => {
      const ordersHandled = employee.orders?.length || 0;
      const deliveriesCompleted =
        employee.delivery?.filter((d) => d.status === 'delivered').length || 0;

      const performanceScore = this.calculatePerformanceScore(
        ordersHandled,
        deliveriesCompleted,
        employee.position,
      );

      return {
        employeeId: employee.id,
        name: `${employee.first_name} ${employee.last_name}`,
        position: employee.position,
        ordersHandled,
        deliveriesCompleted,
        performanceScore: Number(performanceScore.toFixed(1)),
        profilePhoto: employee.profile_photo,
      };
    });

    return performanceData.sort(
      (a, b) => b.performanceScore - a.performanceScore,
    );
  }

  // แก้ไข: เพิ่ม fallback หากไม่มี relations
  async getEmployeePerformanceAlternative(query: GetEmployeeAnalyticsDto) {
    const { timeRange, position } = query;
    const dateFilter = this.getTimeRangeFilter(timeRange);

    const filter: any = {
      status: 'active',
    };

    if (position) {
      filter.position = position;
    }

    const employees = await this.prisma.employee.findMany({
      where: filter,
    });

    const performanceData = await Promise.all(
      employees.map(async (employee) => {
        // Query orders และ deliveries แยกกัน
        const ordersCount = await this.prisma.order.count({
          where: {
            Employee_id: employee.id,
            create_at: dateFilter.gte ? { gte: dateFilter.gte } : undefined,
          },
        });

        const deliveriesCount = await this.prisma.delivery.count({
          where: {
            employee_id: employee.id,
            status: 'delivered',
            actual_delivery_time: dateFilter.gte
              ? { gte: dateFilter.gte }
              : undefined,
          },
        });

        const performanceScore = this.calculatePerformanceScore(
          ordersCount,
          deliveriesCount,
          employee.position,
        );

        return {
          employeeId: employee.id,
          name: `${employee.first_name} ${employee.last_name}`,
          position: employee.position,
          ordersHandled: ordersCount,
          deliveriesCompleted: deliveriesCount,
          performanceScore: Number(performanceScore.toFixed(1)),
          profilePhoto: employee.profile_photo,
        };
      }),
    );

    return performanceData.sort(
      (a, b) => b.performanceScore - a.performanceScore,
    );
  }

  private getTimeRangeFilter(timeRange: string = '7d') {
    const now = new Date();
    const filter: { gte?: Date; lte?: Date } = {};

    switch (timeRange) {
      case '24h':
        filter.gte = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        filter.gte = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        filter.gte = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        filter.gte = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        filter.gte = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        filter.gte = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return filter;
  }

  private getPreviousTimeRangeFilter(timeRange: string = '7d') {
    const now = new Date();
    let daysBack = 7;

    switch (timeRange) {
      case '24h':
        daysBack = 1;
        break;
      case '7d':
        daysBack = 7;
        break;
      case '30d':
        daysBack = 30;
        break;
      case '90d':
        daysBack = 90;
        break;
      case '1y':
        daysBack = 365;
        break;
    }

    const currentStart = new Date(
      now.getTime() - daysBack * 24 * 60 * 60 * 1000,
    );
    const previousStart = new Date(
      currentStart.getTime() - daysBack * 24 * 60 * 60 * 1000,
    );

    return {
      gte: previousStart,
      lte: currentStart,
    };
  }

  private processEmployeeActivityData(
    employees: any[],
    timeRange: string = '7d',
  ) {
    const groupedData: { [key: string]: any } = {};

    employees.forEach((employee) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const date = new Date(employee.created_at);
      let key: string;

      switch (timeRange) {
        case '24h':
          key = date.toISOString().substring(0, 13) + ':00:00'; // Group by hour
          break;
        case '7d':
          key = date.toISOString().substring(0, 10); // Group by day
          break;
        case '30d':
        case '90d':
          // Group by week
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().substring(0, 10);
          break;
        case '1y':
          key = date.toISOString().substring(0, 7); // Group by month
          break;
        default:
          key = date.toISOString().substring(0, 10);
      }

      if (!groupedData[key]) {
        groupedData[key] = {
          date: key,
          activeEmployees: 0,
          newHires: 0,
          departures: 0,
        };
      }

      if (employee.status === 'active') {
        groupedData[key].activeEmployees++;
      }

      // นับการจ้างใหม่ (ถ้าพนักงานถูกสร้างในช่วงนี้)
      groupedData[key].newHires++;
    });

    // แปลงเป็น array และเรียงตามวันที่
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const activityArray = Object.values(groupedData).map((item: any) => ({
      ...item,
      attendanceRate: Math.random() * 20 + 80, // Mock attendance rate (80-100%)
    }));

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return activityArray.sort(
      (a: any, b: any) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }

  private calculatePerformanceScore(
    ordersHandled: number,
    deliveriesCompleted: number,
    position: string,
  ): number {
    let baseScore = 50;

    // คะแนนจากการจัดการออเดอร์
    baseScore += Math.min(ordersHandled * 2, 30);

    // คะแนนจากการจัดส่ง
    baseScore += Math.min(deliveriesCompleted * 3, 20);

    // ปรับคะแนนตามตำแหน่ง
    const positionMultiplier: { [key: string]: number } = {
      manager: 1.2,
      delivery: 1.1,
      staff: 1.0,
      cashier: 1.0,
      waiter: 1.0,
      chef: 1.1,
    };

    baseScore *= positionMultiplier[position] || 1.0;

    return Math.min(baseScore, 100);
  }
}
