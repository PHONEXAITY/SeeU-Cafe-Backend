import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBlogCategoryDto } from './dto/create-blog-category.dto';
import { UpdateBlogCategoryDto } from './dto/update-blog-category.dto';

@Injectable()
export class BlogCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBlogCategoryDto: CreateBlogCategoryDto) {
    // Check if category with the same slug already exists
    const existingCategory = await this.prisma.blogCategory.findUnique({
      where: { slug: createBlogCategoryDto.slug },
    });

    if (existingCategory) {
      throw new ConflictException(
        `Blog category with slug '${createBlogCategoryDto.slug}' already exists`,
      );
    }

    return this.prisma.blogCategory.create({
      data: createBlogCategoryDto,
    });
  }

  async findAll() {
    return this.prisma.blogCategory.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: number) {
    const category = await this.prisma.blogCategory.findUnique({
      where: { id },
      include: {
        blogs: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Blog category with ID ${id} not found`);
    }

    return category;
  }

  async findBySlug(slug: string) {
    const category = await this.prisma.blogCategory.findUnique({
      where: { slug },
      include: {
        blogs: true,
      },
    });

    if (!category) {
      throw new NotFoundException(
        `Blog category with slug '${slug}' not found`,
      );
    }

    return category;
  }

  async update(id: number, updateBlogCategoryDto: UpdateBlogCategoryDto) {
    // Check if category exists
    await this.findOne(id);

    // If slug is being updated, check if the new slug is already in use
    if (updateBlogCategoryDto.slug) {
      const existingCategory = await this.prisma.blogCategory.findUnique({
        where: { slug: updateBlogCategoryDto.slug },
      });

      if (existingCategory && existingCategory.id !== id) {
        throw new ConflictException(
          `Blog category with slug '${updateBlogCategoryDto.slug}' already exists`,
        );
      }
    }

    return this.prisma.blogCategory.update({
      where: { id },
      data: updateBlogCategoryDto,
    });
  }

  async remove(id: number) {
    // Check if category exists
    const category = await this.findOne(id);

    // Check if category has associated blogs
    if (category.blogs.length > 0) {
      throw new ConflictException(
        'Cannot delete category with associated blog posts',
      );
    }

    await this.prisma.blogCategory.delete({
      where: { id },
    });

    return { message: 'Blog category deleted successfully' };
  }
}
