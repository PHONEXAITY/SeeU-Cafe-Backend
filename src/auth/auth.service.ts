// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _password, ...result } = user;

      // Extract role names from the roles relationship
      const roleNames = user.roles.map((ur) => ur.role.name);

      return {
        ...result,
        User_id: user.User_id.toString(),
        roles: roleNames,
      };
    }

    return null;
  }

  async login(loginDto: LoginDto, response: Response) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { email: user.email, sub: user.id };
    const token = this.jwtService.sign(payload);

    // Set both HTTP-only cookie and normal cookie
    this.setTokenCookie(response, token);

    // Also set a non-HTTP-only cookie for frontend access
    response.cookie('auth_token', token, {
      maxAge:
        parseInt(
          this.configService.get<string>('JWT_EXPIRATION_SECONDS') || '604800',
        ) * 1000,
      path: '/',
      sameSite: 'lax',
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      httpOnly: false, // Frontend accessible
    });

    return {
      access_token: token, // ส่ง token กลับไปในข้อมูล response ด้วย
      user: {
        id: user.id,
        email: user.email,
        role: user.role, // Keep for backward compatibility
        roles: user.roles, // Add new roles array
        first_name: user.first_name,
        last_name: user.last_name,
        User_id: user.User_id.toString(),
      },
      message: 'Login successful',
    };
  }

  async register(createUserDto: CreateUserDto, response: Response) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create the user
    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
        User_id: BigInt(Date.now()),
      },
    });

    // Assign default customer role if it exists
    try {
      const customerRole = await this.prisma.role.findUnique({
        where: { name: 'customer' },
      });

      if (customerRole) {
        await this.prisma.userRole.create({
          data: {
            user_id: user.id,
            role_id: customerRole.id,
          },
        });
      }
    } catch (error) {
      console.error('Failed to assign default role:', error);
    }

    // Generate token and set cookie
    const payload = { email: user.email, sub: user.id };
    const token = this.jwtService.sign(payload);

    // Set both HTTP-only cookie and normal cookie
    this.setTokenCookie(response, token);

    // Also set a non-HTTP-only cookie for frontend access
    response.cookie('auth_token', token, {
      maxAge:
        parseInt(
          this.configService.get<string>('JWT_EXPIRATION_SECONDS') || '604800',
        ) * 1000,
      path: '/',
      sameSite: 'lax',
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      httpOnly: false, // Frontend accessible
    });

    const { password: _password, ...result } = user;
    return {
      ...result,
      access_token: token, // ส่ง token กลับไปในข้อมูล response ด้วย
      User_id: user.User_id.toString(),
      roles: ['customer'], // Assume default role
      message: 'Registration successful',
    };
  }

  logout(response: Response) {
    this.clearTokenCookie(response);
    response.cookie('auth_token', '', {
      maxAge: 0,
      path: '/',
    });
    return { message: 'Logout successful' };
  }

  private setTokenCookie(response: Response, token: string) {
    // Get settings from config
    const secure = this.configService.get<string>('NODE_ENV') === 'production';
    const domain = this.configService.get<string>('COOKIE_DOMAIN') || undefined;
    const maxAge = parseInt(
      this.configService.get<string>('JWT_EXPIRATION_SECONDS') || '604800',
    ); // Default 7 days

    // Set the JWT as an HTTP-only cookie
    response.cookie('access_token', token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      domain,
      maxAge: maxAge * 1000, // Convert to milliseconds
      path: '/',
    });
  }

  private clearTokenCookie(response: Response) {
    const domain = this.configService.get<string>('COOKIE_DOMAIN') || undefined;

    response.clearCookie('access_token', {
      httpOnly: true,
      domain,
      path: '/',
    });
  }
}
