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
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => {
          let token = null;
          if (req && req.cookies) {
            token = req.cookies['auth_token'];
          }
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<UserPayload> {
    console.log('JWT Payload:', payload);
    console.log('Searching for user with ID:', payload.sub);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });

    if (!user) {
      console.log('User not found!');
      throw new UnauthorizedException('User not found');
    }

    console.log('User found:', user.id, user.email, user.role?.name);

    return {
      id: user.id,
      email: user.email,
      role: user.role?.name || 'customer',
      first_name: user.first_name,
      last_name: user.last_name,
    };
  }
}
