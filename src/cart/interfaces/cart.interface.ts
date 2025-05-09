export interface CartItemInput {
  foodMenuId?: number;
  beverageMenuId?: number;
  quantity: number;
  notes?: string;
  price?: number;
  options?: {
    priceType?: 'hot' | 'ice';
  };
}

export interface CartItem extends CartItemInput {
  id: string;
}

export interface CartSummary {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
}
