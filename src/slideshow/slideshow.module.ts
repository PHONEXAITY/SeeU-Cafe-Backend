import { Module } from '@nestjs/common';
import { SlideshowController } from './slideshow.controller';
import { SlideshowService } from './slideshow.service';
import { SlideshowSettingsController } from './slideshow-settings.controller';
import { SlideshowSettingsService } from './slideshow-settings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [SlideshowController, SlideshowSettingsController],
  providers: [SlideshowService, SlideshowSettingsService],
  exports: [SlideshowService, SlideshowSettingsService],
})
export class SlideshowModule {}
