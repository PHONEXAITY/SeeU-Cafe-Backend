// src/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserPayload } from '../strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: UserPayload;
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Check if user has any of the required roles
    // First check new roles array
    if (user.roles && Array.isArray(user.roles)) {
      const hasRole = requiredRoles.some((role) => user.roles.includes(role));
      if (hasRole) return true;
    }

    // Fallback to legacy role field for backward compatibility
    if (user.role) {
      return requiredRoles.includes(user.role);
    }

    return false;
  }
}
