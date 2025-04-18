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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GalleryService } from './gallery.service';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { CreateGalleryUploadDto } from './dto/create-gallery-upload.dto'; // Import new DTO
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Gallery')
@Controller('gallery')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new gallery item (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Gallery item created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createGalleryDto: CreateGalleryDto) {
    return this.galleryService.create(createGalleryDto);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload image and create a gallery item (Admin only)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        title: { type: 'string' },
        category: { type: 'string' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Gallery item created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() galleryData: CreateGalleryUploadDto, // Use new DTO
  ) {
    return this.galleryService.uploadImage(file, galleryData);
  }

  @Get()
  @ApiOperation({ summary: 'Get all gallery items (Public)' })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by category',
  })
  @ApiResponse({ status: 200, description: 'List of gallery items' })
  findAll(@Query('category') category?: string) {
    return this.galleryService.findAll(category);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all gallery categories (Public)' })
  @ApiResponse({
    status: 200,
    description: 'List of gallery categories with counts',
  })
  findCategories() {
    return this.galleryService.findCategories();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a gallery item by ID (Public)' })
  @ApiResponse({ status: 200, description: 'Gallery item details' })
  @ApiResponse({ status: 404, description: 'Gallery item not found' })
  findOne(@Param('id') id: string) {
    return this.galleryService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a gallery item (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Gallery item updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Gallery item not found' })
  update(@Param('id') id: string, @Body() updateGalleryDto: UpdateGalleryDto) {
    return this.galleryService.update(+id, updateGalleryDto);
  }

  @Patch(':id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a gallery image (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        title: {
          type: 'string',
        },
        category: {
          type: 'string',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Gallery image updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Gallery item not found' })
  updateImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File, // ใช้ type จาก @types/multer
    @Body() updateData: UpdateGalleryDto,
  ) {
    return this.galleryService.updateImage(+id, file, updateData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a gallery item (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Gallery item deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Gallery item not found' })
  remove(@Param('id') id: string) {
    return this.galleryService.remove(+id);
  }
}
