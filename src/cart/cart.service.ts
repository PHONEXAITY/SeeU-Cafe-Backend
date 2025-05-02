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
  price?: number;
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
          const foodItem = await this.prisma.foodMenu.findUnique({
            where: { id: item.foodMenuId },
            include: { category: true },
          });

          if (foodItem) {
            details.name = foodItem.name;
            details.price = foodItem.price;
            details.image = foodItem.image;
            details.category = foodItem.category?.name;
            subtotal += foodItem.price * item.quantity;
          } else {
            details.name = 'Unknown Item';
            details.price = 0;
            details.image = null;
            details.category = 'Unknown';
          }
        } else if (item.beverageMenuId) {
          const beverageItem = await this.prisma.beverageMenu.findUnique({
            where: { id: item.beverageMenuId },
            include: { category: true },
          });

          if (beverageItem && beverageItem.price !== null) {
            details.name = beverageItem.name;
            details.price = beverageItem.price;
            details.image = beverageItem.image;
            details.category = beverageItem.category?.name;
            subtotal += beverageItem.price * item.quantity;
          } else {
            details.name = 'Unknown Item';
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

  async addToCart(userId: number, item: CartItemInput): Promise<CartItem[]> {
    const cartKey = this.getCartKey(userId);
    const cart = await this.getCart(userId);

    // Validate that the menu item exists
    if (item.foodMenuId) {
      const foodItem = await this.prisma.foodMenu.findUnique({
        where: { id: item.foodMenuId },
      });
      if (!foodItem) {
        throw new NotFoundException(
          `Food menu item with ID ${item.foodMenuId} not found`,
        );
      }
    } else if (item.beverageMenuId) {
      const beverageItem = await this.prisma.beverageMenu.findUnique({
        where: { id: item.beverageMenuId },
      });
      if (!beverageItem) {
        throw new NotFoundException(
          `Beverage menu item with ID ${item.beverageMenuId} not found`,
        );
      }
    } else {
      throw new NotFoundException(
        'Either foodMenuId or beverageMenuId must be provided',
      );
    }

    // Check if the item is already in the cart
    const existingItemIndex = cart.findIndex(
      (cartItem) =>
        (item.foodMenuId && cartItem.foodMenuId === item.foodMenuId) ||
        (item.beverageMenuId &&
          cartItem.beverageMenuId === item.beverageMenuId),
    );

    if (existingItemIndex !== -1) {
      // Update the quantity if the item already exists
      cart[existingItemIndex].quantity += item.quantity;

      // Update notes if provided
      if (item.notes) {
        cart[existingItemIndex].notes = item.notes;
      }
    } else {
      // Add new item
      cart.push({
        ...item,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9), // Generate a unique ID
      });
    }

    // Store the updated cart with a TTL of 7 days
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
      // Remove the item if quantity is zero or negative
      cart.splice(itemIndex, 1);
    } else {
      // Update the quantity
      cart[itemIndex].quantity = quantity;

      // Update notes if provided
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
    const updatedCart = [...currentCart]; // Create a new array to avoid mutating the original

    for (const item of localCart) {
      // Check if the item exists in the product database
      let isValid = false;

      if (item.foodMenuId) {
        const foodItem = await this.prisma.foodMenu.findUnique({
          where: { id: item.foodMenuId },
        });
        if (foodItem && foodItem.status === 'active') {
          isValid = true;
        }
      } else if (item.beverageMenuId) {
        const beverageItem = await this.prisma.beverageMenu.findUnique({
          where: { id: item.beverageMenuId },
        });
        if (beverageItem && beverageItem.status === 'active') {
          isValid = true;
        }
      }

      if (!isValid) continue; // Skip invalid items

      // Check if the item is already in the cart
      const existingItemIndex = updatedCart.findIndex(
        (cartItem) =>
          (item.foodMenuId && cartItem.foodMenuId === item.foodMenuId) ||
          (item.beverageMenuId &&
            cartItem.beverageMenuId === item.beverageMenuId),
      );

      if (existingItemIndex !== -1) {
        // Update the quantity if the item already exists
        updatedCart[existingItemIndex].quantity += item.quantity;

        // Update notes if provided
        if (item.notes) {
          updatedCart[existingItemIndex].notes = item.notes;
        }
      } else {
        // Add new item
        updatedCart.push({
          ...item,
          id:
            Date.now().toString() + Math.random().toString(36).substring(2, 9), // Generate a unique ID
        });
      }
    }

    // Store the updated cart with a TTL of 7 days
    await this.cacheManager.set(cartKey, updatedCart, 7 * 24 * 60 * 60 * 1000);
    return updatedCart;
  }

  async getCartItemCount(userId: number): Promise<number> {
    const cart = await this.getCart(userId);
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }
}
