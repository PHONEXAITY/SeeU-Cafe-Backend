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
import { PromotionsService } from './promotions.service';
import { PromotionValidationResult } from './types/promotions.types';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new promotion (Admin only)' })
  @ApiResponse({ status: 201, description: 'Promotion created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Promotion code already exists' })
  create(@Body() createPromotionDto: CreatePromotionDto) {
    return this.promotionsService.create(createPromotionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all promotions' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (active, inactive)',
  })
  @ApiResponse({ status: 200, description: 'List of promotions' })
  findAll(@Query('status') status?: string) {
    return this.promotionsService.findAll(status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a promotion by ID' })
  @ApiResponse({ status: 200, description: 'Promotion details' })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  findOne(@Param('id') id: string) {
    return this.promotionsService.findOne(+id);
  }

  @Get('code/:code')
  @ApiOperation({ summary: 'Get a promotion by code' })
  @ApiResponse({ status: 200, description: 'Promotion details' })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  findByCode(@Param('code') code: string) {
    return this.promotionsService.findByCode(code);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate a promotion code' })
  @ApiResponse({ status: 200, description: 'Promotion validation result' })
  validatePromotion(
    @Body('code') code: string,
    @Body('userId') userId?: number,
    @Body('amount') amount?: number,
  ): Promise<PromotionValidationResult> {
    return this.promotionsService.validatePromotion(code, userId, amount);
  }

  @Get(':id/usage/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check if user has used a promotion' })
  @ApiParam({ name: 'id', description: 'Promotion ID' })
  @ApiParam({ name: 'userId', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Usage check result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async checkUsage(@Param('id') id: string, @Param('userId') userId: string) {
    const used = await this.promotionsService.isPromotionUsedByUser(
      +id,
      +userId,
    );
    return { used };
  }

  @Post('usage')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record promotion usage' })
  @ApiResponse({ status: 201, description: 'Promotion usage recorded' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        promotionId: { type: 'number' },
        userId: { type: 'number' },
      },
      required: ['promotionId', 'userId'],
    },
  })
  async recordUsage(
    @Body('promotionId') promotionId: number,
    @Body('userId') userId: number,
  ) {
    await this.promotionsService.recordUsage(promotionId, userId);
    return { message: 'Promotion usage recorded successfully' };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a promotion (Admin only)' })
  @ApiResponse({ status: 200, description: 'Promotion updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  @ApiResponse({ status: 409, description: 'Promotion code already exists' })
  update(
    @Param('id') id: string,
    @Body() updatePromotionDto: UpdatePromotionDto,
  ) {
    return this.promotionsService.update(+id, updatePromotionDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a promotion (Admin only)' })
  @ApiResponse({ status: 200, description: 'Promotion deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete with associated orders',
  })
  remove(@Param('id') id: string) {
    return this.promotionsService.remove(+id);
  }
}
