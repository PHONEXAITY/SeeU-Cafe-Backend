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
import { BlogCategoriesService } from './blog-categories.service';
import { CreateBlogCategoryDto } from './dto/create-blog-category.dto';
import { UpdateBlogCategoryDto } from './dto/update-blog-category.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('Blog Categories')
@Controller('blog-categories')
export class BlogCategoriesController {
  constructor(private readonly blogCategoriesService: BlogCategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new blog category (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Blog category created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  create(@Body() createBlogCategoryDto: CreateBlogCategoryDto) {
    return this.blogCategoriesService.create(createBlogCategoryDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all blog categories' })
  @ApiResponse({ status: 200, description: 'List of blog categories' })
  findAll() {
    return this.blogCategoriesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a blog category by ID' })
  @ApiResponse({ status: 200, description: 'Blog category details' })
  @ApiResponse({ status: 404, description: 'Blog category not found' })
  findOne(@Param('id') id: string) {
    return this.blogCategoriesService.findOne(+id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a blog category by slug' })
  @ApiResponse({ status: 200, description: 'Blog category details' })
  @ApiResponse({ status: 404, description: 'Blog category not found' })
  findBySlug(@Param('slug') slug: string) {
    return this.blogCategoriesService.findBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a blog category (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Blog category updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Blog category not found' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  update(
    @Param('id') id: string,
    @Body() updateBlogCategoryDto: UpdateBlogCategoryDto,
  ) {
    return this.blogCategoriesService.update(+id, updateBlogCategoryDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a blog category (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Blog category deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Blog category not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete with associated blogs',
  })
  remove(@Param('id') id: string) {
    return this.blogCategoriesService.remove(+id);
  }
}
