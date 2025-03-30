import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { UserActivityService } from './user-activity.service';
import { CreateUserActivityDto } from './dto/create-user-activity.dto';
import { UpdateUserActivityDto } from './dto/update-user-activity.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody, // เพิ่ม ApiBody เข้ามา
} from '@nestjs/swagger';

@ApiTags('User Activity')
@Controller('user-activity')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserActivityController {
  constructor(private readonly userActivityService: UserActivityService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a user activity record (Authenticated users)',
  })
  @ApiResponse({
    status: 201,
    description: 'User activity created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  create(@Body() createUserActivityDto: CreateUserActivityDto, @Req() req) {
    // Add IP and user agent from request if not provided
    if (!createUserActivityDto.ip_address) {
      createUserActivityDto.ip_address = req.ip;
    }
    if (!createUserActivityDto.user_agent) {
      createUserActivityDto.user_agent = req.headers['user-agent'];
    }

    return this.userActivityService.create(createUserActivityDto);
  }

  @Post('log')
  @ApiOperation({ summary: 'Log a user activity (Authenticated users)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        user_id: { type: 'integer' },
        activity_type: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['user_id', 'activity_type'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User activity logged successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  logActivity(
    @Body('user_id') userId: number,
    @Body('activity_type') activityType: string,
    @Body('description') description: string,
    @Req() req,
  ) {
    return this.userActivityService.logActivity(
      userId,
      activityType,
      description,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get all user activities (Admin only)' })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by user ID',
  })
  @ApiQuery({
    name: 'activityType',
    required: false,
    description: 'Filter by activity type',
  })
  @ApiResponse({ status: 200, description: 'List of user activities' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(
    @Query('userId') userId?: string, // กำหนด type เป็น string | undefined
    @Query('activityType') activityType?: string, // กำหนด type เป็น string | undefined
  ) {
    return this.userActivityService.findAll(
      userId ? +userId : undefined,
      activityType,
    );
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get user activity statistics (Admin only)' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Number of days to include in statistics',
  })
  @ApiResponse({ status: 200, description: 'User activity statistics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getStats(@Query('days') days?: string) {
    return this.userActivityService.getActivityStats(days ? +days : undefined);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get activities by user ID (Authenticated users)' })
  @ApiResponse({ status: 200, description: 'List of user activities' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findByUserId(@Param('userId') userId: string) {
    return this.userActivityService.findByUserId(+userId);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get a user activity by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'User activity details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User activity not found' })
  findOne(@Param('id') id: string) {
    return this.userActivityService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update a user activity (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User activity updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User activity or user not found' })
  update(
    @Param('id') id: string,
    @Body() updateUserActivityDto: UpdateUserActivityDto,
  ) {
    return this.userActivityService.update(+id, updateUserActivityDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Delete a user activity (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User activity deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User activity not found' })
  remove(@Param('id') id: string) {
    return this.userActivityService.remove(+id);
  }

  @Delete('cleanup/:days')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Clean up old user activities (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Old activities cleaned up successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  cleanup(@Param('days') days: string) {
    return this.userActivityService.cleanupOldActivities(+days);
  }
}
