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
  BadRequestException,
} from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { UpdateDeliveryTimeDto } from './dto/update-delivery-time.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { LocationHistoryEntry } from './interface/types';
class LocationHistoryResponse {
  id: number;
  order_id: number;
  status: string;
  locationHistory: LocationHistoryEntry[];
}

class UpdateStatusDto {
  status: string;
  notes?: string;
}
@ApiTags('Deliveries')
@Controller('deliveries')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'employee')
  @ApiOperation({ summary: 'Create a new delivery (Admin or Employee)' })
  @ApiResponse({ status: 201, description: 'Delivery created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order or employee not found' })
  @ApiResponse({
    status: 409,
    description: 'Delivery for order already exists',
  })
  create(@Body() createDeliveryDto: CreateDeliveryDto) {
    return this.deliveriesService.create(createDeliveryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all deliveries' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'employeeId',
    required: false,
    description: 'Filter by employee ID',
  })
  @ApiResponse({ status: 200, description: 'List of deliveries' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.deliveriesService.findAll(
      status,
      employeeId ? +employeeId : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a delivery by ID' })
  @ApiResponse({ status: 200, description: 'Delivery details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  findOne(@Param('id') id: string) {
    return this.deliveriesService.findOne(+id);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get a delivery by order ID' })
  @ApiResponse({ status: 200, description: 'Delivery details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  findByOrderId(@Param('orderId') orderId: string) {
    return this.deliveriesService.findByOrderId(+orderId);
  }

  @Get(':id/location')
  @ApiOperation({ summary: 'Get the current location of a delivery' })
  @ApiResponse({ status: 200, description: 'Delivery location details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  getLocation(@Param('id') id: string) {
    return this.deliveriesService.getLocation(+id);
  }

  @Get(':id/location-history')
  @UseGuards(RolesGuard)
  @Roles('admin', 'employee')
  @ApiOperation({
    summary: 'Get the location history of a delivery (Admin or Employee)',
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery location history',
    type: LocationHistoryResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  getLocationHistory(@Param('id') id: string) {
    return this.deliveriesService.getLocationHistory(+id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'employee')
  @ApiOperation({ summary: 'Update a delivery (Admin or Employee)' })
  @ApiResponse({ status: 200, description: 'Delivery updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'Delivery, order, or employee not found',
  })
  @ApiResponse({ status: 409, description: 'Conflict with existing delivery' })
  update(
    @Param('id') id: string,
    @Body() updateDeliveryDto: UpdateDeliveryDto,
  ) {
    return this.deliveriesService.update(+id, updateDeliveryDto);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('admin', 'employee')
  @ApiOperation({ summary: 'Update delivery status (Admin or Employee)' })
  @ApiResponse({
    status: 200,
    description: 'Delivery status updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid status or payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  @ApiBody({
    type: UpdateStatusDto,
    description: 'Status update payload',
    examples: {
      example1: {
        value: { status: 'out_for_delivery', notes: 'Picked up by driver' },
      },
    },
  })
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    if (!updateStatusDto.status) {
      throw new BadRequestException('Status is required');
    }
    return this.deliveriesService.updateStatus(+id, updateStatusDto);
  }

  @Patch(':id/time')
  @UseGuards(RolesGuard)
  @Roles('admin', 'employee')
  @ApiOperation({ summary: 'Update delivery time (Admin or Employee)' })
  @ApiResponse({
    status: 200,
    description: 'Delivery time updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  updateTime(
    @Param('id') id: string,
    @Body() updateTimeDto: UpdateDeliveryTimeDto,
  ) {
    return this.deliveriesService.updateTime(+id, updateTimeDto);
  }

  @Patch(':id/location')
  @UseGuards(RolesGuard)
  @Roles('admin', 'employee')
  @ApiOperation({ summary: 'Update delivery location (Admin or Employee)' })
  @ApiResponse({
    status: 200,
    description: 'Delivery location updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  updateLocation(
    @Param('id') id: string,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    return this.deliveriesService.updateLocation(+id, updateLocationDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a delivery (Admin only)' })
  @ApiResponse({ status: 200, description: 'Delivery deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Delivery not found' })
  remove(@Param('id') id: string) {
    return this.deliveriesService.remove(+id);
  }
}
