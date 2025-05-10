import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserPayload } from '../strategies/jwt.strategy';

export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserPayload => {
    const request = ctx.switchToHttp().getRequest();
    console.log('\n=== User Decorator ===');
    console.log('Request user:', request.user);

    if (!request.user) {
      console.log('✗ No user in request');
    }

    return request.user as UserPayload;
  },
);
