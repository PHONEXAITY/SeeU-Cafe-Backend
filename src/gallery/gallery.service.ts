import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { CreateGalleryUploadDto } from './dto/create-gallery-upload.dto'; // Import new DTO
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

  async uploadImage(
    file: Express.Multer.File,
    galleryData: CreateGalleryUploadDto,
  ) {
    const result = await this.cloudinaryService.uploadFile(file, 'gallery');
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
    const gallery = await this.findOne(id);

    const result = await this.cloudinaryService.uploadFile(file, 'gallery');

    const data = {
      ...(updateData || {}),
      image: result.secure_url,
    };

    if (
      gallery.image.includes('cloudinary') &&
      gallery.image.includes('/upload/')
    ) {
      try {
        const urlParts = gallery.image.split('/');
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExtension.split('.')[0];

        await this.cloudinaryService.deleteFile(publicId).catch(() => {
          console.log(`Could not delete file from Cloudinary: ${publicId}`);
        });
      } catch (error) {
        console.error('Error extracting Cloudinary public ID:', error);
      }
    }

    return this.prisma.gallery.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    const gallery = await this.findOne(id);

    if (
      gallery.image.includes('cloudinary') &&
      gallery.image.includes('/upload/')
    ) {
      try {
        const urlParts = gallery.image.split('/');
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = publicIdWithExtension.split('.')[0];

        await this.cloudinaryService.deleteFile(publicId).catch(() => {
          console.log(`Could not delete file from Cloudinary: ${publicId}`);
        });
      } catch (error) {
        console.error('Error extracting Cloudinary public ID:', error);
      }
    }

    await this.prisma.gallery.delete({
      where: { id },
    });

    return { message: 'Gallery item deleted successfully' };
  }
}
