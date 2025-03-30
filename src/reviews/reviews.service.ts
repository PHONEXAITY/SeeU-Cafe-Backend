import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createReviewDto: CreateReviewDto) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: createReviewDto.user_id },
    });

    if (!user) {
      throw new NotFoundException(
        `User with ID ${createReviewDto.user_id} not found`,
      );
    }

    return this.prisma.review.create({
      data: createReviewDto,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });
  }

  async findAll(status?: string, rating?: number) {
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (rating) {
      where.rating = rating;
    }

    return this.prisma.review.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findByUserId(userId: number) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.prisma.review.findMany({
      where: { user_id: userId },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundException(`Review with ID ${id} not found`);
    }

    return review;
  }

  async update(id: number, updateReviewDto: UpdateReviewDto) {
    // Check if review exists
    await this.findOne(id);

    // If user_id is being updated, check if the new user exists
    if (updateReviewDto.user_id) {
      const user = await this.prisma.user.findUnique({
        where: { id: updateReviewDto.user_id },
      });

      if (!user) {
        throw new NotFoundException(
          `User with ID ${updateReviewDto.user_id} not found`,
        );
      }
    }

    return this.prisma.review.update({
      where: { id },
      data: updateReviewDto,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });
  }

  async updateStatus(id: number, status: string) {
    // Check if review exists
    await this.findOne(id);

    return this.prisma.review.update({
      where: { id },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });
  }

  async remove(id: number) {
    // Check if review exists
    await this.findOne(id);

    await this.prisma.review.delete({
      where: { id },
    });

    return { message: 'Review deleted successfully' };
  }

  async getAverageRating() {
    const reviews = await this.prisma.review.findMany({
      where: { status: 'approved' },
      select: { rating: true },
    });

    if (reviews.length === 0) {
      return { averageRating: 0, count: 0 };
    }

    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    const averageRating = sum / reviews.length;

    return {
      averageRating: parseFloat(averageRating.toFixed(1)),
      count: reviews.length,
    };
  }

  async getRatingDistribution() {
    const reviews = await this.prisma.review.findMany({
      where: { status: 'approved' },
      select: { rating: true },
    });

    const distribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    reviews.forEach((review) => {
      distribution[review.rating]++;
    });

    return {
      distribution,
      totalCount: reviews.length,
    };
  }
}
