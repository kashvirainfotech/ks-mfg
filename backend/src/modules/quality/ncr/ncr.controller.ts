import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CurrentUser,
  RequirePermission,
} from '../../../common/decorators/auth.decorators';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import { NcrService } from './ncr.service';
import type {
  AuthorizeDispositionDto,
  CastMrbVoteDto,
  CloseCapaActionDto,
  CreateCapaActionDto,
  CreateNcrDto,
  UpdateNcrDto,
} from './ncr.dto';

@Controller('quality/ncr')
export class NcrController {
  constructor(private readonly ncrService: NcrService) {}

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

  @Get('summary')
  @RequirePermission('NCR_QC', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.ncrService.getSummary(user);
  }

  @Get('lookups')
  @RequirePermission('NCR_QC', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    return this.ncrService.getLookups(user);
  }

  @Get(':id')
  @RequirePermission('NCR_QC', 'VIEW')
  async findById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.ncrService.findById(id, user);
  }

  @Get()
  @RequirePermission('NCR_QC', 'VIEW')
  async findAll(
    @Query('status') status?: string,
    @Query('ncrType') ncrType?: string,
    @Query('defectSeverity') defectSeverity?: string,
    @Query('defectCategory') defectCategory?: string,
    @Query('mrbDisposition') mrbDisposition?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    return this.ncrService.findAll(
      {
        status,
        ncrType,
        defectSeverity,
        defectCategory,
        mrbDisposition,
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      },
      user!,
    );
  }

  @Post()
  @RequirePermission('NCR_QC', 'ADD')
  async create(
    @Body() dto: CreateNcrDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.ncrService.create(dto, user, this.extractMeta(req));
  }

  @Put(':id')
  @RequirePermission('NCR_QC', 'EDIT')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNcrDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.ncrService.update(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/mrb-vote')
  @RequirePermission('NCR_QC', 'EDIT')
  async castMrbVote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CastMrbVoteDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.ncrService.castMrbVote(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/disposition')
  @RequirePermission('NCR_QC', 'DISPOSITION')
  async authorizeDisposition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AuthorizeDispositionDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.ncrService.authorizeDisposition(id, dto, user, this.extractMeta(req));
  }

  @Post(':id/capa')
  @RequirePermission('NCR_QC', 'EDIT')
  async createOrUpdateCapa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCapaActionDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.ncrService.createOrUpdateCapa(id, dto, user, this.extractMeta(req));
  }

  @Put('capa/:id/close')
  @RequirePermission('NCR_QC', 'CLOSE_CAPA')
  async closeCapa(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseCapaActionDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.ncrService.closeCapa(id, dto, user, this.extractMeta(req));
  }

  @Delete(':id')
  @RequirePermission('NCR_QC', 'DELETE')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.ncrService.delete(id, user, this.extractMeta(req));
  }
}
