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
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
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

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new review (Authenticated users)' })
  @ApiResponse({ status: 201, description: 'Review created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  create(@Body() createReviewDto: CreateReviewDto) {
    return this.reviewsService.create(createReviewDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reviews (Public)' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (pending, approved, rejected)',
  })
  @ApiQuery({
    name: 'rating',
    required: false,
    description: 'Filter by rating (1-5)',
    type: Number,
  })
  @ApiResponse({ status: 200, description: 'List of reviews' })
  findAll(@Query('status') status?: string, @Query('rating') rating?: string) {
    return this.reviewsService.findAll(status, rating ? +rating : undefined);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get reviews by user ID (Public)' })
  @ApiResponse({ status: 200, description: 'List of user reviews' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findByUserId(@Param('userId') userId: string) {
    return this.reviewsService.findByUserId(+userId);
  }

  @Get('stats/average')
  @ApiOperation({ summary: 'Get average rating (Public)' })
  @ApiResponse({ status: 200, description: 'Average rating statistics' })
  getAverageRating() {
    return this.reviewsService.getAverageRating();
  }

  @Get('stats/distribution')
  @ApiOperation({ summary: 'Get rating distribution (Public)' })
  @ApiResponse({ status: 200, description: 'Rating distribution statistics' })
  getRatingDistribution() {
    return this.reviewsService.getRatingDistribution();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a review by ID (Public)' })
  @ApiResponse({ status: 200, description: 'Review details' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a review (Admin only)' })
  @ApiResponse({ status: 200, description: 'Review updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Review or user not found' })
  update(@Param('id') id: string, @Body() updateReviewDto: UpdateReviewDto) {
    return this.reviewsService.update(+id, updateReviewDto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update review status (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Review status updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.reviewsService.updateStatus(+id, status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a review (Admin only)' })
  @ApiResponse({ status: 200, description: 'Review deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(+id);
  }
}
