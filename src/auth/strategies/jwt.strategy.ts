import { Injectable } from '@nestjs/common';
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
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        role: true,
      },
    });

    if (!user) {
      throw new Error(`ไม่พบผู้ใช้ที่มี ID ${payload.sub}`);
    }

    const result: UserPayload = {
      id: user.id,
      email: user.email,
      role: user.role?.name || 'guest',
      first_name: user.first_name,
      last_name: user.last_name,
    };

    return result;
  }
}
