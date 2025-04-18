import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SlideshowSettingsService } from './slideshow-settings.service';
import { SlideshowSettingsDto } from './dto/slideshow-settings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SlideshowSettings } from '@prisma/client';

@ApiTags('Slideshow Settings')
@Controller('slideshow-settings')
export class SlideshowSettingsController {
  constructor(private readonly settingsService: SlideshowSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get slideshow settings' })
  @ApiResponse({ status: 200, description: 'Return slideshow settings' })
  async getSettings(): Promise<SlideshowSettings> {
    return this.settingsService.getSettings();
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update slideshow settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateSettings(
    @Body() settingsDto: SlideshowSettingsDto,
  ): Promise<SlideshowSettings> {
    return this.settingsService.updateSettings(settingsDto);
  }

  @Put('reset')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Reset slideshow settings to defaults (Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Settings reset successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async resetSettings(): Promise<SlideshowSettings> {
    return this.settingsService.resetSettings();
  }
}
