import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { OrderTimelineService } from './order-timeline.service';
import { CreateOrderTimelineDto } from './dto/create-order-timeline.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Order Timeline')
@Controller('order-timeline')
export class OrderTimelineController {
  constructor(private readonly orderTimelineService: OrderTimelineService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new order timeline entry' })
  @ApiResponse({
    status: 201,
    description: 'Order timeline entry created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  create(@Body() createOrderTimelineDto: CreateOrderTimelineDto) {
    return this.orderTimelineService.create(createOrderTimelineDto);
  }

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all timeline entries for an order' })
  @ApiResponse({ status: 200, description: 'List of timeline entries' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  findAllByOrderId(@Param('orderId') orderId: string) {
    return this.orderTimelineService.findAllByOrderId(+orderId);
  }

  @Get('status/:status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all timeline entries with a specific status' })
  @ApiResponse({ status: 200, description: 'List of timeline entries' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAllByStatus(@Param('status') status: string) {
    return this.orderTimelineService.findAllByStatus(status);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a timeline entry by ID' })
  @ApiResponse({ status: 200, description: 'Timeline entry details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Timeline entry not found' })
  findOne(@Param('id') id: string) {
    return this.orderTimelineService.findOne(+id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a timeline entry (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Timeline entry deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Timeline entry not found' })
  remove(@Param('id') id: string) {
    return this.orderTimelineService.remove(+id);
  }
}
