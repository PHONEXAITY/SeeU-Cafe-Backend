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
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { UpdateDeliveryTimeDto } from './dto/update-delivery-time.dto';
import { SimpleDeliveryFeeService } from './services/simple-delivery-fee.service';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { QueryDeliveryDto } from './dto/query-delivery.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { DeliveryStatus } from './enums/delivery-status.enum';

class DeliveryResponseDto {
  id: number;
  order_id: number;
  status: DeliveryStatus;
  delivery_id: string;
  delivery_address: string;
  customer_latitude?: number;
  customer_longitude?: number;
  customer_location_note?: string;
  phone_number?: string;
  employee_id?: number;
  delivery_fee?: number;
  estimated_delivery_time?: Date;
  actual_delivery_time?: Date;
  pickup_from_kitchen_time?: Date;
  customer_note?: string;
  created_at: Date;
  updated_at: Date;
}

class DeliveryLocationResponseDto {
  id: number;
  order_id: number;
  latitude: number;
  longitude: number;
  lastUpdate: Date;
  status: string;
  delivery_address: string;
}

class LocationHistoryResponseDto {
  id: number;
  order_id: number;
  status: string;
  locationHistory: Array<{
    latitude: number;
    longitude: number;
    timestamp: Date;
    note?: string;
    current?: boolean;
  }>;
}

