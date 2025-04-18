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
import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { UpdateTableTimeDto } from './dto/update-table-time.dto';
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

@ApiTags('Tables')
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new table (Admin only)' })
  @ApiResponse({ status: 201, description: 'Table created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Table number already exists' })
  create(@Body() createTableDto: CreateTableDto) {
    return this.tablesService.create(createTableDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all tables' })
  @ApiQuery({
    name: 'status',
    required: false,
    description:
      'Filter by status (available, occupied, reserved, maintenance)',
  })
  @ApiResponse({ status: 200, description: 'List of tables' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAll(@Query('status') status?: string) {
    return this.tablesService.findAll(status);
  }

  @Get('available')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all available tables' })
  @ApiQuery({
    name: 'capacity',
    required: false,
    description: 'Minimum capacity required',
  })
  @ApiResponse({ status: 200, description: 'List of available tables' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  findAvailableTables(@Query('capacity') capacity?: string) {
    return this.tablesService.findAvailableTables(
      capacity ? +capacity : undefined,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a table by ID' })
  @ApiResponse({ status: 200, description: 'Table details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  findOne(@Param('id') id: string) {
    return this.tablesService.findOne(+id);
  }

  @Get('number/:number')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a table by number' })
  @ApiResponse({ status: 200, description: 'Table details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  findByNumber(@Param('number') number: string) {
    return this.tablesService.findByNumber(+number);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a table (Admin only)' })
  @ApiResponse({ status: 200, description: 'Table updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  @ApiResponse({ status: 409, description: 'Table number already exists' })
  update(@Param('id') id: string, @Body() updateTableDto: UpdateTableDto) {
    return this.tablesService.update(+id, updateTableDto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update table status' })
  @ApiResponse({
    status: 200,
    description: 'Table status updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.tablesService.updateStatus(+id, status);
  }

  @Patch(':id/time')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update table session time' })
  @ApiResponse({
    status: 200,
    description: 'Table time updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  updateTime(
    @Param('id') id: string,
    @Body() updateTimeDto: UpdateTableTimeDto,
  ) {
    return this.tablesService.updateTime(+id, updateTimeDto);
  }

  @Post(':id/start-session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a new table session' })
  @ApiResponse({
    status: 201,
    description: 'Table session started successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  startSession(@Param('id') id: string) {
    return this.tablesService.startSession(+id);
  }

  @Post(':id/end-session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'End a table session' })
  @ApiResponse({
    status: 201,
    description: 'Table session ended successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot end session with active orders',
  })
  endSession(@Param('id') id: string) {
    return this.tablesService.endSession(+id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a table (Admin only)' })
  @ApiResponse({ status: 200, description: 'Table deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete with associated orders',
  })
  remove(@Param('id') id: string) {
    return this.tablesService.remove(+id);
  }
}
