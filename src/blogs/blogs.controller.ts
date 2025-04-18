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
import { BlogsService } from './blogs.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
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

@ApiTags('Blogs')
@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new blog post (Admin only)' })
  @ApiResponse({ status: 201, description: 'Blog post created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  create(@Body() createBlogDto: CreateBlogDto) {
    return this.blogsService.create(createBlogDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all blog posts' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (draft, published, archived)',
  })
  @ApiQuery({
    name: 'categoryId',
    required: false,
    type: Number,
    description: 'Filter by category ID',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    description: 'Sort field (e.g., created_at)',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    description: 'Sort order (asc, desc)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of blog posts with pagination',
  })
  findAll(
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('sort') sort: string = 'created_at',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const categoryIdNum = categoryId ? parseInt(categoryId, 10) : undefined;

    return this.blogsService.findAll({
      status,
      categoryId: categoryIdNum,
      page: pageNum,
      limit: limitNum,
      sort,
      order,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a blog post by ID' })
  @ApiResponse({ status: 200, description: 'Blog post details' })
  @ApiResponse({ status: 404, description: 'Blog post not found' })
  findOne(@Param('id') id: string) {
    return this.blogsService.findOne(+id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get a blog post by slug' })
  @ApiResponse({ status: 200, description: 'Blog post details' })
  @ApiResponse({ status: 404, description: 'Blog post not found' })
  findBySlug(@Param('slug') slug: string) {
    return this.blogsService.findBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a blog post (Admin only)' })
  @ApiResponse({ status: 200, description: 'Blog post updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Blog post not found' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  update(@Param('id') id: string, @Body() updateBlogDto: UpdateBlogDto) {
    return this.blogsService.update(+id, updateBlogDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a blog post (Admin only)' })
  @ApiResponse({ status: 200, description: 'Blog post deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Blog post not found' })
  remove(@Param('id') id: string) {
    return this.blogsService.remove(+id);
  }
}
