import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { DocumentsService } from '../documents/documents.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { Document } from '@prisma/client';
import { DocumentDto } from '../documents/dto/document.dto';
import { GetEmployeeAnalyticsDto } from './dto/employee-analytics.dto';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Employees')
@Controller('employees')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'staff', 'manager')
@ApiBearerAuth()
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly documentsService: DocumentsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new employee (Admin only)' })
  @ApiResponse({ status: 201, description: 'Employee created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async create(@Body() createEmployeeDto: CreateEmployeeDto) {
    return this.employeesService.create(createEmployeeDto);
  }

  @Post(':id/upload-photo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload profile photo for employee (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Employee profile photo upload',
    type: 'multipart/form-data',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiParam({ name: 'id', description: 'Employee ID', type: 'number' })
  @ApiResponse({
    status: 200,
    description: 'Profile photo uploaded successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async uploadProfilePhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    try {
      const result = await this.cloudinaryService.uploadFile(
        file,
        'employee-profiles',
      );

      const updatedEmployee = await this.employeesService.update(id, {
        profile_photo: result.secure_url,
      });

      return {
        message: 'Profile photo uploaded successfully',
        profile_photo: result.secure_url,
        employee: updatedEmployee,
      };
    } catch (error) {
      throw new BadRequestException(
        `Failed to upload profile photo: ${error.message}`,
      );
    }
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update employee status (Admin only)' })
  @ApiParam({ name: 'id', description: 'Employee ID', type: 'number' })
  @ApiBody({
    description: 'Status update data',
    schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          example: 'active',
          description: 'New status (active, leave, inactive)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
  ) {
    if (!status) {
      throw new BadRequestException('Status is required');
    }

    const validStatuses = ['active', 'leave', 'inactive'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        `Status must be one of: ${validStatuses.join(', ')}`,
      );
    }

    const updatedEmployee = await this.employeesService.update(id, { status });

    return {
      message: `Employee status updated to ${status} successfully`,
      employee: updatedEmployee,
    };
  }

  @Get('positions')
  @ApiOperation({ summary: 'Get all employee positions (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of positions' })
  getPositions() {
    const positions = [
      { value: 'manager', label: 'ຜູ້ຈັດການ' },
      { value: 'staff', label: 'ພະນັກງານ' },
      { value: 'delivery', label: 'ພະນັກງານສົ່ງ' },
      { value: 'cashier', label: 'ພະນັກງານເກັບເງິນ' },
      { value: 'waiter', label: 'ພະນັກງານເສີບ' },
      { value: 'chef', label: 'ພ່ໍຄົວ' },
    ];
    return positions;
  }

  @Get('status-options')
  @ApiOperation({ summary: 'Get all employee status options (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of status options' })
  getStatusOptions() {
    const statusOptions = [
      { value: 'active', label: 'ເຮັດວຽກຢູ່' },
      { value: 'leave', label: 'ລາພັກ' },
      { value: 'inactive', label: 'ພັກວຽກ' },
    ];
    return statusOptions;
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get employee statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Employee statistics' })
  async getStats() {
    const allEmployees = await this.employeesService.findAll({});

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

    const positionCounts = {};
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

  @Get('employee-id/:employeeId')
  @ApiOperation({ summary: 'Get an employee by Employee_id (Admin only)' })
  @ApiParam({
    name: 'employeeId',
    description: 'Employee ID (from Employee_id field)',
    type: 'string',
  })
  @ApiResponse({ status: 200, description: 'Employee details' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findByEmployeeId(@Param('employeeId') employeeId: string) {
    const employee = await this.employeesService.findByEmployeeId(employeeId);
    if (!employee) {
      throw new BadRequestException('Employee not found');
    }
    return employee;
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload document for employee (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Employee document upload',
    type: 'multipart/form-data',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        documentType: {
          type: 'string',
          example: 'id_card',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async uploadEmployeeDocument(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('documentType') documentType: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.documentsService.uploadDocument(file, {
      employeeId: id,
      documentType,
    });
  }

  @Get(':id/documents')
  @ApiOperation({ summary: 'Get all documents for employee (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of documents',
    type: [DocumentDto],
  })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async getEmployeeDocuments(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Document[]> {
    await this.employeesService.findOne(id);
    return this.documentsService.findByEmployeeId(id);
  }

  @Delete(':id/documents/:documentId')
  @ApiOperation({ summary: 'Delete employee document (Admin only)' })
  @ApiResponse({ status: 200, description: 'Document deleted successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async deleteEmployeeDocument(
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    return this.documentsService.remove(documentId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all employees (Admin only)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'position', required: false })
  @ApiResponse({ status: 200, description: 'List of employees' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('position') position?: string,
  ) {
    return this.employeesService.findAll({ search, status, position });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an employee by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Employee details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.findOne(id);
  }

  @Get('email/:email')
  @ApiOperation({ summary: 'Get an employee by email (Admin only)' })
  @ApiResponse({ status: 200, description: 'Employee details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  async findByEmail(@Param('email') email: string) {
    return this.employeesService.findByEmail(email);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an employee (Admin only)' })
  @ApiResponse({ status: 200, description: 'Employee updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(id, updateEmployeeDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an employee (Admin only)' })
  @ApiResponse({ status: 200, description: 'Employee deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete with associated records',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.employeesService.remove(id);
  }

  @Get('analytics/metrics')
  @ApiOperation({ summary: 'Get employee metrics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Employee metrics' })
  async getEmployeeMetrics(@Query() query: GetEmployeeAnalyticsDto) {
    return this.employeesService.getEmployeeMetrics(query);
  }

  @Get('analytics/activity')
  @ApiOperation({ summary: 'Get employee activity data (Admin only)' })
  @ApiResponse({ status: 200, description: 'Employee activity data' })
  async getEmployeeActivity(@Query() query: GetEmployeeAnalyticsDto) {
    return this.employeesService.getEmployeeActivity(query);
  }

  @Get('analytics/positions')
  @ApiOperation({
    summary: 'Get employee distribution by position (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Employee position distribution' })
  async getEmployeePositions(@Query() query: GetEmployeeAnalyticsDto) {
    return this.employeesService.getEmployeePositions(query);
  }

  @Get('analytics/performance')
  @ApiOperation({ summary: 'Get employee performance data (Admin only)' })
  @ApiResponse({ status: 200, description: 'Employee performance data' })
  async getEmployeePerformance(@Query() query: GetEmployeeAnalyticsDto) {
    return this.employeesService.getEmployeePerformance(query);
  }
}
