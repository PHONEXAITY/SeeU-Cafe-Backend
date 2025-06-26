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
import { MenuCategoriesService } from './menu-categories.service';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
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

@ApiTags('Menu Categories')
@Controller('menu-categories')
export class MenuCategoriesController {
  constructor(private readonly menuCategoriesService: MenuCategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new menu category (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Menu category created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Parent category not found' })
  create(@Body() createMenuCategoryDto: CreateMenuCategoryDto) {
    return this.menuCategoriesService.create(createMenuCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all menu categories' })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by type (food, beverage)',
  })
  @ApiResponse({ status: 200, description: 'List of menu categories' })
  findAll(@Query('type') type?: string) {
    return this.menuCategoriesService.findAll(type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a menu category by ID' })
  @ApiResponse({ status: 200, description: 'Menu category details' })
  @ApiResponse({ status: 404, description: 'Menu category not found' })
  findOne(@Param('id') id: string) {
    return this.menuCategoriesService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a menu category (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Menu category updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Menu category not found' })
  @ApiResponse({ status: 409, description: 'Conflict - circular reference' })
  update(
    @Param('id') id: string,
    @Body() updateMenuCategoryDto: UpdateMenuCategoryDto,
  ) {
    return this.menuCategoriesService.update(+id, updateMenuCategoryDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a menu category (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Menu category deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Menu category not found' })
  @ApiResponse({
    status: 409,
    description: 'Conflict - cannot delete with associated items',
  })
  remove(@Param('id') id: string) {
    return this.menuCategoriesService.remove(+id);
  }
}
