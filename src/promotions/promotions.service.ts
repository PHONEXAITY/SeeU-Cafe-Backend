import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { Promotion } from '@prisma/client';
import {
  PromotionValidationResult,
  PromotionWithStringId,
  PromotionWithRelations,
} from './types/promotions.types';

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async create(createPromotionDto: CreatePromotionDto) {
    const existingPromotion = await this.prisma.promotion.findUnique({
      where: { code: createPromotionDto.code },
    });

    if (existingPromotion) {
      throw new ConflictException(
        `Promotion with code '${createPromotionDto.code}' already exists`,
      );
    }

    if (
      new Date(createPromotionDto.start_date) >=
      new Date(createPromotionDto.end_date)
    ) {
      throw new BadRequestException('End date must be after start date');
    }

    const promotionId = BigInt(Date.now());

    const promotion = await this.prisma.promotion.create({
      data: {
        ...createPromotionDto,
        promotion_id: promotionId,
      },
    });

    await this.clearPromotionCaches();

    return {
      ...promotion,
      promotion_id: promotion.promotion_id.toString(),
    };
  }

  async findAll(status?: string) {
    const cacheKey = `promotions:all:${status || 'all'}`;
    const cachedPromotions =
      await this.cacheManager.get<Array<Promotion & { promotion_id: string }>>(
        cacheKey,
      );
    if (cachedPromotions) {
      return cachedPromotions;
    }

    const where = status ? { status } : {};

    const promotions = await this.prisma.promotion.findMany({
      where,
      orderBy: [{ status: 'asc' }, { end_date: 'desc' }],
    });

    const result = promotions.map((promotion) => ({
      ...promotion,
      promotion_id: promotion.promotion_id.toString(),
    }));

    await this.cacheManager.set(cacheKey, result, 600);

    return result;
  }

  async findOne(id: number) {
    const cacheKey = `promotion:id:${id}`;
    const cachedPromotion = await this.cacheManager.get<
      PromotionWithRelations & { promotion_id: string }
    >(cacheKey);
    if (cachedPromotion) {
      return cachedPromotion;
    }

    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
      include: {
        orders: true,
        promotionUsages: {
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
        },
      },
    });

    if (!promotion) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    const result = {
      ...promotion,
      promotion_id: promotion.promotion_id.toString(),
    };

    await this.cacheManager.set(cacheKey, result, 600);

    return result;
  }

  async findByCode(code: string) {
    const cacheKey = `promotion:code:${code}`;
    const cachedPromotion = await this.cacheManager.get<
      PromotionWithRelations & { promotion_id: string }
    >(cacheKey);
    if (cachedPromotion) {
      return cachedPromotion;
    }

    const promotion = await this.prisma.promotion.findUnique({
      where: { code },
      include: {
        orders: true,
        promotionUsages: {
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
        },
      },
    });

    if (!promotion) {
      throw new NotFoundException(`Promotion with code '${code}' not found`);
    }

    const result = {
      ...promotion,
      promotion_id: promotion.promotion_id.toString(),
    };

    await this.cacheManager.set(cacheKey, result, 600);

    return result;
  }

  async update(id: number, updatePromotionDto: UpdatePromotionDto) {
    await this.findOne(id);

    if (updatePromotionDto.code) {
      const existingPromotion = await this.prisma.promotion.findUnique({
        where: { code: updatePromotionDto.code },
      });

      if (existingPromotion && existingPromotion.id !== id) {
        throw new ConflictException(
          `Promotion with code '${updatePromotionDto.code}' already exists`,
        );
      }
    }

    if (updatePromotionDto.start_date && updatePromotionDto.end_date) {
      if (
        new Date(updatePromotionDto.start_date) >=
        new Date(updatePromotionDto.end_date)
      ) {
        throw new BadRequestException('End date must be after start date');
      }
    } else if (updatePromotionDto.start_date) {
      const promotion = await this.prisma.promotion.findUnique({
        where: { id },
        select: { end_date: true },
      });

      if (
        promotion &&
        new Date(updatePromotionDto.start_date) >= new Date(promotion.end_date)
      ) {
        throw new BadRequestException('End date must be after start date');
      }
    } else if (updatePromotionDto.end_date) {
      const promotion = await this.prisma.promotion.findUnique({
        where: { id },
        select: { start_date: true },
      });

      if (
        promotion &&
        new Date(promotion.start_date) >= new Date(updatePromotionDto.end_date)
      ) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    const updatedPromotion = await this.prisma.promotion.update({
      where: { id },
      data: updatePromotionDto,
    });

    await this.clearPromotionCaches();
    await this.cacheManager.del(`promotion:id:${id}`);
    if (updatedPromotion.code) {
      await this.cacheManager.del(`promotion:code:${updatedPromotion.code}`);
    }

    return {
      ...updatedPromotion,
      promotion_id: updatedPromotion.promotion_id.toString(),
    };
  }

  async remove(id: number) {
    const promotion = await this.findOne(id);

    const ordersCount = await this.prisma.order.count({
      where: { promotion_id: id },
    });

    if (ordersCount > 0) {
      throw new ConflictException(
        'Cannot delete promotion with associated orders',
      );
    }

    await this.prisma.promotionUsage.deleteMany({
      where: { promotion_id: id },
    });

    await this.prisma.promotion.delete({
      where: { id },
    });

    await this.clearPromotionCaches();
    await this.cacheManager.del(`promotion:id:${id}`);
    if (promotion.code) {
      await this.cacheManager.del(`promotion:code:${promotion.code}`);
    }

    return { message: 'Promotion deleted successfully' };
  }

  async validatePromotion(
    code: string,
    userId?: number,
    amount?: number,
  ): Promise<PromotionValidationResult> {
    try {
      const cacheKey = `promotion:validate:${code}:${userId || 'guest'}:${amount || 0}`;
      const cachedValidation =
        await this.cacheManager.get<PromotionValidationResult>(cacheKey);
      if (cachedValidation) {
        return cachedValidation;
      }

      const promotion = await this.prisma.promotion.findUnique({
        where: { code },
        include: {
          orders: true,
          promotionUsages: {
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
          },
        },
      });

      if (!promotion) {
        return { valid: false, message: 'Promotion not found' };
      }

      if (promotion.status !== 'active') {
        return { valid: false, message: 'Promotion is not active' };
      }

      const now = new Date();
      if (
        now < new Date(promotion.start_date) ||
        now > new Date(promotion.end_date)
      ) {
        return { valid: false, message: 'Promotion is not currently valid' };
      }

      if (
        amount !== undefined &&
        promotion.minimum_order !== null &&
        amount < promotion.minimum_order
      ) {
        return {
          valid: false,
          message: `Order amount must be at least ${promotion.minimum_order} to apply this promotion`,
        };
      }

      if (promotion.usage_limit !== null) {
        const usageCount = await this.prisma.promotionUsage.count({
          where: { promotion_id: promotion.id },
        });
        if (usageCount >= promotion.usage_limit) {
          return {
            valid: false,
            message: 'Promotion usage limit has been reached',
          };
        }
      }

      if (userId !== undefined) {
        const userUsageCount = await this.prisma.promotionUsage.count({
          where: {
            promotion_id: promotion.id,
            user_id: Number(userId),
          },
        });
        const userUsageLimit = promotion.user_usage_limit || 1;
        if (userUsageCount >= userUsageLimit) {
          return {
            valid: false,
            message: `You have already used this promotion ${userUsageCount} time(s). Maximum allowed: ${userUsageLimit}`,
          };
        }
      }

      let discountAmount = 0;
      if (amount !== undefined) {
        if (promotion.discount_type === 'percentage') {
          discountAmount = (amount * promotion.discount_value) / 100;
          if (
            promotion.maximum_discount !== null &&
            discountAmount > promotion.maximum_discount
          ) {
            discountAmount = promotion.maximum_discount;
          }
        } else {
          discountAmount = promotion.discount_value;
        }
      }

      const promotionWithStringId: PromotionWithStringId = {
        ...promotion,
        promotion_id: promotion.promotion_id.toString(),
      };

      const result: PromotionValidationResult = {
        valid: true,
        promotion: promotionWithStringId,
        discountAmount,
        message: 'Promotion is valid',
      };

      await this.cacheManager.set(cacheKey, result, 300);

      return result;
    } catch (error) {
      console.error('Promotion validation error:', error);
      return {
        valid: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async recordUsage(promotionId: number, userId: number): Promise<void> {
    try {
      const parsedPromotionId = Number(promotionId);
      const parsedUserId = Number(userId);

      const existingUsage = await this.prisma.promotionUsage.findFirst({
        where: {
          promotion_id: parsedPromotionId,
          user_id: parsedUserId,
        },
      });

      if (existingUsage) {
        throw new BadRequestException('You have already used this promotion');
      }

      await this.prisma.promotionUsage.create({
        data: {
          promotion_id: parsedPromotionId,
          user_id: parsedUserId,
          used_at: new Date(),
        },
      });

      await this.clearPromotionCaches();
      await this.cacheManager.del(`promotion:id:${promotionId}`);
    } catch (error) {
      console.error('Error recording promotion usage:', error);
      throw new BadRequestException('Failed to record promotion usage');
    }
  }

  async isPromotionUsedByUser(
    promotionId: number,
    userId: number,
  ): Promise<boolean> {
    try {
      const usageCount = await this.prisma.promotionUsage.count({
        where: {
          promotion_id: Number(promotionId),
          user_id: Number(userId),
        },
      });

      return usageCount > 0;
    } catch (error) {
      console.error('Error checking promotion usage:', error);
      return false;
    }
  }

  private async clearPromotionCaches() {
    await this.cacheManager.del(`promotions:all:all`);
    await this.cacheManager.del(`promotions:all:active`);
    await this.cacheManager.del(`promotions:all:inactive`);
    await this.cacheManager.del(`promotions:all:expired`);
  }
}