class PaginatedDeliveryResponseDto {
  data: DeliveryResponseDto[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

@ApiTags('Deliveries')
@Controller('deliveries')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class DeliveriesController {
  constructor(
    private readonly deliveriesService: DeliveriesService, 
    private readonly simpleDeliveryFeeService: SimpleDeliveryFeeService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'employee')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new delivery',
    description:
      'Create a new delivery for an existing order. Only admins and employees can create deliveries.',
  })
  @ApiCreatedResponse({
    description: 'Delivery created successfully',
    type: DeliveryResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or business rule violation',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({
    description: 'Order not found or invalid for delivery',
  })
  @ApiConflictResponse({
    description: 'Delivery already exists for this order',
  })
  @ApiBody({ type: CreateDeliveryDto })
  async create(@Body() createDeliveryDto: CreateDeliveryDto) {
    return await this.deliveriesService.create(createDeliveryDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all deliveries',
    description:
      'Retrieve a paginated list of deliveries with optional filtering by status, employee, date range, and search terms.',
  })
  @ApiOkResponse({
    description: 'List of deliveries retrieved successfully',
    type: PaginatedDeliveryResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: DeliveryStatus,
    description: 'Filter by delivery status',
  })
  @ApiQuery({
    name: 'employeeId',
    required: false,
    type: Number,
    description: 'Filter by employee ID',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search in address, customer details, or order ID',
  })
  @ApiQuery({
    name: 'from_date',
    required: false,
    type: String,
    description: 'Filter from date (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'to_date',
    required: false,
    type: String,
    description: 'Filter to date (ISO 8601 format)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10)',
  })
  async findAll(@Query() queryDto: QueryDeliveryDto) {
    return await this.deliveriesService.findAll(queryDto);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get delivery by ID',
    description:
      'Retrieve detailed information about a specific delivery including order details, customer info, and employee assignment.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Delivery ID' })
  @ApiOkResponse({
    description: 'Delivery details retrieved successfully',
    type: DeliveryResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiNotFoundResponse({ description: 'Delivery not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.deliveriesService.findOne(id);
  }

  @Get('order/:orderId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get delivery by order ID',
    description: 'Retrieve delivery information for a specific order.',
  })
  @ApiParam({ name: 'orderId', type: 'number', description: 'Order ID' })
  @ApiOkResponse({
    description: 'Delivery details retrieved successfully',
    type: DeliveryResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiNotFoundResponse({ description: 'Delivery not found for this order' })
  async findByOrderId(@Param('orderId', ParseIntPipe) orderId: number) {
    return await this.deliveriesService.findByOrderId(orderId);
  }

  @Get(':id/location')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get delivery location',
    description:
      'Get the current location information for a delivery in progress.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Delivery ID' })
  @ApiOkResponse({
    description: 'Delivery location retrieved successfully',
    type: DeliveryLocationResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiNotFoundResponse({ description: 'Delivery not found' })
  async getLocation(@Param('id', ParseIntPipe) id: number) {
    return await this.deliveriesService.getLocation(id);
  }

  @Get(':id/location-history')
  @UseGuards(RolesGuard)
  @Roles('admin', 'employee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get delivery location history',
    description:
      'Retrieve the complete location tracking history for a delivery. Admin and employee access only.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Delivery ID' })
  @ApiOkResponse({
    description: 'Delivery location history retrieved successfully',
    type: LocationHistoryResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions - Admin/Employee only',
  })
  @ApiNotFoundResponse({ description: 'Delivery not found' })
  async getLocationHistory(@Param('id', ParseIntPipe) id: number) {
    return await this.deliveriesService.getLocationHistory(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'employee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update delivery details',
    description:
      'Update delivery information such as address, phone number, employee assignment, etc. Admin and employee access only.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Delivery ID' })
  @ApiOkResponse({
    description: 'Delivery updated successfully',
    type: DeliveryResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions - Admin/Employee only',
  })
  @ApiNotFoundResponse({
    description: 'Delivery or associated resources not found',
  })
  @ApiBody({ type: UpdateDeliveryDto })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDeliveryDto: UpdateDeliveryDto,
  ) {
    return await this.deliveriesService.update(id, updateDeliveryDto);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('admin', 'employee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update delivery status',
    description:
      'Update the status of a delivery with optional notes. Status transitions are validated according to business rules.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Delivery ID' })
  @ApiOkResponse({
    description: 'Delivery status updated successfully',
    type: DeliveryResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid status transition or missing required data (e.g., employee for out_for_delivery)',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions - Admin/Employee only',
  })
  @ApiNotFoundResponse({ description: 'Delivery not found' })
  @ApiBody({
    type: UpdateStatusDto,
    examples: {
      'Status Update': {
        value: {
          status: DeliveryStatus.PREPARING,
          notes: 'Order is being prepared by the kitchen staff',
        },
      },
    },
  })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return await this.deliveriesService.updateStatus(id, updateStatusDto);
  }

  @Patch(':id/time')
  @UseGuards(RolesGuard)
  @Roles('admin', 'employee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update delivery time',
    description:
      'Update estimated delivery time or pickup time with optional customer notification.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Delivery ID' })
  @ApiOkResponse({
    description: 'Delivery time updated successfully',
    type: DeliveryResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid time data or time in the past',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions - Admin/Employee only',
  })
  @ApiNotFoundResponse({ description: 'Delivery not found' })
  @ApiBody({ type: UpdateDeliveryTimeDto })
  async updateTime(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTimeDto: UpdateDeliveryTimeDto,
  ) {
    return await this.deliveriesService.updateTime(id, updateTimeDto);
  }

  @Patch(':id/location')
  @UseGuards(RolesGuard)
  @Roles('admin', 'employee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update delivery location',
    description:
      'Update the current GPS location of a delivery in progress. Only allowed for deliveries with status OUT_FOR_DELIVERY.',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Delivery ID' })
  @ApiOkResponse({
    description: 'Delivery location updated successfully',
    type: DeliveryLocationResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Invalid coordinates or delivery not eligible for location updates',
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description: 'Insufficient permissions - Admin/Employee only',
  })
  @ApiNotFoundResponse({ description: 'Delivery not found' })
  @ApiBody({ type: UpdateLocationDto })
  async updateLocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    return await this.deliveriesService.updateLocation(id, updateLocationDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete delivery',
    description:
      "Delete a delivery record. Only admins can delete deliveries, and only if they haven't been completed.",
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Delivery ID' })
  @ApiOkResponse({
    description: 'Delivery deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Delivery deleted successfully' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Failed to delete delivery' })
  @ApiUnauthorizedResponse({ description: 'Authentication required' })
  @ApiForbiddenResponse({
    description:
      'Insufficient permissions - Admin only, or delivery cannot be deleted',
  })
  @ApiNotFoundResponse({ description: 'Delivery not found' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return await this.deliveriesService.remove(id);
  }

  @Get('status/active')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get active deliveries',
    description:
      'Retrieve all deliveries that are currently active (not delivered or cancelled).',
  })
  @ApiOkResponse({
    description: 'Active deliveries retrieved successfully',
    type: [DeliveryResponseDto],
  })
  async getActiveDeliveries() {
    const queryDto = new QueryDeliveryDto();
    queryDto.limit = 100;

    const result = await this.deliveriesService.findAll(queryDto);

    const activeStatuses = [
      DeliveryStatus.PENDING,
      DeliveryStatus.PREPARING,
      DeliveryStatus.OUT_FOR_DELIVERY,
    ];

    const activeDeliveries = result.data.filter((delivery) =>
      activeStatuses.includes(delivery.status as DeliveryStatus),
    );

    return {
      data: activeDeliveries,
      count: activeDeliveries.length,
    };
  }

  @Get('employee/:employeeId/active')
  @UseGuards(RolesGuard)
  @Roles('admin', 'employee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get active deliveries for employee',
    description:
      'Retrieve all active deliveries assigned to a specific employee.',
  })
  @ApiParam({ name: 'employeeId', type: 'number', description: 'Employee ID' })
  @ApiOkResponse({
    description: 'Employee active deliveries retrieved successfully',
    type: [DeliveryResponseDto],
  })
  async getEmployeeActiveDeliveries(
    @Param('employeeId', ParseIntPipe) employeeId: number,
  ) {
    const queryDto = new QueryDeliveryDto();
    queryDto.employeeId = employeeId;
    queryDto.limit = 50;

    const result = await this.deliveriesService.findAll(queryDto);

    const activeStatuses = [
      DeliveryStatus.PENDING,
      DeliveryStatus.PREPARING,
      DeliveryStatus.OUT_FOR_DELIVERY,
    ];

    const activeDeliveries = result.data.filter((delivery) =>
      activeStatuses.includes(delivery.status as DeliveryStatus),
    );

    return {
      data: activeDeliveries,
      count: activeDeliveries.length,
    };
  }

  @Get('analytics/summary')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get delivery analytics summary',
    description:
      'Get summary statistics for deliveries including counts by status and performance metrics.',
  })
  @ApiOkResponse({
    description: 'Delivery analytics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalDeliveries: { type: 'number' },
        statusBreakdown: {
          type: 'object',
          properties: {
            pending: { type: 'number' },
            preparing: { type: 'number' },
            out_for_delivery: { type: 'number' },
            delivered: { type: 'number' },
            cancelled: { type: 'number' },
          },
        },
        avgDeliveryTime: {
          type: 'number',
          description: 'Average delivery time in minutes',
        },
        onTimeDeliveryRate: {
          type: 'number',
          description: 'Percentage of on-time deliveries',
        },
      },
    },
  })
  @ApiQuery({
    name: 'days',
    required: false,
    type: Number,
    description: 'Number of days to analyze (default: 30)',
  })
  async getDeliveryAnalytics(@Query('days') days: number = 30) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const queryDto = new QueryDeliveryDto();
    queryDto.from_date = fromDate.toISOString();
    queryDto.limit = 1000;

    const result = await this.deliveriesService.findAll(queryDto);

    const statusBreakdown = result.data.reduce(
      (acc, delivery) => {
        acc[delivery.status] = (acc[delivery.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalDeliveries: result.pagination.totalCount,
      statusBreakdown,
      period: `Last ${days} days`,
      avgDeliveryTime: null,
      onTimeDeliveryRate: null,
    };
  }

// ===== DELIVERY FEE SETTINGS ENDPOINTS =====

  @Get('settings/delivery-fee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get delivery fee settings',
    description: 'Retrieve current delivery fee configuration'
  })
  @ApiOkResponse({
    description: 'Delivery fee settings retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        baseFee: { type: 'number', example: 6000 },
        perKmFee: { type: 'number', example: 2000 },
        freeDistance: { type: 'number', example: 3 },
        restaurantLat: { type: 'number', example: 19.8845 },
        restaurantLng: { type: 'number', example: 102.135 }
      }
    }
  })
  async getDeliveryFeeSettings() {
    try {
      const settings = await this.simpleDeliveryFeeService.getDeliverySettings();
      console.log('📤 Controller - Sending delivery settings:', settings);
      return settings;
    } catch (error) {
      console.error('❌ Controller - Error getting settings:', error);
      throw error;
    }
  }

  @Patch('settings/delivery-fee')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update delivery fee settings',
    description: 'Update delivery fee configuration (Admin only)'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        baseFee: { type: 'number', example: 6000, description: 'Base delivery fee in LAK' },
        perKmFee: { type: 'number', example: 2000, description: 'Fee per kilometer in LAK' },
        freeDistance: { type: 'number', example: 3, description: 'Free delivery distance in KM' },
        restaurantLat: { type: 'number', example: 19.8845, description: 'Restaurant latitude' },
        restaurantLng: { type: 'number', example: 102.135, description: 'Restaurant longitude' }
      }
    }
  })
  @ApiOkResponse({
    description: 'Settings updated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Updated 3 settings successfully' },
        settings: {
          type: 'object',
          properties: {
            baseFee: { type: 'number' },
            perKmFee: { type: 'number' },
            freeDistance: { type: 'number' },
            restaurantLat: { type: 'number' },
            restaurantLng: { type: 'number' }
          }
        },
        updatedCount: { type: 'number', example: 3 }
      }
    }
  })
  async updateDeliveryFeeSettings(@Body() settings: {
    baseFee?: number;
    perKmFee?: number;
    freeDistance?: number;
    restaurantLat?: number;
    restaurantLng?: number;
  }) {
    try {
      console.log('📥 Controller - Received settings update:', settings);
      
      // Log each setting being updated
      Object.entries(settings).forEach(([key, value]) => {
        if (value !== undefined) {
          console.log(`🔧 Updating ${key}: ${value}`);
        }
      });

      const result = await this.simpleDeliveryFeeService.updateDeliverySettings(settings);
      
      console.log('✅ Controller - Settings updated successfully:', result);
      return result;

    } catch (error) {
      console.error('❌ Controller - Error updating settings:', error);
      throw error;
    }
  }

  @Post('calculate-fee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate delivery fee',
    description: 'Calculate delivery fee based on customer location'
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        customer_latitude: { type: 'number', example: 19.8845 },
        customer_longitude: { type: 'number', example: 102.135 },
      },
      required: ['customer_latitude', 'customer_longitude'],
    },
  })
  @ApiOkResponse({
    description: 'Delivery fee calculated successfully',
    schema: {
      type: 'object',
      properties: {
        distance_meters: { type: 'number', example: 2500 },
        distance_km: { type: 'string', example: '2.5' },
        estimated_time_minutes: { type: 'number', example: 20 },
        delivery_fee_lak: { type: 'number', example: 6000 },
        is_within_delivery_area: { type: 'boolean', example: true },
        formatted_fee: { type: 'string', example: '6,000 LAK' },
        breakdown: {
          type: 'object',
          properties: {
            base_fee: { type: 'number', example: 6000 },
            distance_fee: { type: 'number', example: 0 },
            free_distance_km: { type: 'number', example: 3 },
            chargeable_distance: { type: 'number', example: 0 }
          }
        }
      }
    }
  })
  async calculateDeliveryFee(
    @Body()
    locationDto: {
      customer_latitude: number;
      customer_longitude: number;
    },
  ) {
    try {
      console.log('🧮 Controller - Calculating fee for:', locationDto);

      const result = await this.simpleDeliveryFeeService.calculateDeliveryFee(
        locationDto.customer_latitude,
        locationDto.customer_longitude
      );

      const response = {
        distance_meters: Math.round(result.distance * 1000),
        distance_km: result.distance.toFixed(1),
        estimated_time_minutes: result.estimatedTime,
        delivery_fee_lak: result.deliveryFee,
        is_within_delivery_area: result.isWithinDeliveryArea,
        formatted_fee: `${result.deliveryFee.toLocaleString()} LAK`,
        breakdown: {
          base_fee: result.breakdown.baseFee,
          distance_fee: result.breakdown.distanceFee,
          free_distance_km: result.breakdown.freeDistance,
          chargeable_distance: Math.max(0, result.distance - result.breakdown.freeDistance)
        }
      };

      console.log('📤 Controller - Sending calculation result:', response);
      return response;

    } catch (error) {
      console.error('❌ Controller - Error calculating fee:', error);
      throw error;
    }
  }

  // ===== DEBUG ENDPOINTS (เพิ่มใหม่) =====

  @Get('settings/debug')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Debug delivery settings',
    description: 'Get all delivery-related settings for debugging (Admin only)'
  })
  async debugDeliverySettings() {
    try {
      console.log('🔍 Debug - Getting all delivery settings');
      const settings = await this.simpleDeliveryFeeService.debugSettings();
      console.log('📊 Debug - Found settings:', settings);
      return {
        success: true,
        count: settings.length,
        settings: settings
      };
    } catch (error) {
      console.error('❌ Debug - Error:', error);
      throw error;
    }
  }

  @Post('settings/reset-default')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset delivery settings to default',
    description: 'Reset all delivery settings to default values (Admin only)'
  })
  async resetDeliverySettingsToDefault() {
    try {
      console.log('🔄 Reset - Resetting settings to default');
      const result = await this.simpleDeliveryFeeService.resetToDefault();
      console.log('✅ Reset - Settings reset successfully:', result);
      return result;
    } catch (error) {
      console.error('❌ Reset - Error:', error);
      throw error;
    }
  }

  @Get('settings/test-calculation/:lat/:lng')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test delivery fee calculation',
    description: 'Test delivery fee calculation with specific coordinates'
  })
  async testDeliveryCalculation(
    @Param('lat') lat: string,
    @Param('lng') lng: string
  ) {
    try {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      
      console.log(`🧪 Test - Calculating for: ${latitude}, ${longitude}`);

      const result = await this.simpleDeliveryFeeService.calculateDeliveryFee(latitude, longitude);
      
      console.log('📊 Test - Calculation result:', result);
      
      return {
        input: { latitude, longitude },
        result: result,
        formatted: {
          distance: `${result.distance.toFixed(1)} km`,
          fee: `${result.deliveryFee.toLocaleString()} LAK`,
          time: `${result.estimatedTime} minutes`,
          inServiceArea: result.isWithinDeliveryArea ? 'Yes' : 'No'
        }
      };
    } catch (error) {
      console.error('❌ Test - Error:', error);
      throw error;
    }
  }
