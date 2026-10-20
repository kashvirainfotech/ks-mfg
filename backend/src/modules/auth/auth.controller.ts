import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  LoginSchema,
  SwitchContextSchema,
  UpdateUserPreferenceSchema,
} from './auth.dto';
import {
  CurrentUser,
  Public,
} from '../../common/decorators/auth.decorators';
import type { AuthenticatedUserContext } from '../../common/decorators/auth.decorators';

const REFRESH_COOKIE_NAME = 'ksmfg_refresh_token';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: unknown,
    @Req() req: Request & { correlationId?: string; __auditLogged?: boolean },
    @Res({ passthrough: true }) res: Response,
  ) {
    const dto = LoginSchema.parse(body);
    req.__auditLogged = true;
    const result = await this.authService.login(dto, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    });

    this.setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUserContext) {
    return this.authService.getMe(user);
  }

  @Post('switch-context')
  @HttpCode(HttpStatus.OK)
  async switchContext(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() body: unknown,
    @Req() req: Request & { __auditLogged?: boolean },
    @Res({ passthrough: true }) res: Response,
  ) {
    const dto = SwitchContextSchema.parse(body);
    req.__auditLogged = true;
    const result = await this.authService.switchContext(user, dto);
    this.setRefreshCookie(res, result.refreshToken);
    return result;
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() body: unknown,
    @Req() req: Request & { correlationId?: string; __auditLogged?: boolean },
  ) {
    const dto = UpdateUserPreferenceSchema.parse(body);
    req.__auditLogged = true;
    return this.authService.updatePreferences(user, dto, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() req: Request & { cookies?: Record<string, string>; __auditLogged?: boolean },
    @Res({ passthrough: true }) res: Response,
  ) {
    req.__auditLogged = true;
    const token =
      req.cookies?.[REFRESH_COOKIE_NAME] || body?.refreshToken;
    const tokens = await this.authService.refreshTokens(token);
    this.setRefreshCookie(res, tokens.refreshToken);
    return tokens;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUserContext,
    @Req()
    req: Request & {
      cookies?: Record<string, string>;
      correlationId?: string;
      __auditLogged?: boolean;
    },
    @Res({ passthrough: true }) res: Response,
  ) {
    req.__auditLogged = true;
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie(REFRESH_COOKIE_NAME, {
      path: '/',
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    });
    return this.authService.logout(user, refreshToken, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    });
  }

  private setRefreshCookie(res: Response, token: string) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
}
