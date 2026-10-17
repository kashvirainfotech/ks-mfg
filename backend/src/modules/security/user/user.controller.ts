import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CurrentUser,
  RequirePermission,
} from '../../../common/decorators/auth.decorators';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import { UserService } from './user.service';
import type {
  CreateUserDto,
  ResetUserPasswordDto,
  UpdateUserDto,
  UpdateUserRoleAssignmentsDto,
} from './user.dto';

@Controller('security/users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  private extractMeta(req: Request) {
    return {
      ipAddress:
        (req.headers['x-forwarded-for'] as string) ||
        req.socket?.remoteAddress ||
        '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'unknown',
      correlationId: (req.headers['x-correlation-id'] as string) || undefined,
    };
  }

  @Get()
  @RequirePermission('USER_MASTER', 'VIEW')
  async findAllUsers() {
    return this.userService.findAllUsers();
  }

  @Get(':id')
  @RequirePermission('USER_MASTER', 'VIEW')
  async findUserById(@Param('id', ParseIntPipe) id: number) {
    return this.userService.findUserById(id);
  }

  @Post()
  @RequirePermission('USER_MASTER', 'ADD')
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.userService.createUser(dto, user, this.extractMeta(req));
  }

  @Put(':id')
  @RequirePermission('USER_MASTER', 'EDIT')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.userService.updateUser(id, dto, user, this.extractMeta(req));
  }

  @Put(':id/role-assignments')
  @RequirePermission('USER_MASTER', 'EDIT')
  async updateRoleAssignments(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserRoleAssignmentsDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.userService.updateRoleAssignments(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Put(':id/reset-password')
  @RequirePermission('USER_MASTER', 'EDIT')
  async resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.userService.resetPassword(id, dto, user, this.extractMeta(req));
  }

  @Put(':id/unlock')
  @RequirePermission('USER_MASTER', 'EDIT')
  async unlockAccount(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.userService.unlockAccount(id, user, this.extractMeta(req));
  }

  @Delete(':id')
  @RequirePermission('USER_MASTER', 'DELETE')
  async deleteUser(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.userService.deleteUser(id, user, this.extractMeta(req));
  }

  @Post('action/:actionType')
  @RequirePermission('USER_MASTER', 'VIEW')
  async recordUserAction(
    @Param('actionType') actionType: 'PRINT' | 'EXPORT',
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    await this.userService.recordScreenAction(
      actionType,
      user,
      this.extractMeta(req),
    );
    return { logged: true };
  }
}
