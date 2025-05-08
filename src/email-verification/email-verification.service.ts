import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordReset } from '../types/password-reset';
@Injectable()
export class EmailVerificationService {
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const emailHost = this.configService.get<string>('EMAIL_HOST');
    const emailPort = this.configService.get<number>('EMAIL_PORT', 587);
    const emailUser = this.configService.get<string>('EMAIL_USER');
    const emailPassword = this.configService.get<string>('EMAIL_PASSWORD');

    if (!emailHost || !emailUser || !emailPassword) {
      throw new InternalServerErrorException(
        'SMTP configuration is incomplete',
      );
    }

    this.transporter = nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: emailPort === 465, // ใช้ SSL/TLS สำหรับพอร์ต 465, STARTTLS สำหรับ 587
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });

    this.transporter.verify((error) => {
      if (error) {
        console.error('SMTP connection verification failed:', error);
      } else {
        console.log('SMTP connection verified successfully');
      }
    });
  }

  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async storeVerificationCode(
    userId: number,
    email: string,
    code: string,
  ): Promise<void> {
    const existingVerification = await this.prisma.emailVerification.findFirst({
      where: { user_id: userId },
    });

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    if (existingVerification) {
      await this.prisma.emailVerification.update({
        where: { id: existingVerification.id },
        data: {
          code,
          expires_at: expiresAt,
          attempts: 0,
        },
      });
    } else {
      await this.prisma.emailVerification.create({
        data: {
          user_id: userId,
          email,
          code,
          expires_at: expiresAt,
          attempts: 0,
        },
      });
    }
  }

  async sendVerificationEmail(
    email: string,
    code: string,
    firstName?: string,
  ): Promise<boolean> {
    try {
      const appName = this.configService.get<string>(
        'SeeU Cafe',
        'SeeU Cafe Ordering System',
      );

      const mailOptions = {
        from: `"${appName}" <${this.configService.get<string>('EMAIL_FROM')}>`,
        to: email,
        subject: `${appName} - Verify Your Email Address`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e6e6e6; border-radius: 5px;">
            <h2 style="color: #333; text-align: center;">Verify Your Email Address</h2>
            <p>Hello ${firstName || 'there'},</p>
            <p>Thank you for registering with ${appName}. To complete your registration, please enter the following verification code:</p>
            <div style="background-color: #f7f7f7; padding: 15px; text-align: center; margin: 20px 0; border-radius: 5px;">
              <h1 style="font-size: 32px; letter-spacing: 5px; margin: 0; color: #4a4a4a;">${code}</h1>
            </div>
            <p>This code will expire in 24 hours.</p>
            <p>If you did not request this verification, please ignore this email.</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e6e6e6; text-align: center; color: #777; font-size: 12px;">
              <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
            </div>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Verification email sent to: ${email}`);
      return true;
    } catch (error) {
      console.error('Error sending verification email:', error);
      return false;
    }
  }

  async createVerificationAndSendEmail(
    userId: number,
    email: string,
    firstName?: string,
  ): Promise<boolean> {
    const code = this.generateVerificationCode();
    await this.storeVerificationCode(userId, email, code);
    return this.sendVerificationEmail(email, code, firstName);
  }

  async verifyEmail(email: string, code: string): Promise<boolean> {
    const verification = await this.prisma.emailVerification.findFirst({
      where: { email },
      include: { user: true },
    });

    if (!verification) {
      return false;
    }

    if (verification.expires_at < new Date()) {
      return false;
    }

    if (verification.attempts >= 5) {
      return false;
    }

    await this.prisma.emailVerification.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });

    if (verification.code !== code) {
      return false;
    }

    await this.prisma.user.update({
      where: { id: verification.user_id },
      data: { email_verified: true },
    });

    await this.prisma.emailVerification.delete({
      where: { id: verification.id },
    });

    return true;
  }

  async sendPasswordResetEmail(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`No user found for email: ${email}`);
      return false;
    }
    console.log(`Found user for email: ${email}, ID: ${user.id}`);
    const token = this.generateResetToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.prisma.passwordReset.upsert({
      where: { user_id: user.id },
      update: {
        token,
        expires_at: expiresAt,
        used: false,
      },
      create: {
        user_id: user.id,
        token,
        expires_at: expiresAt,
      },
    });

    const appName = this.configService.get<string>(
      'SeeU Cafe',
      'SeeU Cafe Ordering System',
    );
    const appUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3001',
    );

    const resetLink = `${appUrl}/reset-password/${token}`;

    try {
      const mailOptions = {
        from: `"${appName}" <${this.configService.get<string>('EMAIL_FROM')}>`,
        to: email,
        subject: `${appName} - Reset Your Password`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e6e6e6; border-radius: 5px;">
            <h2 style="color: #333; text-align: center;">Reset Your Password</h2>
            <p>Hello ${user.first_name || 'there'},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #987070; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
            </div>
            <p>This link will expire in 24 hours.</p>
            <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e6e6e6; text-align: center; color: #777; font-size: 12px;">
              <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
            </div>
          </div>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to: ${email}`);
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return false;
    }
  }

  private generateResetToken(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  async verifyResetToken(token: string): Promise<number | null> {
    const resetRecord: PasswordReset | null =
      await this.prisma.passwordReset.findFirst({
        where: { token },
      });

    if (!resetRecord) {
      return null;
    }

    if (resetRecord.expires_at < new Date()) {
      return null;
    }

    if (resetRecord.used) {
      return null;
    }

    return resetRecord.user_id;
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const userId = await this.verifyResetToken(token);

    if (!userId) {
      return false;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: newPassword },
    });

    await this.prisma.passwordReset.updateMany({
      where: { user_id: userId },
      data: { used: true },
    });

    return true;
  }
}
