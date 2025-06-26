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
import { FoodMenuService } from './food-menu.service';
import { CreateFoodMenuDto } from './dto/create-food-menu.dto';
import { UpdateFoodMenuDto } from './dto/update-food-menu.dto';
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

@ApiTags('Food Menu')
@Controller('food-menu')
export class FoodMenuController {
  constructor(private readonly foodMenuService: FoodMenuService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new food menu item (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Food menu item created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  create(@Body() createFoodMenuDto: CreateFoodMenuDto) {
    return this.foodMenuService.create(createFoodMenuDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all food menu items' })
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
  @ApiResponse({ status: 200, description: 'List of food menu items' })
  findAll(
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: string,
  ) {
    return this.foodMenuService.findAll(
      categoryId ? +categoryId : undefined,
      status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a food menu item by ID' })
  @ApiResponse({ status: 200, description: 'Food menu item details' })
  @ApiResponse({ status: 404, description: 'Food menu item not found' })
  findOne(@Param('id') id: string) {
    return this.foodMenuService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a food menu item (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Food menu item updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Food menu item not found' })
  update(
    @Param('id') id: string,
    @Body() updateFoodMenuDto: UpdateFoodMenuDto,
  ) {
    return this.foodMenuService.update(+id, updateFoodMenuDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a food menu item (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Food menu item deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Food menu item not found' })
  remove(@Param('id') id: string) {
    return this.foodMenuService.remove(+id);
  }
}
