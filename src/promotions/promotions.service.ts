import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPromotionDto: CreatePromotionDto) {
    // Check if promotion with the same code already exists
    const existingPromotion = await this.prisma.promotion.findUnique({
      where: { code: createPromotionDto.code },
    });

    if (existingPromotion) {
      throw new ConflictException(
        `Promotion with code '${createPromotionDto.code}' already exists`,
      );
    }

    // Validate dates
    if (
      new Date(createPromotionDto.start_date) >=
      new Date(createPromotionDto.end_date)
    ) {
      throw new BadRequestException('End date must be after start date');
    }

    // Generate a unique promotion_id
    const promotionId = BigInt(Date.now());

    const promotion = await this.prisma.promotion.create({
      data: {
        ...createPromotionDto,
        promotion_id: promotionId,
      },
    });

    // แปลง promotion_id เป็น string
    return {
      ...promotion,
      promotion_id: promotion.promotion_id.toString(),
    };
  }

  async findAll(status?: string) {
    const where = status ? { status } : {};

    const promotions = await this.prisma.promotion.findMany({
      where,
      orderBy: [{ status: 'asc' }, { end_date: 'desc' }],
    });

    // แปลง promotion_id เป็น string ในทุก object
    return promotions.map((promotion) => ({
      ...promotion,
      promotion_id: promotion.promotion_id.toString(),
    }));
  }

  async findOne(id: number) {
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

    // แปลง promotion_id เป็น string
    return {
      ...promotion,
      promotion_id: promotion.promotion_id.toString(),
    };
  }

  async findByCode(code: string) {
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

    // แปลง promotion_id เป็น string
    return {
      ...promotion,
      promotion_id: promotion.promotion_id.toString(),
    };
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

    // If dates are being updated, validate them
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

    // แปลง promotion_id เป็น string
    return {
      ...updatedPromotion,
      promotion_id: updatedPromotion.promotion_id.toString(),
    };
  }

  async remove(id: number) {
    // Check if promotion exists
    await this.findOne(id);

    // Check if promotion has associated orders
    const ordersCount = await this.prisma.order.count({
      where: { promotion_id: id },
    });

    if (ordersCount > 0) {
      throw new ConflictException(
        'Cannot delete promotion with associated orders',
      );
    }

    // Delete promotion usages first
    await this.prisma.promotionUsage.deleteMany({
      where: { promotion_id: id },
    });

    // Delete the promotion
    await this.prisma.promotion.delete({
      where: { id },
    });

    return { message: 'Promotion deleted successfully' };
  }

  async validatePromotion(code: string, userId?: number, amount?: number) {
    try {
      const promotion = await this.findByCode(code);

      // Check if promotion is active
      if (promotion.status !== 'active') {
        return { valid: false, message: 'Promotion is not active' };
      }

      // Check dates
      const now = new Date();
      if (
        now < new Date(promotion.start_date) ||
        now > new Date(promotion.end_date)
      ) {
        return { valid: false, message: 'Promotion is not currently valid' };
      }

      // Check minimum order amount
      if (
        amount &&
        promotion.minimum_order &&
        amount < promotion.minimum_order
      ) {
        return {
          valid: false,
          message: `Order amount must be at least ${promotion.minimum_order} to apply this promotion`,
        };
      }

      // Check usage limit
      if (promotion.usage_limit) {
        const usageCount = promotion.promotionUsages.length;
        if (usageCount >= promotion.usage_limit) {
          return {
            valid: false,
            message: 'Promotion usage limit has been reached',
          };
        }
      }

      // Check if user has already used this promotion
      if (userId) {
        const userUsage = promotion.promotionUsages.find(
          (usage) => usage.user_id === userId,
        );
        if (userUsage) {
          return {
            valid: false,
            message: 'You have already used this promotion',
          };
        }
      }

      // Calculate discount amount
      let discountAmount = 0;
      if (amount) {
        if (promotion.discount_type === 'percentage') {
          discountAmount = (amount * promotion.discount_value) / 100;
          if (
            promotion.maximum_discount &&
            discountAmount > promotion.maximum_discount
          ) {
            discountAmount = promotion.maximum_discount;
          }
        } else {
          discountAmount = promotion.discount_value;
        }
      }

      // แปลง promotion_id เป็น string ใน response
      return {
        valid: true,
        promotion: {
          ...promotion,
          promotion_id: promotion.promotion_id.toString(),
        },
        discountAmount,
        message: 'Promotion is valid',
      };
    } catch (error) {
      return { valid: false, message: error.message };
    }
  }
}
