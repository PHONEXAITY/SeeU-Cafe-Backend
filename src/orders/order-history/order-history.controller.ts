import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { OrderHistoryService } from './order-history.service';
import { CreateOrderHistoryDto } from './dto/create-order-history.dto';
import { UpdateOrderHistoryDto } from './dto/update-order-history.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Order History')
@Controller('order-history')
export class OrderHistoryController {
  constructor(private readonly orderHistoryService: OrderHistoryService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new order history record' })
  @ApiResponse({
    status: 201,
    description: 'Order history record created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  create(@Body() createOrderHistoryDto: CreateOrderHistoryDto) {
    return this.orderHistoryService.create(createOrderHistoryDto);
  }

  @Post('from-order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create order history from an existing order' })
  @ApiResponse({
    status: 201,
    description: 'Order history created from order successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'Order not found or no user associated',
  })
  createFromOrder(@Param('orderId') orderId: string) {
    return this.orderHistoryService.createFromOrder(+orderId);
  }

  @Get('user/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all order history for a user' })
  @ApiResponse({ status: 200, description: 'List of order history records' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findAllByUser(@Param('userId') userId: string) {
    return this.orderHistoryService.findAllByUser(+userId);
  }

  @Get('user/:userId/favorites')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all favorite orders for a user' })
  @ApiResponse({
    status: 200,
    description: 'List of favorite order history records',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findFavoritesByUser(@Param('userId') userId: string) {
    return this.orderHistoryService.findFavoritesByUser(+userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get an order history record by ID' })
  @ApiResponse({ status: 200, description: 'Order history details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order history not found' })
  findOne(@Param('id') id: string) {
    return this.orderHistoryService.findOne(+id);
  }

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get order history by original order ID' })
  @ApiResponse({ status: 200, description: 'Order history details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order history not found' })
  findByOrderId(@Param('orderId') orderId: string) {
    return this.orderHistoryService.findByOrderId(orderId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an order history record' })
  @ApiResponse({
    status: 200,
    description: 'Order history updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order history not found' })
  update(
    @Param('id') id: string,
    @Body() updateOrderHistoryDto: UpdateOrderHistoryDto,
  ) {
    return this.orderHistoryService.update(+id, updateOrderHistoryDto);
  }

  @Patch(':id/toggle-favorite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle favorite status of an order history' })
  @ApiResponse({
    status: 200,
    description: 'Favorite status toggled successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order history not found' })
  toggleFavorite(@Param('id') id: string) {
    return this.orderHistoryService.toggleFavorite(+id);
  }

  @Patch(':id/increment-reorder')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Increment reorder count of an order history' })
  @ApiResponse({
    status: 200,
    description: 'Reorder count incremented successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order history not found' })
  incrementReorderCount(@Param('id') id: string) {
    return this.orderHistoryService.incrementReorderCount(+id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an order history record (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Order history deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order history not found' })
  remove(@Param('id') id: string) {
    return this.orderHistoryService.remove(+id);
  }
}
