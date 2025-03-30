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
import { BeverageMenuService } from './beverage-menu.service';
import { CreateBeverageMenuDto } from './dto/create-beverage-menu.dto';
import { UpdateBeverageMenuDto } from './dto/update-beverage-menu.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Beverage Menu')
@Controller('beverage-menu')
export class BeverageMenuController {
  constructor(private readonly beverageMenuService: BeverageMenuService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new beverage menu item (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Beverage menu item created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  create(@Body() createBeverageMenuDto: CreateBeverageMenuDto) {
    return this.beverageMenuService.create(createBeverageMenuDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all beverage menu items' })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: Number,
    description: 'Filter by category ID',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (active, inactive)',
  })
  @ApiResponse({ status: 200, description: 'List of beverage menu items' })
  findAll(
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
  ) {
    return this.beverageMenuService.findAll(
      categoryId ? +categoryId : undefined,
      status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a beverage menu item by ID' })
  @ApiResponse({ status: 200, description: 'Beverage menu item details' })
  @ApiResponse({ status: 404, description: 'Beverage menu item not found' })
  findOne(@Param('id') id: string) {
    return this.beverageMenuService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a beverage menu item (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Beverage menu item updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Beverage menu item not found' })
  update(
    @Param('id') id: string,
    @Body() updateBeverageMenuDto: UpdateBeverageMenuDto,
  ) {
    return this.beverageMenuService.update(+id, updateBeverageMenuDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a beverage menu item (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Beverage menu item deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Beverage menu item not found' })
  remove(@Param('id') id: string) {
    return this.beverageMenuService.remove(+id);
  }
}
