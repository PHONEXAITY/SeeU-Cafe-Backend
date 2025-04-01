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
      include: { role: true },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      const { password: _password, ...result } = user;
      return {
        ...result,
        User_id: user.User_id.toString(),
        role_name: user.role?.name || null,
      };
    }
    return null;
  }

  async login(loginDto: LoginDto, response: Response) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role?.name || null,
    };
    const token = this.jwtService.sign(payload);

    this.setTokenCookie(response, token);

    response.cookie('auth_token', token, {
      maxAge:
        parseInt(
          this.configService.get<string>('JWT_EXPIRATION_SECONDS') || '604800',
        ) * 1000,
      path: '/',
      sameSite: 'lax',
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      httpOnly: false,
    });

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role?.name || null,
        first_name: user.first_name,
        last_name: user.last_name,
        User_id: user.User_id.toString(),
      },
      message: 'เข้าสู่ระบบสำเร็จ',
    };
  }

  async register(createUserDto: CreateUserDto, response: Response) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('อีเมลนี้มีผู้ใช้งานอยู่แล้ว');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const customerRole = await this.prisma.role.findUnique({
      where: { name: 'customer' },
    });

    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
        User_id: BigInt(Date.now()),
        role_id: customerRole?.id || null,
      },
      include: { role: true },
    });

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role?.name || null,
    };
    const token = this.jwtService.sign(payload);

    this.setTokenCookie(response, token);

    response.cookie('customer', token, {
      maxAge:
        parseInt(
          this.configService.get<string>('JWT_EXPIRATION_SECONDS') || '604800',
        ) * 1000,
      path: '/',
      sameSite: 'lax',
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      httpOnly: false,
    });

    const { password: _password, ...result } = user;
    return {
      ...result,
      access_token: token,
      User_id: user.User_id.toString(),
      role_name: user.role?.name || null,
      message: 'ลงทะเบียนสำเร็จ',
    };
  }

  logout(response: Response) {
    this.clearTokenCookie(response);
    response.cookie('auth_token', '', {
      maxAge: 0,
      path: '/',
    });
    return { message: 'ออกจากระบบสำเร็จ' };
  }

  private setTokenCookie(response: Response, token: string) {
    const secure = this.configService.get<string>('NODE_ENV') === 'production';
    const domain = this.configService.get<string>('COOKIE_DOMAIN') || undefined;
    const maxAge = parseInt(
      this.configService.get<string>('JWT_EXPIRATION_SECONDS') || '604800',
    );

    response.cookie('auth_token', token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      domain,
      maxAge: maxAge * 1000,
      path: '/',
    });
  }

  private clearTokenCookie(response: Response) {
    const domain = this.configService.get<string>('COOKIE_DOMAIN') || undefined;

    response.clearCookie('auth_token', {
      httpOnly: true,
      domain,
      path: '/',
    });
  }
}
