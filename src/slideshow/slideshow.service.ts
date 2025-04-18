import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateSlideshowDto } from './dto/create-slideshow.dto';
import { UpdateSlideshowDto } from './dto/update-slideshow.dto';
import { MulterFile } from '../types/multer';

@Injectable()
export class SlideshowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(createSlideshowDto: CreateSlideshowDto) {
    if (createSlideshowDto.status === 'scheduled') {
      if (!createSlideshowDto.startDate || !createSlideshowDto.endDate) {
        throw new BadRequestException(
          'Start date and end date are required for scheduled slides',
        );
      }

      if (typeof createSlideshowDto.startDate === 'string') {
        createSlideshowDto.startDate = new Date(createSlideshowDto.startDate);
      }

      if (typeof createSlideshowDto.endDate === 'string') {
        createSlideshowDto.endDate = new Date(createSlideshowDto.endDate);
      }
    }

    const data: any = { ...createSlideshowDto };

    if (!data.image) {
      throw new BadRequestException('Image is required');
    }

    return this.prisma.slideshow.create({
      data,
    });
  }

  async uploadSlideImage(file: MulterFile, slideshowData: CreateSlideshowDto) {
    const result = await this.cloudinaryService.uploadFile(file, 'slideshow');

    const data: any = { ...slideshowData, image: result.secure_url };

    if (data.status === 'scheduled') {
      if (!data.startDate || !data.endDate) {
        throw new BadRequestException(
          'Start date and end date are required for scheduled slides',
        );
      }

      if (data.startDate && typeof data.startDate === 'string') {
        data.startDate = new Date(data.startDate as string);
      }

      if (data.endDate && typeof data.endDate === 'string') {
        data.endDate = new Date(data.endDate as string);
      }
    }

    return this.prisma.slideshow.create({
      data,
    });
  }

  async findAll(status?: string, search?: string) {
    const where: any = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { subtitle: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.slideshow.findMany({
      where,
      orderBy: [{ order: 'asc' }, { created_at: 'desc' }],
    });
  }

  async findActive() {
    return this.prisma.slideshow.findMany({
      where: { status: 'active' },
      orderBy: [{ order: 'asc' }, { created_at: 'desc' }],
    });
  }

  async findOne(id: number) {
    const slideshow = await this.prisma.slideshow.findUnique({
      where: { id },
    });

    if (!slideshow) {
      throw new NotFoundException(`Slideshow item with ID ${id} not found`);
    }

    return slideshow;
  }

  async update(id: number, updateSlideshowDto: UpdateSlideshowDto) {
    await this.findOne(id);

    return this.prisma.slideshow.update({
      where: { id },
      data: updateSlideshowDto,
    });
  }

  async updateSlideImage(
    id: number,
    file: MulterFile,
    updateData?: UpdateSlideshowDto,
  ) {
    const slideshow = await this.findOne(id);

    const result = await this.cloudinaryService.uploadFile(file, 'slideshow');

    const data = {
      ...(updateData || {}),
      image: result.secure_url,
    };

    if (
      slideshow.image.includes('cloudinary') &&
      slideshow.image.includes('/upload/')
    ) {
      try {
        const urlParts = slideshow.image.split('/');
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExtension.split('.')[0];

        await this.cloudinaryService.deleteFile(publicId).catch(() => {
          console.log(`Could not delete file from Cloudinary: ${publicId}`);
        });
      } catch (error) {
        console.error('Error extracting Cloudinary public ID:', error);
      }
    }

    return this.prisma.slideshow.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    const slideshow = await this.findOne(id);

    if (
      slideshow.image.includes('cloudinary') &&
      slideshow.image.includes('/upload/')
    ) {
      try {
        const urlParts = slideshow.image.split('/');
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExtension.split('.')[0];

        await this.cloudinaryService.deleteFile(publicId).catch(() => {
          console.log(`Could not delete file from Cloudinary: ${publicId}`);
        });
      } catch (error) {
        console.error('Error extracting Cloudinary public ID:', error);
      }
    }

    await this.prisma.slideshow.delete({
      where: { id },
    });

    return { message: 'Slideshow item deleted successfully' };
  }

  async reorderSlides(ordersMap: Record<number, number>) {
    const updates = Object.entries(ordersMap).map(([id, order]) => {
      return this.prisma.slideshow.update({
        where: { id: parseInt(id) },
        data: { order },
      });
    });

    await Promise.all(updates);

    return { message: 'Slides reordered successfully' };
  }
}
