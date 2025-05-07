import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SocialAuthService } from './social-auth.service';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { FacebookAuthDto } from './dto/facebook-auth.dto';
import { EmailVerificationDto } from './dto/email-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyResetTokenDto } from './dto/verify-reset-token.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UseGuards } from '@nestjs/common';
import { DisconnectSocialDto } from './dto/disconnect-social.dto';
import { UserPayload } from '../strategies/jwt.strategy';

interface RequestWithUser extends Request {
  user: UserPayload;
}

@ApiTags('Auth - Social & Verification')
@Controller('auth')
export class SocialAuthController {
  constructor(private readonly socialAuthService: SocialAuthService) {}

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleLogin(
    @Body() googleAuthDto: GoogleAuthDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const result = await this.socialAuthService.authenticateWithGoogle(
        googleAuthDto.token,
        response,
      );
      return result;
    } catch (error) {
      if (error.message === 'Invalid token') {
        throw new BadRequestException('Invalid Google token');
      }
      throw new UnauthorizedException('Google authentication failed');
    }
  }

  @Post('facebook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with Facebook' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 400, description: 'Invalid token' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiBody({ type: FacebookAuthDto })
  async facebookLogin(
    @Body() facebookAuthDto: FacebookAuthDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const result = await this.socialAuthService.authenticateWithFacebook(
        facebookAuthDto.token,
        response,
      );
      return result;
    } catch (error) {
      if (error.message === 'Invalid token') {
        throw new BadRequestException('Invalid Facebook token');
      }
      throw new UnauthorizedException('Facebook authentication failed');
    }
  }

  @Post('disconnect-social')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect social login' })
  @ApiResponse({
    status: 200,
    description: 'Social account disconnected successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Failed to disconnect social account',
  })
  @ApiBody({ type: DisconnectSocialDto })
  async disconnectSocial(
    @Req() req: RequestWithUser,
    @Body() disconnectSocialDto: DisconnectSocialDto,
  ) {
    try {
      const success = await this.socialAuthService.disconnectSocial(
        req.user.id,
        disconnectSocialDto.provider,
      );

      if (!success) {
        throw new BadRequestException('Failed to disconnect social account');
      }

      return { message: 'Social account disconnected successfully' };
    } catch (error) {
      throw new BadRequestException(
        error.message || 'Failed to disconnect social account',
      );
    }
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email with OTP code' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired code' })
  @ApiResponse({ status: 404, description: 'Email not found' })
  @ApiBody({ type: EmailVerificationDto })
  async verifyEmail(@Body() emailVerificationDto: EmailVerificationDto) {
    const verified = await this.socialAuthService.verifyEmail(
      emailVerificationDto.email,
      emailVerificationDto.code,
    );

    if (!verified) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    return { message: 'Email verified successfully' };
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification code' })
  @ApiResponse({
    status: 200,
    description: 'Verification code sent successfully',
  })
  @ApiResponse({ status: 404, description: 'Email not found' })
  @ApiBody({ type: ResendVerificationDto })
  async resendVerification(
    @Body() resendVerificationDto: ResendVerificationDto,
  ) {
    const success = await this.socialAuthService.resendVerificationCode(
      resendVerificationDto.email,
    );

    if (!success) {
      throw new NotFoundException('Email not found or already verified');
    }

    return { message: 'Verification code sent successfully' };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  @ApiResponse({ status: 404, description: 'Email not found' })
  @ApiBody({ type: ForgotPasswordDto })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    const success = await this.socialAuthService.sendPasswordResetEmail(
      forgotPasswordDto.email,
    );

    if (!success) {
      throw new NotFoundException('Email not found');
    }

    return { message: 'Password reset instructions sent to your email' };
  }

  @Post('verify-reset-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify password reset token' })
  @ApiResponse({ status: 200, description: 'Token is valid' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ApiBody({ type: VerifyResetTokenDto })
  async verifyResetToken(@Body() verifyResetTokenDto: VerifyResetTokenDto) {
    const userId = await this.socialAuthService.verifyResetToken(
      verifyResetTokenDto.token,
    );

    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    return { valid: true };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  @ApiBody({ type: ResetPasswordDto })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    const success = await this.socialAuthService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.password,
    );

    if (!success) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    return { message: 'Password reset successfully' };
  }
}
