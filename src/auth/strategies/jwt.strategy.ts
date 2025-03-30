import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: number;
  email: string;
  iat?: number;
  exp?: number;
}

export interface UserPayload {
  id: number;
  email: string;
  role: string;
  roles: string[];
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
      select: {
        id: true,
        email: true,
        role: true,
        first_name: true,
        last_name: true,
      },
    });

    if (!user) {
      throw new Error(`User with ID ${payload.sub} not found`);
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: { user_id: payload.sub },
      include: {
        role: true,
      },
    });

    const roleNames: string[] = userRoles.map((ur) => ur.role.name);

    const result: UserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      roles: roleNames,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    return result;
  }
}
