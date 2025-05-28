// src/employees/dto/employee-analytics.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum } from 'class-validator';

export class GetEmployeeAnalyticsDto {
  @ApiProperty({
    required: false,
    enum: ['24h', '7d', '30d', '90d', '1y'],
    default: '7d',
    description: 'Time range for analytics data',
  })
  @IsOptional()
  @IsEnum(['24h', '7d', '30d', '90d', '1y'])
  timeRange?: string = '7d';

  @ApiProperty({
    required: false,
    description: 'Filter by employee position',
    enum: ['manager', 'staff', 'delivery', 'cashier', 'waiter', 'chef'],
  })
  @IsOptional()
  @IsString()
  position?: string;
}

export class EmployeeMetricDto {
  @ApiProperty({ example: 15, description: 'Total number of employees' })
  totalEmployees: number;

  @ApiProperty({ example: 12, description: 'Number of active employees' })
  activeEmployees: number;

  @ApiProperty({ example: 2, description: 'Number of employees on leave' })
  onLeave: number;

  @ApiProperty({ example: 1, description: 'Number of inactive employees' })
  inactive: number;

  @ApiProperty({
    example: 8.5,
    description: 'Percentage change from last period',
  })
  changeFromLastPeriod: number;
}

export class EmployeeActivityDto {
  @ApiProperty({ example: '2024-01-15', description: 'Date of the activity' })
  date: string;

  @ApiProperty({
    example: 12,
    description: 'Number of active employees on this date',
  })
  activeEmployees: number;

  @ApiProperty({ example: 2, description: 'Number of new hires on this date' })
  newHires: number;

  @ApiProperty({ example: 1, description: 'Number of departures on this date' })
  departures: number;

  @ApiProperty({ example: 85.5, description: 'Attendance rate percentage' })
  attendanceRate: number;
}

export class EmployeePositionDto {
  @ApiProperty({ example: 'manager', description: 'Position key' })
  position: string;

  @ApiProperty({ example: 'ຜູ້ຈັດການ', description: 'Position label in Lao' })
  label: string;

  @ApiProperty({
    example: 5,
    description: 'Number of employees in this position',
  })
  count: number;

  @ApiProperty({ example: 33.3, description: 'Percentage of total employees' })
  percentage: number;
}

export class EmployeePerformanceDto {
  @ApiProperty({ example: 1, description: 'Employee ID' })
  employeeId: number;

  @ApiProperty({ example: 'John Doe', description: 'Employee full name' })
  name: string;

  @ApiProperty({ example: 'manager', description: 'Employee position' })
  position: string;

  @ApiProperty({ example: 25, description: 'Number of orders handled' })
  ordersHandled: number;

  @ApiProperty({ example: 15, description: 'Number of deliveries completed' })
  deliveriesCompleted: number;

  @ApiProperty({ example: 95.5, description: 'Performance score out of 100' })
  performanceScore: number;

  @ApiProperty({
    example: 'https://example.com/photo.jpg',
    description: 'Employee profile photo URL',
    nullable: true,
  })
  profilePhoto?: string | null;
}
