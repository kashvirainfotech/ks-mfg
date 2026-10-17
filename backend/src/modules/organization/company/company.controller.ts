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
import { CompanyService } from './company.service';
import { CreateCompanySchema, UpdateCompanySchema } from './company.dto';
import {
  CurrentUser,
  RequirePermission,
} from '../../../common/decorators/auth.decorators';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';

@Controller('org/companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  @RequirePermission('COMPANY_MASTER', 'VIEW')
  async findAll(
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.companyService.findAll(search, isActive);
  }

  @Get(':id')
  @RequirePermission('COMPANY_MASTER', 'VIEW')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.companyService.findOne(id);
  }

  @Post()
  @RequirePermission('COMPANY_MASTER', 'ADD')
  async create(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request & { correlationId?: string; __auditLogged?: boolean },
  ) {
    const dto = CreateCompanySchema.parse(body);
    req.__auditLogged = true;
    return this.companyService.create(dto, user, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    });
  }

  @Put(':id')
  @RequirePermission('COMPANY_MASTER', 'EDIT')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request & { correlationId?: string; __auditLogged?: boolean },
  ) {
    const dto = UpdateCompanySchema.parse(body);
    req.__auditLogged = true;
    return this.companyService.update(id, dto, user, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    });
  }

  @Delete(':id')
  @RequirePermission('COMPANY_MASTER', 'DELETE')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request & { correlationId?: string; __auditLogged?: boolean },
  ) {
    req.__auditLogged = true;
    return this.companyService.remove(id, user, {
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
    const normalized = actionType.toUpperCase() === 'PRINT' ? 'PRINT' : 'EXPORT';
    return this.companyService.logActionItem(normalized, user, {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
      correlationId: req.correlationId,
    });
  }
}