/*   @Post('calculate-fee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate delivery fee',
    description: 'Calculate delivery fee based on customer location',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        customer_latitude: { type: 'number', example: 19.8845 },
        customer_longitude: { type: 'number', example: 102.135 },
      },
      required: ['customer_latitude', 'customer_longitude'],
    },
  })
  @Post('calculate-fee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Calculate delivery fee',
    description: 'Calculate delivery fee based on customer location',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        customer_latitude: { type: 'number', example: 19.8845 },
        customer_longitude: { type: 'number', example: 102.135 },
      },
      required: ['customer_latitude', 'customer_longitude'],
    },
  })
  async calculateDeliveryFee(
    @Body()
    locationDto: {
      customer_latitude: number;
      customer_longitude: number;
    },
  ) {
    const deliveryInfo =
      // eslint-disable-next-line @typescript-eslint/await-thenable
      await this.deliveriesService.calculateDeliveryFeeForLocation(
        locationDto.customer_latitude,
        locationDto.customer_longitude,
      );

    return {
      distance_meters: deliveryInfo.distance,
      distance_km: (deliveryInfo.distance / 1000).toFixed(1),
      estimated_time_minutes: deliveryInfo.estimatedTime,
      delivery_fee_lak: deliveryInfo.deliveryFee,
      is_within_delivery_area: deliveryInfo.isWithinDeliveryArea,
      formatted_fee: `${deliveryInfo.deliveryFee.toLocaleString()} LAK`,
    };
  } */
}
