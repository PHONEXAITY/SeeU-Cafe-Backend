import { Module } from '@nestjs/common';
import { SlideshowService } from './slideshow.service';
import { SlideshowController } from './slideshow.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

@Module({
  imports: [PrismaModule, CloudinaryModule],
  controllers: [SlideshowController],
  providers: [SlideshowService],
  exports: [SlideshowService],
})
export class SlideshowModule {}
