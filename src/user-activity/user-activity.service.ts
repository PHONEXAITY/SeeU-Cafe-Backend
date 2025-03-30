import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserActivityDto } from './dto/create-user-activity.dto';
import { UpdateUserActivityDto } from './dto/update-user-activity.dto';
import { Prisma } from '@prisma/client'; // เปิดใช้งาน import Prisma อีกครั้ง

@Injectable()
export class UserActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserActivityDto: CreateUserActivityDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: createUserActivityDto.user_id },
    });

    if (!user) {
      throw new NotFoundException(
        `User with ID ${createUserActivityDto.user_id} not found`,
      );
    }

    return this.prisma.userActivity.create({
      data: createUserActivityDto,
    });
  }

  async logActivity(
    userId: number,
    activityType: string,
    description?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.prisma.userActivity.create({
      data: {
        user_id: userId,
        activity_type: activityType,
        description,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    });
  }

  async findAll(userId?: number, activityType?: string) {
    const where: Prisma.UserActivityWhereInput = {}; // ใช้ Prisma type แทน any

    if (userId) {
      where.user_id = userId;
    }

    if (activityType) {
      where.activity_type = activityType;
    }

    return this.prisma.userActivity.findMany({
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
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.prisma.userActivity.findMany({
      where: { user_id: userId },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async findOne(id: number) {
    const userActivity = await this.prisma.userActivity.findUnique({
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

    if (!userActivity) {
      throw new NotFoundException(`User activity with ID ${id} not found`);
    }

    return userActivity;
  }

  async update(id: number, updateUserActivityDto: UpdateUserActivityDto) {
    await this.findOne(id);

    if (updateUserActivityDto.user_id) {
      const user = await this.prisma.user.findUnique({
        where: { id: updateUserActivityDto.user_id },
      });

      if (!user) {
        throw new NotFoundException(
          `User with ID ${updateUserActivityDto.user_id} not found`,
        );
      }
    }

    return this.prisma.userActivity.update({
      where: { id },
      data: updateUserActivityDto,
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
    await this.findOne(id);

    await this.prisma.userActivity.delete({
      where: { id },
    });

    return { message: 'User activity deleted successfully' };
  }

  async getActivityStats(days: number = 30) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const activityStats = await this.prisma.userActivity.groupBy({
      by: ['activity_type'],
      _count: {
        id: true,
      },
      where: {
        created_at: {
          gte: fromDate,
        },
      },
    });

    const dailyActivity = await this.prisma.$queryRaw<
      { date: string; count: number }[]
    >`
      SELECT 
        DATE(created_at) as date, 
        COUNT(*) as count 
      FROM "UserActivity" 
      WHERE created_at >= ${fromDate}
      GROUP BY DATE(created_at) 
      ORDER BY date
    `;

    return {
      activityStats: activityStats.map((stat) => ({
        activity_type: stat.activity_type,
        count: stat._count.id,
      })),
      dailyActivity,
      totalActivities: activityStats.reduce(
        (sum, stat) => sum + stat._count.id,
        0,
      ),
      timeframe: `Last ${days} days`,
    };
  }

  async cleanupOldActivities(days: number = 90) {
    const olderThan = new Date();
    olderThan.setDate(olderThan.getDate() - days);

    const result = await this.prisma.userActivity.deleteMany({
      where: {
        created_at: {
          lt: olderThan,
        },
      },
    });

    return {
      message: `Deleted ${result.count} activities older than ${days} days`,
      deleted_count: result.count,
    };
  }
}
