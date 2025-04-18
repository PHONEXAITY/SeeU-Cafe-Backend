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
import { OrderDetailsService } from './order-details.service';
import { CreateOrderDetailDto } from './dto/create-order-detail.dto';
import { UpdateOrderDetailDto } from './dto/update-order-detail.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Order Details')
@Controller('orders/:orderId/details')
export class OrderDetailsController {
  constructor(private readonly orderDetailsService: OrderDetailsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add an item to an order' })
  @ApiResponse({ status: 201, description: 'Order item added successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order or menu item not found' })
  create(
    @Param('orderId') orderId: string,
    @Body() createOrderDetailDto: CreateOrderDetailDto,
  ) {
    return this.orderDetailsService.create(+orderId, createOrderDetailDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all items in an order' })
  @ApiResponse({ status: 200, description: 'List of order items' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  findAll(@Param('orderId') orderId: string) {
    return this.orderDetailsService.findAll(+orderId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get an order item by ID' })
  @ApiResponse({ status: 200, description: 'Order item details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order item not found' })
  findOne(@Param('id') id: string) {
    return this.orderDetailsService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an order item' })
  @ApiResponse({ status: 200, description: 'Order item updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order item not found' })
  update(
    @Param('id') id: string,
    @Body() updateOrderDetailDto: UpdateOrderDetailDto,
  ) {
    return this.orderDetailsService.update(+id, updateOrderDetailDto);
  }

  @Patch(':id/ready')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark an order item as ready' })
  @ApiResponse({ status: 200, description: 'Order item marked as ready' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order item not found' })
  markReady(@Param('id') id: string) {
    return this.orderDetailsService.markReady(+id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove an item from an order' })
  @ApiResponse({ status: 200, description: 'Order item removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order item not found' })
  remove(@Param('id') id: string) {
    return this.orderDetailsService.remove(+id);
  }
}
