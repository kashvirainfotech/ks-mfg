import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  IS_PUBLIC_KEY,
  AuthenticatedUserContext,
} from '../decorators/auth.decorators';
import { RedisService } from '../services/redis.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization Bearer token.',
      );
    }

    const token = authHeader.slice(7).trim();
    try {
      const secret =
        this.configService.get<string>('JWT_ACCESS_SECRET') ||
        'ks-mfg-erp-super-secret-access-key-2026';
      const payload = await this.jwtService.verifyAsync(token, { secret });

      // Check Redis revocation blacklist
      const blacklistKey = payload.jti || token;
      const isRevoked =
        await this.redisService.isTokenBlacklisted(blacklistKey);
      if (isRevoked) {
        throw new UnauthorizedException('Session token has been revoked.');
      }

      // Allow active tenant context override via headers if provided
      const headerCompId = Number(request.headers['x-comp-id']);
      const headerBranchId = Number(request.headers['x-branch-id']);
      const headerFyearId = Number(request.headers['x-fyear-id']);

      const userContext: AuthenticatedUserContext = {
        userId: Number(payload.sub),
        username: payload.username,
        fullName: payload.fullName,
        email: payload.email,
        userCategory: payload.userCategory || 'EMPLOYEE',
        isSuperAdmin: Boolean(payload.isSuperAdmin),
        compId:
          !Number.isNaN(headerCompId) && headerCompId > 0
            ? headerCompId
            : Number(payload.compId || 1001),
        branchId:
          !Number.isNaN(headerBranchId) && headerBranchId > 0
            ? headerBranchId
            : Number(payload.branchId || 1001),
        fyearId:
          !Number.isNaN(headerFyearId) && headerFyearId > 0
            ? headerFyearId
            : Number(payload.fyearId || 1001),
        jti: payload.jti,
      };

      request.user = userContext;
      return true;
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }
}
