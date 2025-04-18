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
import { CustomerNotificationsService } from './customer-notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Customer Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CustomerNotificationsController {
  constructor(
    private readonly notificationsService: CustomerNotificationsService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin', 'employee')
  @ApiOperation({ summary: 'Create a new notification (Admin or Employee)' })
  @ApiResponse({
    status: 201,
    description: 'Notification created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.create(createNotificationDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin', 'employee')
  @ApiOperation({ summary: 'Get all notifications (Admin or Employee)' })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by user ID',
  })
  @ApiQuery({
    name: 'read',
    required: false,
    description: 'Filter by read status (true or false)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by notification type',
  })
  @ApiResponse({ status: 200, description: 'List of notifications' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(
    @Query('userId') userId?: string,
    @Query('read') read?: string,
    @Query('type') type?: string,
  ) {
    const readBoolean = read ? read === 'true' : undefined;

    return this.notificationsService.findAll(
      userId ? +userId : undefined,
      readBoolean,
      type,
    );
  }

  @Get('user/:userId')
  @ApiOperation({ summary: "Get a user's notifications" })
  @ApiResponse({ status: 200, description: 'List of notifications' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findAllByUser(@Param('userId') userId: string) {
    return this.notificationsService.findAllByUser(+userId);
  }

  @Get('user/:userId/unread')
  @ApiOperation({ summary: "Get a user's unread notifications" })
  @ApiResponse({ status: 200, description: 'List of unread notifications' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findUnreadByUser(@Param('userId') userId: string) {
    return this.notificationsService.findUnreadByUser(+userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a notification by ID' })
  @ApiResponse({ status: 200, description: 'Notification details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  findOne(@Param('id') id: string) {
    return this.notificationsService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin', 'employee')
  @ApiOperation({ summary: 'Update a notification (Admin or Employee)' })
  @ApiResponse({
    status: 200,
    description: 'Notification updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  update(
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
  ) {
    return this.notificationsService.update(+id, updateNotificationDto);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(+id);
  }

  @Patch('user/:userId/read-all')
  @ApiOperation({ summary: "Mark all of a user's notifications as read" })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  markAllAsRead(@Param('userId') userId: string) {
    return this.notificationsService.markAllAsRead(+userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  remove(@Param('id') id: string) {
    return this.notificationsService.remove(+id);
  }

  @Delete('user/:userId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: "Delete all of a user's notifications (Admin only)",
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  removeAllByUser(@Param('userId') userId: string) {
    return this.notificationsService.removeAllByUser(+userId);
  }
}
