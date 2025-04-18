import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SlideshowSettingsDto } from './dto/slideshow-settings.dto';
import { SlideshowSettings as PrismaSlideshowSettings } from '@prisma/client';

@Injectable()
export class SlideshowSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<PrismaSlideshowSettings> {
    const settings = await this.prisma.slideshowSettings.findFirst();

    if (!settings) {
      return this.prisma.slideshowSettings.create({
        data: {
          autoplay: true,
          interval: 5000,
          transition: 'fade',
          transitionDuration: 500,
          showArrows: true,
          showDots: true,
          pauseOnHover: true,
          height: 600,
          responsive: true,
          maxSlides: 5,
          enableOverlay: true,
          overlayColor: 'rgba(0, 0, 0, 0.3)',
          animateText: true,
          textPosition: 'bottom',
        },
      });
    }

    return settings;
  }

  async updateSettings(
    settingsDto: SlideshowSettingsDto,
  ): Promise<PrismaSlideshowSettings> {
    const settings = await this.prisma.slideshowSettings.findFirst();

    if (!settings) {
      return this.prisma.slideshowSettings.create({
        data: {
          ...settingsDto,
        } as unknown as PrismaSlideshowSettings,
      });
    }

    return this.prisma.slideshowSettings.update({
      where: { id: settings.id },
      data: settingsDto,
    });
  }

  async resetSettings(): Promise<PrismaSlideshowSettings> {
    const settings = await this.prisma.slideshowSettings.findFirst();

    const defaultSettings = {
      autoplay: true,
      interval: 5000,
      transition: 'fade',
      transitionDuration: 500,
      showArrows: true,
      showDots: true,
      pauseOnHover: true,
      height: 600,
      responsive: true,
      maxSlides: 5,
      enableOverlay: true,
      overlayColor: 'rgba(0, 0, 0, 0.3)',
      animateText: true,
      textPosition: 'bottom',
    };

    if (!settings) {
      return this.prisma.slideshowSettings.create({
        data: defaultSettings,
      });
    }

    return this.prisma.slideshowSettings.update({
      where: { id: settings.id },
      data: defaultSettings,
    });
  }
}
