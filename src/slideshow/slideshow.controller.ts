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
import { SlideshowService } from './slideshow.service';
import { CreateSlideshowDto } from './dto/create-slideshow.dto';
import { UpdateSlideshowDto } from './dto/update-slideshow.dto';
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

import { MulterFile } from '../types/multer';

@ApiTags('Slideshow')
@Controller('slideshow')
export class SlideshowController {
  constructor(private readonly slideshowService: SlideshowService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new slideshow item (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Slideshow item created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  create(@Body() createSlideshowDto: CreateSlideshowDto) {
    return this.slideshowService.create(createSlideshowDto);
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload image and create a slideshow item (Admin only)',
  })
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
        link: {
          type: 'string',
        },
        order: {
          type: 'integer',
        },
        status: {
          type: 'string',
          enum: ['active', 'inactive'],
        },
      },
      required: ['file', 'title'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Slideshow item created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  uploadSlide(
    @UploadedFile() file: MulterFile,
    @Body() slideshowData: CreateSlideshowDto,
  ) {
    return this.slideshowService.uploadSlideImage(file, slideshowData);
  }

  @Get()
  @ApiOperation({ summary: 'Get all slideshow items (Public)' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (active, inactive, scheduled)',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search in title and subtitle',
  })
  @ApiResponse({ status: 200, description: 'List of slideshow items' })
  findAll(@Query('status') status?: string, @Query('search') search?: string) {
    return this.slideshowService.findAll(status, search);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active slideshow items (Public)' })
  @ApiResponse({ status: 200, description: 'List of active slideshow items' })
  findActive() {
    return this.slideshowService.findActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a slideshow item by ID (Public)' })
  @ApiResponse({ status: 200, description: 'Slideshow item details' })
  @ApiResponse({ status: 404, description: 'Slideshow item not found' })
  findOne(@Param('id') id: string) {
    return this.slideshowService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a slideshow item (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Slideshow item updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Slideshow item not found' })
  update(
    @Param('id') id: string,
    @Body() updateSlideshowDto: UpdateSlideshowDto,
  ) {
    return this.slideshowService.update(+id, updateSlideshowDto);
  }

  @Patch(':id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a slideshow image (Admin only)' })
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
        link: {
          type: 'string',
        },
        order: {
          type: 'integer',
        },
        status: {
          type: 'string',
          enum: ['active', 'inactive'],
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Slideshow image updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Slideshow item not found' })
  updateImage(
    @Param('id') id: string,
    @UploadedFile() file: MulterFile,
    @Body() updateData: UpdateSlideshowDto,
  ) {
    return this.slideshowService.updateSlideImage(+id, file, updateData);
  }

  @Post('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reorder slideshow items (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'integer',
      },
      example: {
        '1': 2,
        '2': 1,
        '3': 3,
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Slideshow items reordered successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  reorderSlides(@Body() ordersMap: Record<number, number>) {
    return this.slideshowService.reorderSlides(ordersMap);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a slideshow item (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Slideshow item deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Slideshow item not found' })
  remove(@Param('id') id: string) {
    return this.slideshowService.remove(+id);
  }
}
