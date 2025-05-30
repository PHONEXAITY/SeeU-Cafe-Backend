import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Response, Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { SessionService } from '../session/session.service';
import { v4 as uuidv4 } from 'uuid';
import { UserSession } from '../session/interfaces/user-session.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
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
        role_name: user.role?.name,
      };
    }
    return null;
  }

  async login(loginDto: LoginDto, response: Response) {
    // Line 73 (approximately): This should now be type-safe
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('ອີເມວ ຫຼື ລະຫັດຜ່ານ ບໍ່ຖືກຕ້ອງ');
    }

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role_name,
    };
    const token = this.jwtService.sign(payload);

    const sessionId = uuidv4();

    const sessionData: UserSession = {
      id: user.id.toString(),
      email: user.email,
      first_name: user.first_name ?? undefined,
      last_name: user.last_name ?? undefined,
      role: user.role_name ?? 'customer',
      last_active: new Date().toISOString(),
    };

    const ttl =
      parseInt(
        this.configService.get<string>('JWT_EXPIRATION_SECONDS') ?? '604800',
      ) * 1000;

    await this.createSession(sessionId, sessionData, user.id.toString(), ttl);

    this.setTokenCookie(response, token, sessionId);

    response.cookie('auth_token', token, {
      maxAge: ttl,
      path: '/',
      sameSite: 'lax',
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      httpOnly: false,
    });

    return {
      access_token: token,
      session_id: sessionId,
      user: {
        id: user.id,
        email: user.email,
        role: user.role_name ?? 'customer',
        first_name: user.first_name,
        last_name: user.last_name,
        User_id: user.User_id.toString(),
      },
      message: 'เข้าสู่ระบบสำเร็จ',
    };
  }

  // Rest of the code remains unchanged...
  async register(createUserDto: CreateUserDto, response: Response) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('อีเมลนี้มีผู้ใช้งานอยู่แล้ว');
    }

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    let customerRole = await this.prisma.role.findUnique({
      where: { name: 'customer' },
    });
    if (!customerRole) {
      customerRole = await this.prisma.role.create({
        data: {
          name: 'customer',
          description: 'ลูกค้าที่มีสิทธิ์ในการสั่งอาหารและเครื่องดื่ม',
        },
      });
    }
    const user = await this.prisma.user.create({
      data: {
        ...createUserDto,
        password: hashedPassword,
        User_id: BigInt(Date.now()),
        role_id: customerRole.id,
      },
      include: { role: true },
    });

    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role?.name,
    };
    const token = this.jwtService.sign(payload);

    const sessionId = uuidv4();

    const sessionData: UserSession = {
      id: user.id.toString(),
      email: user.email,
      first_name: user.first_name ?? undefined,
      last_name: user.last_name ?? undefined,
      role: user.role?.name,
      last_active: new Date().toISOString(),
    };

    const ttl =
      parseInt(
        this.configService.get<string>('JWT_EXPIRATION_SECONDS') ?? '604800',
      ) * 1000;

    await this.createSession(sessionId, sessionData, user.id.toString(), ttl);

    this.setTokenCookie(response, token, sessionId);

    response.cookie('customer', token, {
      maxAge: ttl,
      path: '/',
      sameSite: 'lax',
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      httpOnly: false,
    });

    const { password: _password, ...result } = user;
    return {
      ...result,
      access_token: token,
      session_id: sessionId,
      User_id: user.User_id.toString(),
      role_name: user.role?.name,
      message: 'ลงทะเบียนสำเร็จ',
    };
  }
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    return { message: 'Password changed successfully' };
  }

  async logout(response: Response, request: Request) {
    const sessionId = request.cookies['session_id'] as string | undefined;

    if (sessionId) {
      const userData = await this.sessionService.getUserData(sessionId);
      if (userData?.id) {
        await this.sessionService.invalidateSession(sessionId);
      }
    }

    this.clearTokenCookie(response);

    response.cookie('auth_token', '', {
      maxAge: 0,
      path: '/',
    });

    response.cookie('session_id', '', {
      maxAge: 0,
      path: '/',
    });

    return { message: 'ออกจากระบบสำเร็จ' };
  }

  private async createSession(
    sessionId: string,
    sessionData: UserSession,
    userId: string,
    ttl: number,
  ): Promise<void> {
    await this.storeSessionData(sessionId, sessionData, ttl);
    const userSessions = await this.getUserSessionIds(userId);
    userSessions.push(sessionId);
    await this.storeUserSessionIds(userId, userSessions, ttl);
  }

  private async storeSessionData(
    sessionId: string,
    sessionData: UserSession,
    ttl: number,
  ): Promise<void> {
    const sessionKey = `session:${sessionId}`;
    await this.sessionService['cacheManager'].set(sessionKey, sessionData, ttl);
  }

  private async getUserSessionIds(userId: string): Promise<string[]> {
    const userSessionsKey = `user-sessions:${userId}`;
    return (
      (await this.sessionService['cacheManager'].get<string[]>(
        userSessionsKey,
      )) ?? []
    );
  }

  private async storeUserSessionIds(
    userId: string,
    sessionIds: string[],
    ttl: number,
  ): Promise<void> {
    const userSessionsKey = `user-sessions:${userId}`;
    await this.sessionService['cacheManager'].set(
      userSessionsKey,
      sessionIds,
      ttl,
    );
  }

  public setTokenCookie(response: Response, token: string, sessionId: string) {
    const secure = this.configService.get<string>('NODE_ENV') === 'production';
    const domain = this.configService.get<string>('NODE_ENV') === 'production' 
    ? this.configService.get<string>('COOKIE_DOMAIN') 
    : undefined; // ไม่ตั้ง domain สำหรับ development

    const maxAge =
      parseInt(
        this.configService.get<string>('JWT_EXPIRATION_SECONDS') ?? '604800',
      ) * 1000;

        console.log('🍪 Setting cookies with config:', {
    secure,
    domain,
    maxAge,
    nodeEnv: this.configService.get<string>('NODE_ENV')
  });

    response.cookie('auth_token', token, {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      domain,
      maxAge,
      path: '/',
    });

    response.cookie('session_id', sessionId, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      domain,
      maxAge,
      path: '/',
    });

    console.log('✅ Cookies set successfully');
  }

  private clearTokenCookie(response: Response) {
    const domain = this.configService.get<string>('NODE_ENV') === 'production' 
    ? this.configService.get<string>('COOKIE_DOMAIN') 
    : undefined;

      console.log('🗑️ Clearing cookies with domain:', domain);

    response.clearCookie('auth_token', {
      httpOnly: false,
      domain,
      path: '/',
    });

    response.clearCookie('session_id', {
      httpOnly: true,
      domain,
      path: '/',
    });
  }

  async getUserActiveSessions(userId: string) {
    return await this.sessionService.getUserSessions(userId);
  }

  async invalidateAllUserSessions(userId: string) {
    return await this.sessionService.invalidateAllUserSessions(userId);
  }

  async getOnlineUsersCount() {
    return await this.sessionService.getOnlineUsersCount();
  }
}
