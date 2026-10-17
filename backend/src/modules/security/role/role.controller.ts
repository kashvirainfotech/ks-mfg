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
import { RoleService } from './role.service';
import type {
  CreateRoleDto,
  UpdateRoleDto,
  UpdateRoleMatrixDto,
} from './role.dto';

@Controller('security/roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

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
  @RequirePermission('ROLE_MASTER', 'VIEW')
  async findAllRoles() {
    return this.roleService.findAllRoles();
  }

  @Get(':id')
  @RequirePermission('ROLE_MASTER', 'VIEW')
  async findRoleById(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.findRoleById(id);
  }

  @Post()
  @RequirePermission('ROLE_MASTER', 'ADD')
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.roleService.createRole(dto, user, this.extractMeta(req));
  }

  @Put(':id')
  @RequirePermission('ROLE_MASTER', 'EDIT')
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.roleService.updateRole(id, dto, user, this.extractMeta(req));
  }

  @Delete(':id')
  @RequirePermission('ROLE_MASTER', 'DELETE')
  async deleteRole(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.roleService.deleteRole(id, user, this.extractMeta(req));
  }

  @Get(':id/matrix')
  @RequirePermission('ROLE_MASTER', 'VIEW')
  async getRoleMatrix(@Param('id', ParseIntPipe) id: number) {
    return this.roleService.getRoleMatrix(id);
  }

  @Put(':id/matrix')
  @RequirePermission('ROLE_MASTER', 'EDIT')
  async updateRoleMatrix(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleMatrixDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.roleService.updateRoleMatrix(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Post('action/:actionType')
  @RequirePermission('ROLE_MASTER', 'VIEW')
  async recordRoleAction(
    @Param('actionType') actionType: 'PRINT' | 'EXPORT',
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    await this.roleService.recordScreenAction(
      actionType,
      user,
      this.extractMeta(req),
    );
    return { logged: true };
  }
}
