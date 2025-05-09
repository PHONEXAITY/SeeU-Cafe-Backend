import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import {
  CartItem,
  CartItemInput,
  CartSummary,
} from './interfaces/cart.interface';

interface ItemDetails extends CartItem {
  name?: string;
  image?: string | null;
  category?: string;
}

@Injectable()
export class CartService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly prisma: PrismaService,
  ) {}

  private getCartKey(userId: number): string {
    return `cart:${userId}`;
  }

  async getCart(userId: number): Promise<CartItem[]> {
    const cartKey = this.getCartKey(userId);
    const cartItems = await this.cacheManager.get<CartItem[]>(cartKey);
    if (!cartItems) {
      await this.cacheManager.set(cartKey, [], 7 * 24 * 60 * 60 * 1000);
      return [];
    }
    return cartItems;
  }

  async getCartWithDetails(userId: number): Promise<CartSummary> {
    const cart = await this.getCart(userId);
    let subtotal = 0;
    const itemsWithDetails = await Promise.all(
      cart.map(async (item) => {
        const details: ItemDetails = { ...item };

        if (item.foodMenuId) {
          try {
            const foodItem = await this.prisma.foodMenu.findUnique({
              where: { id: item.foodMenuId },
              include: { category: true },
            });

            if (foodItem) {
              details.name = foodItem.name;
              details.price = item.price || foodItem.price;
              details.image = foodItem.image;
              details.category = foodItem.category?.name;
              subtotal += (item.price || foodItem.price) * item.quantity;
            } else {
              details.name = 'Unknown Food Item';
              details.price = 0;
              details.image = null;
              details.category = 'Unknown';
              console.warn(`Food item with ID ${item.foodMenuId} not found`);
            }
          } catch (error) {
            console.error(
              `Error fetching food item ${item.foodMenuId}:`,
              error,
            );
            details.name = 'Error Loading Item';
            details.price = 0;
            details.image = null;
            details.category = 'Unknown';
          }
        } else if (item.beverageMenuId) {
          try {
            const beverageItem = await this.prisma.beverageMenu.findUnique({
              where: { id: item.beverageMenuId },
              include: { category: true },
            });

            if (beverageItem) {
              details.name = beverageItem.name;
              details.price =
                item.price ||
                (item.options?.priceType === 'hot' &&
                beverageItem.hot_price !== null
                  ? beverageItem.hot_price
                  : item.options?.priceType === 'ice' &&
                      beverageItem.ice_price !== null
                    ? beverageItem.ice_price
                    : beverageItem.price !== null
                      ? beverageItem.price
                      : 0);
              details.image = beverageItem.image;
              details.category = beverageItem.category?.name;
              subtotal += details.price * item.quantity;
            } else {
              details.name = 'Unknown Beverage Item';
              details.price = 0;
              details.image = null;
              details.category = 'Unknown';
              console.warn(
                `Beverage item with ID ${item.beverageMenuId} not found`,
              );
            }
          } catch (error) {
            console.error(
              `Error fetching beverage item ${item.beverageMenuId}:`,
              error,
            );
            details.name = 'Error Loading Item';
            details.price = 0;
            details.image = null;
            details.category = 'Unknown';
          }
        }

        return details as CartItem;
      }),
    );

    return {
      items: itemsWithDetails,
      totalItems: cart.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: parseFloat(subtotal.toFixed(2)),
    };
  }

  async addToCart(
    userId: number,
    item: CartItemInput & { selectedPriceType?: 'hot' | 'ice' },
  ): Promise<CartItem[]> {
    const cartKey = this.getCartKey(userId);
    const cart = await this.getCart(userId);

    if (item.foodMenuId) {
      const foodItem = await this.prisma.foodMenu.findUnique({
        where: { id: item.foodMenuId },
      });
      if (!foodItem) {
        throw new NotFoundException(
          `Food menu item with ID ${item.foodMenuId} not found`,
        );
      }
      item.price = item.price || foodItem.price;
    } else if (item.beverageMenuId) {
      const beverageItem = await this.prisma.beverageMenu.findUnique({
        where: { id: item.beverageMenuId },
      });
      if (!beverageItem) {
        throw new NotFoundException(
          `Beverage menu item with ID ${item.beverageMenuId} not found`,
        );
      }
      if (item.selectedPriceType === 'hot' && beverageItem.hot_price !== null) {
        item.price = beverageItem.hot_price;
      } else if (
        item.selectedPriceType === 'ice' &&
        beverageItem.ice_price !== null
      ) {
        item.price = beverageItem.ice_price;
      } else {
        item.price =
          item.price || (beverageItem.price !== null ? beverageItem.price : 0);
      }
    } else {
      throw new NotFoundException(
        'Either foodMenuId or beverageMenuId must be provided',
      );
    }

    const existingItemIndex = cart.findIndex(
      (cartItem) =>
        (item.foodMenuId && cartItem.foodMenuId === item.foodMenuId) ||
        (item.beverageMenuId &&
          cartItem.beverageMenuId === item.beverageMenuId &&
          cartItem.options?.priceType === item.selectedPriceType),
    );

    if (existingItemIndex !== -1) {
      cart[existingItemIndex].quantity += item.quantity;
      if (item.notes) {
        cart[existingItemIndex].notes = item.notes;
      }
      if (item.price) {
        cart[existingItemIndex].price = item.price;
      }
    } else {
      cart.push({
        ...item,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        options: item.selectedPriceType
          ? { priceType: item.selectedPriceType }
          : item.options,
      });
    }

    await this.cacheManager.set(cartKey, cart, 7 * 24 * 60 * 60 * 1000);
    return cart;
  }

  async updateCartItem(
    userId: number,
    itemId: string,
    quantity: number,
    notes?: string,
  ): Promise<CartItem[]> {
    const cartKey = this.getCartKey(userId);
    const cart = await this.getCart(userId);

    const itemIndex = cart.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      throw new NotFoundException(`Cart item with ID ${itemId} not found`);
    }

    if (quantity <= 0) {
      cart.splice(itemIndex, 1);
    } else {
      cart[itemIndex].quantity = quantity;
      if (notes !== undefined) {
        cart[itemIndex].notes = notes;
      }
    }

    await this.cacheManager.set(cartKey, cart, 7 * 24 * 60 * 60 * 1000);
    return cart;
  }

  async removeFromCart(userId: number, itemId: string): Promise<CartItem[]> {
    const cartKey = this.getCartKey(userId);
    const cart = await this.getCart(userId);

    const updatedCart = cart.filter((item) => item.id !== itemId);

    await this.cacheManager.set(cartKey, updatedCart, 7 * 24 * 60 * 60 * 1000);
    return updatedCart;
  }

  async clearCart(userId: number): Promise<void> {
    const cartKey = this.getCartKey(userId);
    await this.cacheManager.del(cartKey);
  }

  async validateCartItems(userId: number): Promise<{
    valid: boolean;
    invalidItems: string[];
    details: Array<{
      id: string;
      valid: boolean;
      type?: string;
      menuId?: number;
      name?: string;
      reason?: string;
    }>;
  }> {
    const cart = await this.getCart(userId);
    const invalidItems: string[] = [];
    const details: Array<{
      id: string;
      valid: boolean;
      type?: string;
      menuId?: number;
      name?: string;
      reason?: string;
    }> = [];

    for (const item of cart) {
      let isValid = true;
      let reason = '';
      const itemDetails: {
        id: string;
        valid: boolean;
        type?: string;
        menuId?: number;
        name?: string;
        reason?: string;
      } = { id: item.id, valid: true };

      if (item.foodMenuId) {
        const foodItem = await this.prisma.foodMenu.findUnique({
          where: { id: item.foodMenuId },
        });

        if (!foodItem) {
          isValid = false;
          reason = 'Item not found';
        } else if (foodItem.status !== 'active') {
          isValid = false;
          reason = 'Item no longer available';
        }

        itemDetails.type = 'food';
        itemDetails.menuId = item.foodMenuId;
        itemDetails.name = foodItem?.name || 'Unknown item';
      } else if (item.beverageMenuId) {
        const beverageItem = await this.prisma.beverageMenu.findUnique({
          where: { id: item.beverageMenuId },
        });

        if (!beverageItem) {
          isValid = false;
          reason = 'Item not found';
        } else if (beverageItem.status !== 'active') {
          isValid = false;
          reason = 'Item no longer available';
        }

        itemDetails.type = 'beverage';
        itemDetails.menuId = item.beverageMenuId;
        itemDetails.name = beverageItem?.name || 'Unknown item';
      }

      if (!isValid) {
        invalidItems.push(item.id);
        itemDetails.valid = false;
        itemDetails.reason = reason;
      } else {
        itemDetails.valid = true;
      }

      details.push(itemDetails);
    }

    return {
      valid: invalidItems.length === 0,
      invalidItems,
      details,
    };
  }

  async migrateCartFromLocal(
    userId: number,
    localCart: CartItemInput[],
  ): Promise<CartItem[]> {
    const cartKey = this.getCartKey(userId);
    const currentCart = await this.getCart(userId);
    const updatedCart = [...currentCart];

    for (const item of localCart) {
      let isValid = false;

      if (item.foodMenuId) {
        const foodItem = await this.prisma.foodMenu.findUnique({
          where: { id: item.foodMenuId },
        });
        if (foodItem && foodItem.status === 'active') {
          isValid = true;
          item.price =
            item.price || (foodItem.price !== null ? foodItem.price : 0);
        }
      } else if (item.beverageMenuId) {
        const beverageItem = await this.prisma.beverageMenu.findUnique({
          where: { id: item.beverageMenuId },
        });
        if (beverageItem && beverageItem.status === 'active') {
          isValid = true;
          item.price =
            item.price ||
            (beverageItem.price !== null ? beverageItem.price : 0);
        }
      }

      if (!isValid) continue;

      const existingItemIndex = updatedCart.findIndex(
        (cartItem) =>
          (item.foodMenuId && cartItem.foodMenuId === item.foodMenuId) ||
          (item.beverageMenuId &&
            cartItem.beverageMenuId === item.beverageMenuId &&
            cartItem.options?.priceType === item.options?.priceType),
      );

      if (existingItemIndex !== -1) {
        updatedCart[existingItemIndex].quantity += item.quantity;
        if (item.notes) {
          updatedCart[existingItemIndex].notes = item.notes;
        }
        if (item.price) {
          updatedCart[existingItemIndex].price = item.price;
        }
      } else {
        updatedCart.push({
          ...item,
          id:
            Date.now().toString() + Math.random().toString(36).substring(2, 9),
        });
      }
    }

    await this.cacheManager.set(cartKey, updatedCart, 7 * 24 * 60 * 60 * 1000);
    return updatedCart;
  }

  async getCartItemCount(userId: number): Promise<number> {
    const cart = await this.getCart(userId);
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }
}
