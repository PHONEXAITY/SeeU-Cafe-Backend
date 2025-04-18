import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UserSession } from './interfaces/user-session.interface';

@Injectable()
export class SessionService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getOnlineUsersCount(): Promise<number> {
    const pattern = 'session:*';
    const keys = await this.scanKeys(pattern);
    return keys.length;
  }

  async getOnlineUsers(): Promise<UserSession[]> {
    const pattern = 'session:*';
    const keys = await this.scanKeys(pattern);

    const users: UserSession[] = [];
    for (const key of keys) {
      const userData = await this.cacheManager.get<UserSession>(key);
      if (userData) {
        users.push(userData);
      }
    }

    return users;
  }

  async updateUserActivity(sessionId: string): Promise<void> {
    const userData = await this.cacheManager.get<UserSession>(
      `session:${sessionId}`,
    );
    if (userData) {
      userData.last_active = new Date().toISOString();

      const ttl =
        parseInt(
          this.configService.get<string>('JWT_EXPIRATION_SECONDS') || '604800',
        ) * 1000;

      await this.cacheManager.set(`session:${sessionId}`, userData, ttl);
    }
  }

  async createUserSession(
    sessionId: string,
    userData: UserSession,
    ttl: number,
  ): Promise<void> {
    await this.cacheManager.set(`session:${sessionId}`, userData, ttl);
  }

  async addSessionToUser(
    userId: string,
    sessionId: string,
    ttl: number,
  ): Promise<void> {
    const userSessions =
      (await this.cacheManager.get<string[]>(`user-sessions:${userId}`)) || [];
    userSessions.push(sessionId);
    await this.cacheManager.set(`user-sessions:${userId}`, userSessions, ttl);
  }
  async getUserData(sessionId: string): Promise<UserSession | null> {
    return (
      (await this.cacheManager.get<UserSession>(`session:${sessionId}`)) || null
    );
  }

  async extendSession(sessionId: string): Promise<void> {
    const userData = await this.cacheManager.get<UserSession>(
      `session:${sessionId}`,
    );
    if (userData) {
      const ttl =
        parseInt(
          this.configService.get<string>('JWT_EXPIRATION_SECONDS') || '604800',
        ) * 1000;

      await this.cacheManager.set(`session:${sessionId}`, userData, ttl);

      if (userData.id) {
        const userSessions =
          (await this.cacheManager.get<string[]>(
            `user-sessions:${userData.id}`,
          )) || [];
        await this.cacheManager.set(
          `user-sessions:${userData.id}`,
          userSessions,
          ttl,
        );
      }
    }
  }

  async hasActiveSessions(userId: string): Promise<boolean> {
    const userSessions = await this.cacheManager.get<string[]>(
      `user-sessions:${userId}`,
    );
    return Array.isArray(userSessions) && userSessions.length > 0;
  }

  async getUserSessions(
    userId: string,
  ): Promise<{ sessionId: string; userData: UserSession }[]> {
    const sessionIds =
      (await this.cacheManager.get<string[]>(`user-sessions:${userId}`)) || [];

    const sessions: { sessionId: string; userData: UserSession }[] = [];

    for (const sessionId of sessionIds) {
      const sessionData = await this.cacheManager.get<UserSession>(
        `session:${sessionId}`,
      );
      if (sessionData) {
        sessions.push({
          sessionId,
          userData: sessionData,
        });
      }
    }

    return sessions;
  }

  async invalidateSession(sessionId: string): Promise<void> {
    const userData = await this.cacheManager.get<UserSession>(
      `session:${sessionId}`,
    );
    if (userData && userData.id) {
      await this.cacheManager.del(`session:${sessionId}`);

      const userSessions =
        (await this.cacheManager.get<string[]>(
          `user-sessions:${userData.id}`,
        )) || [];
      const updatedSessions = userSessions.filter((id) => id !== sessionId);

      if (updatedSessions.length > 0) {
        await this.cacheManager.set(
          `user-sessions:${userData.id}`,
          updatedSessions,
          parseInt(
            this.configService.get<string>('JWT_EXPIRATION_SECONDS') ||
              '604800',
          ) * 1000,
        );
      } else {
        await this.cacheManager.del(`user-sessions:${userData.id}`);
      }
    }
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    const userSessions =
      (await this.cacheManager.get<string[]>(`user-sessions:${userId}`)) || [];

    for (const sessionId of userSessions) {
      await this.cacheManager.del(`session:${sessionId}`);
    }

    await this.cacheManager.del(`user-sessions:${userId}`);
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    try {
      const client = (this.cacheManager as any).store.getClient();

      return new Promise<string[]>((resolve, reject) => {
        const keys: string[] = [];
        const stream = client.scanStream({
          match: pattern,
          count: 100,
        });

        stream.on('data', (resultKeys: string[]) => {
          keys.push(...resultKeys);
        });

        stream.on('end', () => {
          resolve(keys);
        });

        stream.on('error', (err: Error) => {
          reject(err);
        });
      });
    } catch (error) {
      console.error('Error scanning Redis keys:', error);
      return [];
    }
  }

  async cleanupExpiredSessions(): Promise<void> {
    const pattern = 'session:*';
    const keys = await this.scanKeys(pattern);

    for (const key of keys) {
      const userData = await this.cacheManager.get<UserSession>(key);
      if (!userData) {
        const sessionId = key.replace('session:', '');
        const userId = await this.findUserIdBySession(sessionId);

        if (userId) {
          const userSessions =
            (await this.cacheManager.get<string[]>(
              `user-sessions:${userId}`,
            )) || [];
          const updatedSessions = userSessions.filter((id) => id !== sessionId);

          if (updatedSessions.length > 0) {
            await this.cacheManager.set(
              `user-sessions:${userId}`,
              updatedSessions,
              parseInt(
                this.configService.get<string>('JWT_EXPIRATION_SECONDS') ||
                  '604800',
              ) * 1000,
            );
          } else {
            await this.cacheManager.del(`user-sessions:${userId}`);
          }
        }
      }
    }
  }

  private async findUserIdBySession(sessionId: string): Promise<string | null> {
    const pattern = 'user-sessions:*';
    const keys = await this.scanKeys(pattern);

    for (const key of keys) {
      const userSessions = (await this.cacheManager.get<string[]>(key)) || [];
      if (userSessions.includes(sessionId)) {
        return key.replace('user-sessions:', '');
      }
    }

    return null;
  }
}
