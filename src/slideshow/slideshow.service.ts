import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateSlideshowDto } from './dto/create-slideshow.dto';
import { UpdateSlideshowDto } from './dto/update-slideshow.dto';

// Import or define the MulterFile interface
import { MulterFile } from '../types/multer';

@Injectable()
export class SlideshowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(createSlideshowDto: CreateSlideshowDto) {
    return this.prisma.slideshow.create({
      data: createSlideshowDto,
    });
  }

  async uploadSlideImage(file: MulterFile, slideshowData: CreateSlideshowDto) {
    // Upload file to Cloudinary
    const result = await this.cloudinaryService.uploadFile(file, 'slideshow');

    // Create slideshow item with uploaded image
    const data = { ...slideshowData, image: result.secure_url };

    return this.prisma.slideshow.create({
      data,
    });
  }

  async findAll(status?: string) {
    const where = status ? { status } : {};

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
    // Check if slideshow item exists
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
    // Check if slideshow item exists
    const slideshow = await this.findOne(id);

    // Upload new image to Cloudinary
    const result = await this.cloudinaryService.uploadFile(file, 'slideshow');

    // Prepare update data
    const data = {
      ...(updateData || {}),
      image: result.secure_url,
    };

    // Delete old image from Cloudinary if possible
    if (
      slideshow.image.includes('cloudinary') &&
      slideshow.image.includes('/upload/')
    ) {
      try {
        const urlParts = slideshow.image.split('/');
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExtension.split('.')[0]; // Remove file extension

        // Delete from Cloudinary (this is optional and can fail silently)
        await this.cloudinaryService.deleteFile(publicId).catch(() => {
          console.log(`Could not delete file from Cloudinary: ${publicId}`);
        });
      } catch (error) {
        console.error('Error extracting Cloudinary public ID:', error);
      }
    }

    // Update slideshow item
    return this.prisma.slideshow.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    // Check if slideshow item exists and get image URL
    const slideshow = await this.findOne(id);

    // Extract public ID from Cloudinary URL if applicable
    if (
      slideshow.image.includes('cloudinary') &&
      slideshow.image.includes('/upload/')
    ) {
      try {
        const urlParts = slideshow.image.split('/');
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExtension.split('.')[0]; // Remove file extension

        // Delete from Cloudinary (this is optional and can fail silently)
        await this.cloudinaryService.deleteFile(publicId).catch(() => {
          console.log(`Could not delete file from Cloudinary: ${publicId}`);
        });
      } catch (error) {
        console.error('Error extracting Cloudinary public ID:', error);
      }
    }

    // Delete from database
    await this.prisma.slideshow.delete({
      where: { id },
    });

    return { message: 'Slideshow item deleted successfully' };
  }

  async reorderSlides(ordersMap: Record<number, number>) {
    // Update order for each slide
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
