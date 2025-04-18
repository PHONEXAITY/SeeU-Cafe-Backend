import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBlogCategoryDto } from './dto/create-blog-category.dto';
import { UpdateBlogCategoryDto } from './dto/update-blog-category.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { BlogCategoryWithRelations } from '../interfaces/category.interface';
import { BlogCategory } from '@prisma/client';

@Injectable()
export class BlogCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  private readonly ALL_BLOG_CATEGORIES_CACHE_KEY = 'all_blog_categories';
  private readonly BLOG_CATEGORY_ID_CACHE_PREFIX = 'blog_category_id_';
  private readonly BLOG_CATEGORY_SLUG_CACHE_PREFIX = 'blog_category_slug_';

  private async clearCaches(
    category?: BlogCategory | Partial<BlogCategoryWithRelations>,
  ): Promise<void> {
    await this.cacheManager.del(this.ALL_BLOG_CATEGORIES_CACHE_KEY);

    if (category?.id) {
      await this.cacheManager.del(
        `${this.BLOG_CATEGORY_ID_CACHE_PREFIX}${category.id}`,
      );
    }

    if (category?.slug) {
      await this.cacheManager.del(
        `${this.BLOG_CATEGORY_SLUG_CACHE_PREFIX}${category.slug}`,
      );
    }
  }

  async create(
    createBlogCategoryDto: CreateBlogCategoryDto,
  ): Promise<BlogCategory> {
    const existingCategory = await this.prisma.blogCategory.findUnique({
      where: { slug: createBlogCategoryDto.slug },
    });

    if (existingCategory) {
      throw new ConflictException(
        `Blog category with slug '${createBlogCategoryDto.slug}' already exists`,
      );
    }

    const newCategory = await this.prisma.blogCategory.create({
      data: createBlogCategoryDto,
    });

    await this.clearCaches(newCategory);

    return newCategory;
  }

  async findAll(): Promise<BlogCategory[]> {
    const cachedCategories = await this.cacheManager.get<BlogCategory[]>(
      this.ALL_BLOG_CATEGORIES_CACHE_KEY,
    );
    if (cachedCategories) {
      return cachedCategories;
    }

    const categories = await this.prisma.blogCategory.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    await this.cacheManager.set(this.ALL_BLOG_CATEGORIES_CACHE_KEY, categories);

    return categories;
  }

  async findOne(id: number): Promise<BlogCategoryWithRelations> {
    const cacheKey = `${this.BLOG_CATEGORY_ID_CACHE_PREFIX}${id}`;

    const cachedCategory =
      await this.cacheManager.get<BlogCategoryWithRelations>(cacheKey);
    if (cachedCategory) {
      return cachedCategory;
    }

    const category = await this.prisma.blogCategory.findUnique({
      where: { id },
      include: {
        blogs: true,
      },
    });

    if (!category) {
      throw new NotFoundException(`Blog category with ID ${id} not found`);
    }

    await this.cacheManager.set(cacheKey, category);

    return category;
  }

  async findBySlug(slug: string): Promise<BlogCategoryWithRelations> {
    const cacheKey = `${this.BLOG_CATEGORY_SLUG_CACHE_PREFIX}${slug}`;

    const cachedCategory =
      await this.cacheManager.get<BlogCategoryWithRelations>(cacheKey);
    if (cachedCategory) {
      return cachedCategory;
    }

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

    await this.cacheManager.set(cacheKey, category);

    return category;
  }

  async update(
    id: number,
    updateBlogCategoryDto: UpdateBlogCategoryDto,
  ): Promise<BlogCategory> {
    const existingCategory = await this.findOne(id);

    if (updateBlogCategoryDto.slug) {
      const categoryWithSlug = await this.prisma.blogCategory.findUnique({
        where: { slug: updateBlogCategoryDto.slug },
      });

      if (categoryWithSlug && categoryWithSlug.id !== id) {
        throw new ConflictException(
          `Blog category with slug '${updateBlogCategoryDto.slug}' already exists`,
        );
      }
    }

    const updatedCategory = await this.prisma.blogCategory.update({
      where: { id },
      data: updateBlogCategoryDto,
    });

    await this.clearCaches(existingCategory);
    await this.clearCaches(updatedCategory);

    return updatedCategory;
  }

  async remove(id: number): Promise<{ message: string }> {
    const category = await this.findOne(id);

    if (category.blogs.length > 0) {
      throw new ConflictException(
        'Cannot delete category with associated blog posts',
      );
    }

    await this.prisma.blogCategory.delete({
      where: { id },
    });

    await this.clearCaches(category);

    return { message: 'Blog category deleted successfully' };
  }
}
