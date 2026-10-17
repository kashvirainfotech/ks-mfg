import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { BranchService } from './branch.service';
import { CreateBranchSchema, UpdateBranchSchema } from './branch.dto';
import {
  CurrentUser,
  RequirePermission,
} from '../../../common/decorators/auth.decorators';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';

@Controller('org/branches')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get()
  @RequirePermission('BRANCH_MASTER', 'VIEW')
  async findAll(
    @Query('compId') compId?: string,
    @Query('branchType') branchType?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.branchService.findAll({
      compId,
      branchType,
      isActive,
      search,
    });
  }

  @Get(':id')
  @RequirePermission('BRANCH_MASTER', 'VIEW')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.branchService.findOne(id);
  }

  @Post()
  @RequirePermission('BRANCH_MASTER', 'ADD')
  async create(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request & { correlationId?: string; __auditLogged?: boolean },
  ) {
    const dto = CreateBranchSchema.parse(body);
    req.__auditLogged = true;
    return this.branchService.create(dto, user, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    });
  }

  @Put(':id')
  @RequirePermission('BRANCH_MASTER', 'EDIT')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request & { correlationId?: string; __auditLogged?: boolean },
  ) {
    const dto = UpdateBranchSchema.parse(body);
    req.__auditLogged = true;
    return this.branchService.update(id, dto, user, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    });
  }

  @Delete(':id')
  @RequirePermission('BRANCH_MASTER', 'DELETE')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request & { correlationId?: string; __auditLogged?: boolean },
  ) {
    req.__auditLogged = true;
    return this.branchService.remove(id, user, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    });
  }

  @Post('action/:actionType')
  @HttpCode(HttpStatus.OK)
  async recordAction(
    @Param('actionType') actionType: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request & { correlationId?: string; __auditLogged?: boolean },
  ) {
    req.__auditLogged = true;
    const normalized =
      actionType.toUpperCase() === 'PRINT' ? 'PRINT' : 'EXPORT';
    return this.branchService.logActionItem(normalized, user, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    });
  }
}
