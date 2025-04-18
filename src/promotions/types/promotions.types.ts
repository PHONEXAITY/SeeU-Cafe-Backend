import { Promotion, PromotionUsage, Order } from '@prisma/client';

export interface PromotionValidationResult {
  valid: boolean;
  promotion?: PromotionWithStringId;
  discountAmount?: number;
  message: string;
}

export type PromotionWithRelations = Promotion & {
  orders: Order[];
  promotionUsages: (PromotionUsage & {
    user: {
      id: number;
      email: string;
      first_name: string | null;
      last_name: string | null;
    };
  })[];
};

export type PromotionWithStringId = Omit<
  PromotionWithRelations,
  'promotion_id'
> & {
  promotion_id: string;
};
