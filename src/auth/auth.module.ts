import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SocialAuthController } from './social/social-auth.controller';
import { SocialAuthService } from './social/social-auth.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionModule } from '../session/session.module';
import { EmailVerificationService } from '../email-verification/email-verification.service';

@Module({
  imports: [
    UsersModule,
    SessionModule,
    PrismaModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRATION', '7d'),
        },
      }),
    }),
  ],
  controllers: [AuthController, SocialAuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    SocialAuthService,
    EmailVerificationService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
