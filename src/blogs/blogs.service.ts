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
    const existingBlog = await this.prisma.blog.findUnique({
      where: { slug: createBlogDto.slug },
    });

    if (existingBlog) {
      throw new ConflictException(
        `Blog with slug '${createBlogDto.slug}' already exists`,
      );
    }

    const { categories, ...blogData } = createBlogDto;

    const blog = await this.prisma.blog.create({
      data: {
        ...blogData,

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

  async findAll(params: {
    status?: string;
    categoryId?: number;
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
  }) {
    const {
      status,
      categoryId,
      page = 1,
      limit = 10,
      sort = 'created_at',
      order = 'desc',
    } = params;

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

    const skip = (page - 1) * limit;
    const take = limit;

    const posts = await this.prisma.blog.findMany({
      where,
      include: {
        categories: true,
      },
      orderBy: {
        [sort]: order,
      },
      skip,
      take,
    });

    const total = await this.prisma.blog.count({ where });

    const pagination = {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };

    return {
      posts,
      pagination,
    };
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

    await this.prisma.blog.update({
      where: { id },
      data: { views: blog.views + 1 },
    });

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

    await this.prisma.blog.update({
      where: { id: blog.id },
      data: { views: blog.views + 1 },
    });

    blog.views += 1;

    return blog;
  }

  async update(id: number, updateBlogDto: UpdateBlogDto) {
    await this.findOne(id);

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

    const { categories, ...blogData } = updateBlogDto;

    return this.prisma.blog.update({
      where: { id },
      data: {
        ...blogData,

        categories: categories
          ? {
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
    await this.findOne(id);

    await this.prisma.blog.delete({
      where: { id },
    });

    return { message: 'Blog deleted successfully' };
  }
}
