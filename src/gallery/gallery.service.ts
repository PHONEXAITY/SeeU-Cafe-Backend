import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';

@Injectable()
export class GalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async create(createGalleryDto: CreateGalleryDto) {
    return this.prisma.gallery.create({
      data: createGalleryDto,
    });
  }

  async uploadImage(file: Express.Multer.File, galleryData: CreateGalleryDto) {
    // Upload file to Cloudinary
    const result = await this.cloudinaryService.uploadFile(file, 'gallery');

    // Create gallery item with uploaded image
    const data = {
      ...galleryData,
      image: result.secure_url,
    };

    return this.prisma.gallery.create({
      data,
    });
  }

  async findAll(category?: string) {
    const where = category ? { category } : {};

    return this.prisma.gallery.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findCategories() {
    const categories = await this.prisma.gallery.groupBy({
      by: ['category'],
      where: {
        category: {
          not: null,
        },
      },
      _count: {
        id: true,
      },
    });

    return categories.map((item) => ({
      category: item.category,
      count: item._count.id,
    }));
  }

  async findOne(id: number) {
    const gallery = await this.prisma.gallery.findUnique({
      where: { id },
    });

    if (!gallery) {
      throw new NotFoundException(`Gallery item with ID ${id} not found`);
    }

    return gallery;
  }

  async update(id: number, updateGalleryDto: UpdateGalleryDto) {
    // Check if gallery item exists
    await this.findOne(id);

    return this.prisma.gallery.update({
      where: { id },
      data: updateGalleryDto,
    });
  }

  async updateImage(
    id: number,
    file: Express.Multer.File,
    updateData?: UpdateGalleryDto,
  ) {
    // Check if gallery item exists
    const gallery = await this.findOne(id);

    // Upload new image to Cloudinary
    const result = await this.cloudinaryService.uploadFile(file, 'gallery');

    // Prepare update data
    const data = {
      ...(updateData || {}),
      image: result.secure_url,
    };

    // Delete old image from Cloudinary if possible
    if (
      gallery.image.includes('cloudinary') &&
      gallery.image.includes('/upload/')
    ) {
      try {
        const urlParts = gallery.image.split('/');
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

    // Update gallery item
    return this.prisma.gallery.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    // Check if gallery item exists and get image URL
    const gallery = await this.findOne(id);

    // Extract public ID from Cloudinary URL if applicable
    if (
      gallery.image.includes('cloudinary') &&
      gallery.image.includes('/upload/')
    ) {
      try {
        const urlParts = gallery.image.split('/');
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
    await this.prisma.gallery.delete({
      where: { id },
    });

    return { message: 'Gallery item deleted successfully' };
  }
}
