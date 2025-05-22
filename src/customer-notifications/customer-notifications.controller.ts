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
  Request,
  ForbiddenException,
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
  async create(
    @Body() createNotificationDto: CreateNotificationDto,
    @Request() req,
  ) {
    if (createNotificationDto.target_roles) {
      const userRole = req.user.role;
      const canSendToRoles = this.validateRolePermissions(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        userRole,
        createNotificationDto.target_roles,
      );
      if (!canSendToRoles) {
        throw new ForbiddenException(
          'You do not have permission to send notifications to these roles.',
        );
      }
    }
    return this.notificationsService.create(createNotificationDto);
  }

  private validateRolePermissions(
    userRole: string,
    targetRoles: string[],
  ): boolean {
    if (userRole === 'admin') return true;

    if (userRole === 'employee') {
      return targetRoles.every((role) => role === 'customer');
    }

    return false;
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
    @Query('include_broadcast') includeBroadcast?: string,
  ) {
    const readBoolean = read ? read === 'true' : undefined;
    const includeBroadcastBoolean = includeBroadcast === 'true';

    return this.notificationsService.findAll(
      userId ? +userId : undefined,
      readBoolean,
      type,
      includeBroadcastBoolean,
    );
  }

  @Get('broadcast')
  @ApiOperation({ summary: 'Get all broadcast notifications' })
  @ApiResponse({ status: 200, description: 'List of broadcast notifications' })
  findAllBroadcast() {
    return this.notificationsService.findAllBroadcast();
  }

  @Get('roles')
  @ApiOperation({ summary: 'Get notifications for specific roles' })
  @ApiQuery({
    name: 'role',
    required: true,
    description: 'Role name to filter by',
    isArray: true,
  })
  @ApiResponse({ status: 200, description: 'List of role-based notifications' })
  findByRoles(@Query('role') roles: string[]) {
    return this.notificationsService.findByRoles(roles);
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
  findUnreadByUser(
    @Param('userId') userId: string,
    @Query('include_broadcast') includeBroadcast?: string,
  ) {
    const includeBroadcastBoolean = includeBroadcast === 'true';
    return this.notificationsService.findUnreadByUser(
      +userId,
      includeBroadcastBoolean,
    );
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
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Delete a notification (Admin only)' })
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
