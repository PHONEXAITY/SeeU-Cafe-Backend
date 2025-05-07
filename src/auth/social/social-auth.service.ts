import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailVerificationService } from '../../email-verification/email-verification.service';
import { AuthService } from '../auth.service';
import axios from 'axios';
import * as bcrypt from 'bcrypt';
import { User } from '../../types/user'; // นำเข้า type

interface GoogleUserInfo {
  email: string;
  given_name: string;
  family_name: string;
  picture: string;
}
interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
}

interface FacebookUserInfo {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

@Injectable()
export class SocialAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly authService: AuthService,
  ) {}

  async authenticateWithGoogle(token: string, response: Response) {
    try {
      const googleUserInfo = await this.verifyGoogleToken(token);

      if (!googleUserInfo) {
        throw new Error('Invalid token');
      }

      const user = await this.findOrCreateSocialUser(
        googleUserInfo.email,
        googleUserInfo.given_name,
        googleUserInfo.family_name,
        googleUserInfo.picture,
        'google',
      );

      return this.handleSocialAuthSuccess(user, response);
    } catch (error) {
      console.error('Google authentication error:', error);
      throw new UnauthorizedException('Google authentication failed');
    }
  }

  async authenticateWithFacebook(token: string, response: Response) {
    try {
      const facebookUserInfo = await this.verifyFacebookToken(token);

      if (!facebookUserInfo) {
        throw new Error('Invalid token');
      }

      const user = await this.findOrCreateSocialUser(
        facebookUserInfo.email,
        facebookUserInfo.first_name,
        facebookUserInfo.last_name,
        facebookUserInfo.picture?.data?.url,
        'facebook',
      );

      return this.handleSocialAuthSuccess(user, response);
    } catch (error) {
      console.error('Facebook authentication error:', error);
      throw new UnauthorizedException('Facebook authentication failed');
    }
  }

  private async verifyGoogleToken(
    token: string,
  ): Promise<GoogleUserInfo | null> {
    try {
      const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
      const clientSecret = this.configService.get<string>(
        'GOOGLE_CLIENT_SECRET',
      );

      // Verify token with Google OAuth
      const response = await axios.post<GoogleTokenResponse>(
        'https://oauth2.googleapis.com/token',
        {
          code: token,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: 'http://localhost:3000/auth/google/callback',
          grant_type: 'authorization_code',
        },
      );

      const accessToken = response.data.access_token;
      const userInfoResponse = await axios.get<GoogleUserInfo>(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      return userInfoResponse.data;
    } catch (error) {
      console.error('Google token verification error:', error);
      return null;
    }
  }

  private async verifyFacebookToken(
    token: string,
  ): Promise<FacebookUserInfo | null> {
    try {
      const appId = this.configService.get<string>('FACEBOOK_APP_ID');
      const appSecret = this.configService.get<string>('FACEBOOK_APP_SECRET');

      const appAccessTokenResponse = await axios.get<{
        access_token: string;
      }>(
        `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`,
      );

      const appAccessToken = appAccessTokenResponse.data.access_token;

      const debugTokenResponse = await axios.get<{
        data: { is_valid: boolean };
      }>(
        `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${appAccessToken}`,
      );

      if (!debugTokenResponse.data.data.is_valid) {
        return null;
      }

      const userInfoResponse = await axios.get<FacebookUserInfo>(
        `https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture&access_token=${token}`,
      );

      return userInfoResponse.data;
    } catch (error) {
      console.error('Facebook token verification error:', error);
      return null;
    }
  }

  private async findOrCreateSocialUser(
    email: string,
    firstName: string | null,
    lastName: string | null,
    profilePhoto: string | undefined,
    provider: 'google' | 'facebook',
  ) {
    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    const safeFirstName = firstName ?? '';
    const safeLastName = lastName ?? '';

    if (user) {
      if (
        user.first_name !== safeFirstName ||
        user.last_name !== safeLastName ||
        user.profile_photo !== profilePhoto
      ) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            first_name: safeFirstName,
            last_name: safeLastName,
            profile_photo: profilePhoto,
          },
          include: { role: true },
        });
      }
      return user;
    }

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

    const randomPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        first_name: safeFirstName,
        last_name: safeLastName,
        profile_photo: profilePhoto,
        User_id: BigInt(Date.now()),
        email_verified: true,
        role: { connect: { id: customerRole.id } },
        social_provider: provider,
      },
      include: { role: true },
    });

    return user;
  }

  private handleSocialAuthSuccess(user: User, response: Response) {
    const payload = {
      email: user.email,
      sub: user.id,
      role: user.role?.name,
    };

    const token = this.jwtService.sign(payload);

    this.authService.setTokenCookie(response, token, user.id.toString());

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role?.name,
        first_name: user.first_name,
        last_name: user.last_name,
        User_id: user.User_id.toString(),
        profile_photo: user.profile_photo,
      },
      message: 'เข้าสู่ระบบสำเร็จ',
    };
  }

  async verifyEmail(email: string, code: string): Promise<boolean> {
    return this.emailVerificationService.verifyEmail(email, code);
  }

  async resendVerificationCode(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return false;
    }

    if (user.email_verified) {
      return false;
    }

    return this.emailVerificationService.createVerificationAndSendEmail(
      user.id,
      email,
      user.first_name ?? undefined,
    );
  }

  async sendPasswordResetEmail(email: string): Promise<boolean> {
    return this.emailVerificationService.sendPasswordResetEmail(email);
  }

  async verifyResetToken(token: string): Promise<number | null> {
    return this.emailVerificationService.verifyResetToken(token);
  }

  async resetPassword(token: string, password: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(password, 10);
    return this.emailVerificationService.resetPassword(token, hashedPassword);
  }
}
