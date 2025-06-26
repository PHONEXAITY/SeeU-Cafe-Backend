import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserPayload } from '../strategies/jwt.strategy';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    console.log('\n=== JwtAuthGuard ===');
    const request = context.switchToHttp().getRequest();
    console.log('Request URL:', request.url);
    console.log('Method:', request.method);
    const authHeader = request.headers.authorization;
    console.log(
      'Authorization Header:',
      authHeader ? `${authHeader.substring(0, 20)}...` : 'None',
    );

    // ตรวจสอบ Cookies
    const authToken = request.cookies?.auth_token;
    console.log(
      'Auth Token Cookie:',
      authToken ? `${authToken.substring(0, 20)}...` : 'None',
    );

    return super.canActivate(context);
  }

  handleRequest<TUser = UserPayload>(
    err: Error | null,
    user: TUser | false,
    info: any,
  ): TUser {
    console.log('\n=== JwtAuthGuard handleRequest ===');
    console.log('Error:', err);
    console.log('User:', user);
    console.log('Info:', info);

    if (err || !user) {
      console.log('✗ Authentication failed');
      throw (
        err ||
        new UnauthorizedException(info?.message || 'Authentication failed')
      );
    }

    console.log('✓ Authentication successful');
    return user;
  }
}
