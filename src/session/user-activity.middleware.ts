import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SessionService } from './session.service';

interface RequestWithAuth extends Request {
  headers: {
    authorization?: string;
  };
}

@Injectable()
export class UserActivityMiddleware implements NestMiddleware {
  constructor(private readonly sessionService: SessionService) {}

  async use(req: RequestWithAuth, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token) {
        await this.sessionService.updateUserActivity(token);
      }
    }

    next();
  }
}
