import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SessionService } from './session.service';

interface RequestWithUser {
  user: {
    userId: string;
    role: string;
  };
}

@Controller('sessions')
export class SessionController {
  constructor(
    private readonly sessionService: SessionService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('count')
  async getOnlineUsersCount() {
    const count = await this.sessionService.getOnlineUsersCount();
    return { count };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('online')
  async getOnlineUsers() {
    const users = await this.sessionService.getOnlineUsers();
    return { users };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-sessions')
  async getUserSessions(@Request() req: RequestWithUser) {
    const userId = req.user.userId;
    const sessions = await this.sessionService.getUserSessions(userId);
    return { sessions };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':sessionId')
  async invalidateSession(
    @Request() req: RequestWithUser,
    @Param('sessionId') sessionId: string,
  ) {
    const sessionData = await this.sessionService.getUserData(sessionId);

    if (
      sessionData &&
      (sessionData.id === req.user.userId || req.user.role === 'admin')
    ) {
      await this.sessionService.invalidateSession(sessionId);
      return { message: 'ออกจากระบบสำเร็จ' };
    }

    throw new ForbiddenException('คุณไม่มีสิทธิ์ในการจัดการเซสชันนี้');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete('user/:userId')
  async invalidateAllUserSessions(@Param('userId') userId: string) {
    await this.sessionService.invalidateAllUserSessions(userId);
    return { message: 'ออกจากระบบทั้งหมดสำเร็จ' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @Post('logout/all')
  async logoutAllUsers() {
    try {
      const client = (this.cacheManager as any).store.getClient();
      await client.flushDb();
      return { message: 'ออกจากระบบผู้ใช้ทั้งหมดสำเร็จ' };
    } catch (error) {
      return {
        message: 'เกิดข้อผิดพลาดในการออกจากระบบผู้ใช้ทั้งหมด',
        error: error.message,
      };
    }
  }
}
