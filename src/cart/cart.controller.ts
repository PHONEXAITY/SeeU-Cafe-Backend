import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { CartItemInput } from './interfaces/cart.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';

interface RequestWithUser extends Request {
  user: {
    id: number;
    email: string;
    role: string;
  };
}

@ApiTags('Cart')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get user cart' })
  @ApiResponse({ status: 200, description: "Returns the user's cart" })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({
    name: 'withDetails',
    required: false,
    type: 'boolean',
    description: 'Include product details in response',
  })
  async getCart(
    @Request() req: RequestWithUser,
    @Query('withDetails') withDetails?: string,
  ) {
    if (withDetails === 'true') {
      return this.cartService.getCartWithDetails(req.user.id);
    }
    return this.cartService.getCart(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Add item to cart' })
  @ApiResponse({ status: 201, description: 'Item added to cart' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Menu item not found' })
  async addToCart(
    @Request() req: RequestWithUser,
    @Body() item: CartItemInput,
  ) {
    return this.cartService.addToCart(req.user.id, item);
  }

  @Patch(':itemId')
  @ApiOperation({ summary: 'Update cart item quantity' })
  @ApiResponse({ status: 200, description: 'Cart item updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Cart item not found' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        quantity: {
          type: 'number',
          description: 'New quantity for the item',
        },
        notes: {
          type: 'string',
          description: 'Updated notes for the item',
        },
      },
      required: ['quantity'],
    },
  })
  async updateCartItem(
    @Request() req: RequestWithUser,
    @Param('itemId') itemId: string,
    @Body('quantity') quantity: number,
    @Body('notes') notes?: string,
  ) {
    return this.cartService.updateCartItem(
      req.user.id,
      itemId,
      quantity,
      notes,
    );
  }

  @Delete(':itemId')
  @ApiOperation({ summary: 'Remove item from cart' })
  @ApiResponse({ status: 200, description: 'Cart item removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeFromCart(
    @Request() req: RequestWithUser,
    @Param('itemId') itemId: string,
  ) {
    return this.cartService.removeFromCart(req.user.id, itemId);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear cart' })
  @ApiResponse({ status: 200, description: 'Cart cleared' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async clearCart(@Request() req: RequestWithUser) {
    await this.cartService.clearCart(req.user.id);
    return { message: 'Cart cleared successfully' };
  }

  @Post('migrate')
  @ApiOperation({ summary: 'Migrate cart from localStorage to server' })
  @ApiResponse({ status: 201, description: 'Cart migrated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async migrateCart(
    @Request() req: RequestWithUser,
    @Body() localCart: CartItemInput[],
  ) {
    return this.cartService.migrateCartFromLocal(req.user.id, localCart);
  }

  @Get('validate')
  @ApiOperation({ summary: 'Validate cart items' })
  @ApiResponse({ status: 200, description: 'Cart validation result' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async validateCart(@Request() req: RequestWithUser) {
    return this.cartService.validateCartItems(req.user.id);
  }

  @Get('count')
  @ApiOperation({ summary: 'Get total number of items in cart' })
  @ApiResponse({ status: 200, description: 'Cart item count' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCartItemCount(@Request() req: RequestWithUser) {
    const count = await this.cartService.getCartItemCount(req.user.id);
    return { count };
  }
}
