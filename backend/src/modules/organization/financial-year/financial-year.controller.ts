import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { FinancialYearService } from './financial-year.service';
import {
  CreateFinancialYearSchema,
  UpdateFinancialYearSchema,
  UpsertBranchFyearSchema,
} from './financial-year.dto';
import {
  CurrentUser,
  RequirePermission,
} from '../../../common/decorators/auth.decorators';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';

@Controller('org/financial-years')
export class FinancialYearController {
  constructor(private readonly financialYearService: FinancialYearService) {}

  @Get()
  @RequirePermission('FYEAR_MASTER', 'VIEW')
  async findAll(
    @Query('compId') compId?: string,
    @Query('isClosed') isClosed?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.financialYearService.findAll({
      compId,
      isClosed,
      isActive,
      search,
    });
  }

  @Get(':id')
  @RequirePermission('FYEAR_MASTER', 'VIEW')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.financialYearService.findOne(id);
  }

  @Post()
  @RequirePermission('FYEAR_MASTER', 'ADD')
  async create(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request & { correlationId?: string; __auditLogged?: boolean },
  ) {
    const dto = CreateFinancialYearSchema.parse(body);
    req.__auditLogged = true;
    return this.financialYearService.create(dto, user, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    });
  }

  @Put(':id')
  @RequirePermission('FYEAR_MASTER', 'EDIT')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request & { correlationId?: string; __auditLogged?: boolean },
  ) {
    const dto = UpdateFinancialYearSchema.parse(body);
    req.__auditLogged = true;
    return this.financialYearService.update(id, dto, user, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    });
  }

  @Patch('branch-lock')
  @RequirePermission('FYEAR_MASTER', 'EDIT')
  async upsertBranchLock(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request & { correlationId?: string; __auditLogged?: boolean },
  ) {
    const dto = UpsertBranchFyearSchema.parse(body);
    req.__auditLogged = true;
    return this.financialYearService.upsertBranchLock(dto, user, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    });
  }

  @Delete(':id')
  @RequirePermission('FYEAR_MASTER', 'DELETE')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request & { correlationId?: string; __auditLogged?: boolean },
  ) {
    req.__auditLogged = true;
    return this.financialYearService.remove(id, user, {
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
    return this.financialYearService.logActionItem(normalized, user, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    });
  }
}
