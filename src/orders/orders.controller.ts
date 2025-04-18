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
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateTimeDto } from './dto/update-time.dto';
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

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Related entity not found' })
  create(@Body() createOrderDto: CreateOrderDto) {
    return this.ordersService.create(createOrderDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all orders' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by user ID',
  })
  @ApiQuery({
    name: 'employeeId',
    required: false,
    description: 'Filter by employee ID',
  })
  @ApiQuery({
    name: 'orderType',
    required: false,
    description: 'Filter by order type (pickup, delivery, table)',
  })
  @ApiResponse({ status: 200, description: 'List of orders' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('orderType') orderType?: string,
  ) {
    return this.ordersService.findAll(
      status,
      userId ? +userId : undefined,
      employeeId ? +employeeId : undefined,
      orderType,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get an order by ID' })
  @ApiResponse({ status: 200, description: 'Order details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(+id);
  }

  @Get('order-id/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get an order by order_id string' })
  @ApiResponse({ status: 200, description: 'Order details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  findByOrderId(@Param('orderId') orderId: string) {
    return this.ordersService.findByOrderId(orderId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an order' })
  @ApiResponse({ status: 200, description: 'Order updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  update(@Param('id') id: string, @Body() updateOrderDto: UpdateOrderDto) {
    return this.ordersService.update(+id, updateOrderDto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update order status' })
  @ApiResponse({
    status: 200,
    description: 'Order status updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'cooking' },
        employeeId: { type: 'number', example: 1 },
        notes: { type: 'string', example: 'Started preparation' },
      },
      required: ['status'],
    },
  })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('employeeId') employeeId?: number,
    @Body('notes') notes?: string,
  ) {
    return this.ordersService.updateStatus(+id, status, employeeId, notes);
  }

  @Patch(':id/time')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update order time' })
  @ApiResponse({
    status: 200,
    description: 'Order time updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  updateTime(@Param('id') id: string, @Body() updateTimeDto: UpdateTimeDto) {
    return this.ordersService.updateTime(+id, updateTimeDto);
  }

  @Post(':id/timeline')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add timeline entry to an order' })
  @ApiResponse({
    status: 201,
    description: 'Timeline entry added successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'cooking' },
        employeeId: { type: 'number', example: 1 },
        notes: { type: 'string', example: 'Started preparation' },
      },
      required: ['status'],
    },
  })
  createTimeline(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('employeeId') employeeId?: number,
    @Body('notes') notes?: string,
  ) {
    return this.ordersService.createOrderTimeline(
      +id,
      status,
      employeeId,
      notes,
    );
  }

  @Patch(':id/details/:detailId/ready')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark an order item as ready' })
  @ApiResponse({
    status: 200,
    description: 'Order item marked as ready',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order or order item not found' })
  markItemReady(@Param('id') id: string, @Param('detailId') detailId: string) {
    return this.ordersService.markOrderItemReady(+id, +detailId);
  }

  @Post(':id/pickup-code')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate pickup code for an order' })
  @ApiResponse({
    status: 201,
    description: 'Pickup code generated successfully',
  })
  @ApiResponse({ status: 400, description: 'Not a pickup order' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  generatePickupCode(@Param('id') id: string) {
    return this.ordersService.assignPickupCode(+id);
  }

  @Post(':id/history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create order history record' })
  @ApiResponse({
    status: 201,
    description: 'Order history created successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  createHistory(@Param('id') id: string) {
    return this.ordersService.createOrderHistory(+id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an order (Admin only)' })
  @ApiResponse({ status: 200, description: 'Order deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  remove(@Param('id') id: string) {
    return this.ordersService.remove(+id);
  }
}
