import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: number;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface UserPayload {
  id: number;
  email: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: (req: Request): string | null => {
        if (req?.cookies?.auth_token) {
          return req.cookies.auth_token as string;
        }
        if (req?.cookies?.access_token) {
          return req.cookies.access_token as string;
        }

        const bearerToken: string | null | undefined =
          ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        return bearerToken ?? null;
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<UserPayload> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          role: true,
        },
      });

      if (!user) {
        console.log(`User not found with ID ${payload.sub}`);
        throw new UnauthorizedException('Authentication failed');
      }

      const result: UserPayload = {
        id: user.id,
        email: user.email,
        role: user.role?.name || 'customer',
        first_name: user.first_name,
        last_name: user.last_name,
      };
      console.log('JWT validation result:', result);

      return result;
    } catch (error) {
      console.error('JWT validation error:', error);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
