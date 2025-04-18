import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { TimeUpdateService } from './time-update.service';
import { CreateTimeUpdateDto } from './dto/create-time-update.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Time Updates')
@Controller('time-updates')
export class TimeUpdateController {
  constructor(private readonly timeUpdateService: TimeUpdateService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new time update record' })
  @ApiResponse({
    status: 201,
    description: 'Time update record created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  create(@Body() createTimeUpdateDto: CreateTimeUpdateDto) {
    return this.timeUpdateService.create(createTimeUpdateDto);
  }

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all time updates for an order' })
  @ApiResponse({ status: 200, description: 'List of time updates' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  findAllByOrderId(@Param('orderId') orderId: string) {
    return this.timeUpdateService.findAllByOrderId(+orderId);
  }

  @Get('employee/:employeeId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all time updates by an employee' })
  @ApiResponse({ status: 200, description: 'List of time updates' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAllByEmployee(@Param('employeeId') employeeId: string) {
    return this.timeUpdateService.findAllByEmployee(+employeeId);
  }

  @Get('notified')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all time updates that were notified to customers',
  })
  @ApiResponse({ status: 200, description: 'List of time updates' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAllNotified() {
    return this.timeUpdateService.findAllNotified();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a time update by ID' })
  @ApiResponse({ status: 200, description: 'Time update details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Time update not found' })
  findOne(@Param('id') id: string) {
    return this.timeUpdateService.findOne(+id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a time update (Admin only)' })
  @ApiResponse({ status: 200, description: 'Time update deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Time update not found' })
  remove(@Param('id') id: string) {
    return this.timeUpdateService.remove(+id);
  }
}
