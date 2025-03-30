import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';

@Injectable()
export class BlogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBlogDto: CreateBlogDto) {
    // Check if blog with the same slug already exists
    const existingBlog = await this.prisma.blog.findUnique({
      where: { slug: createBlogDto.slug },
    });

    if (existingBlog) {
      throw new ConflictException(
        `Blog with slug '${createBlogDto.slug}' already exists`,
      );
    }

    // Extract categories from DTO
    const { categories, ...blogData } = createBlogDto;

    // Create blog post
    const blog = await this.prisma.blog.create({
      data: {
        ...blogData,
        // Connect categories if provided
        categories:
          categories && categories.length > 0
            ? {
                connect: categories.map((id) => ({ id })),
              }
            : undefined,
      },
      include: {
        categories: true,
      },
    });

    return blog;
  }

  async findAll(status?: string, categoryId?: number) {
    // Build where conditions
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (categoryId) {
      where.categories = {
        some: {
          id: categoryId,
        },
      };
    }

    return this.prisma.blog.findMany({
      where,
      include: {
        categories: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const blog = await this.prisma.blog.findUnique({
      where: { id },
      include: {
        categories: true,
      },
    });

    if (!blog) {
      throw new NotFoundException(`Blog with ID ${id} not found`);
    }

    // Increment view count
    await this.prisma.blog.update({
      where: { id },
      data: { views: blog.views + 1 },
    });

    // Return the blog with incremented views
    blog.views += 1;

    return blog;
  }

  async findBySlug(slug: string) {
    const blog = await this.prisma.blog.findUnique({
      where: { slug },
      include: {
        categories: true,
      },
    });

    if (!blog) {
      throw new NotFoundException(`Blog with slug '${slug}' not found`);
    }

    // Increment view count
    await this.prisma.blog.update({
      where: { id: blog.id },
      data: { views: blog.views + 1 },
    });

    // Return the blog with incremented views
    blog.views += 1;

    return blog;
  }

  async update(id: number, updateBlogDto: UpdateBlogDto) {
    // Check if blog exists
    await this.findOne(id);

    // If slug is being updated, check if the new slug is already in use
    if (updateBlogDto.slug) {
      const existingBlog = await this.prisma.blog.findUnique({
        where: { slug: updateBlogDto.slug },
      });

      if (existingBlog && existingBlog.id !== id) {
        throw new ConflictException(
          `Blog with slug '${updateBlogDto.slug}' already exists`,
        );
      }
    }

    // Extract categories from DTO
    const { categories, ...blogData } = updateBlogDto;

    // Update the blog post
    return this.prisma.blog.update({
      where: { id },
      data: {
        ...blogData,
        // Update categories if provided
        categories: categories
          ? {
              // Disconnect existing categories and connect new ones
              set: categories.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        categories: true,
      },
    });
  }

  async remove(id: number) {
    // Check if blog exists
    await this.findOne(id);

    // Delete the blog
    await this.prisma.blog.delete({
      where: { id },
    });

    return { message: 'Blog deleted successfully' };
  }
}
