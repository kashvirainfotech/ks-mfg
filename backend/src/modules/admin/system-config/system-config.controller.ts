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
import { SystemConfigService } from './system-config.service';
import type {
  CreateDocNumberSeriesDto,
  CreateSystemConfigDto,
  UpdateDocNumberSeriesDto,
  UpdateSystemConfigDto,
} from './system-config.dto';

@Controller('admin/configurations')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

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

  // ==========================================================================
  // TAB 1: SYSTEM CONFIGURATION MATRIX (tbl_sys_config)
  // ==========================================================================

  @Get('configs')
  @RequirePermission('CONFIG_MASTER', 'VIEW')
  async findAllConfigs(
    @Query('configGroup') configGroup?: string,
    @Query('scopeLevel') scopeLevel?: string,
    @Query('targetCompId') targetCompId?: string,
    @Query('targetBranchId') targetBranchId?: string,
  ) {
    return this.systemConfigService.findAllConfigs({
      configGroup,
      scopeLevel,
      targetCompId: targetCompId ? Number(targetCompId) : undefined,
      targetBranchId: targetBranchId ? Number(targetBranchId) : undefined,
    });
  }

  @Get('configs/:id')
  @RequirePermission('CONFIG_MASTER', 'VIEW')
  async findConfigById(@Param('id', ParseIntPipe) id: number) {
    return this.systemConfigService.findConfigById(id);
  }

  @Post('configs')
  @RequirePermission('CONFIG_MASTER', 'ADD')
  async createConfig(
    @Body() dto: CreateSystemConfigDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.systemConfigService.createConfig(
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Put('configs/:id')
  @RequirePermission('CONFIG_MASTER', 'EDIT')
  async updateConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSystemConfigDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.systemConfigService.updateConfig(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Put('configs/:id/reset-default')
  @RequirePermission('CONFIG_MASTER', 'EDIT')
  async resetConfigToDefault(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.systemConfigService.resetConfigToDefault(
      id,
      user,
      this.extractMeta(req),
    );
  }

  @Delete('configs/:id')
  @RequirePermission('CONFIG_MASTER', 'DELETE')
  async deleteConfig(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.systemConfigService.deleteConfig(
      id,
      user,
      this.extractMeta(req),
    );
  }

  // ==========================================================================
  // TAB 2: DOCUMENT NUMBERING SERIES ENGINE (tbl_sys_doc_number_series)
  // ==========================================================================

  @Get('doc-series')
  @RequirePermission('CONFIG_MASTER', 'VIEW')
  async findAllDocSeries(
    @Query('moduleName') moduleName?: string,
    @Query('docTypeCode') docTypeCode?: string,
    @Query('targetCompId') targetCompId?: string,
    @Query('targetBranchId') targetBranchId?: string,
    @Query('targetFyearId') targetFyearId?: string,
  ) {
    return this.systemConfigService.findAllDocSeries({
      moduleName,
      docTypeCode,
      targetCompId: targetCompId ? Number(targetCompId) : undefined,
      targetBranchId: targetBranchId ? Number(targetBranchId) : undefined,
      targetFyearId: targetFyearId ? Number(targetFyearId) : undefined,
    });
  }

  @Get('doc-series/:id')
  @RequirePermission('CONFIG_MASTER', 'VIEW')
  async findDocSeriesById(@Param('id', ParseIntPipe) id: number) {
    return this.systemConfigService.findDocSeriesById(id);
  }

  @Get('doc-series/:id/preview')
  @RequirePermission('CONFIG_MASTER', 'VIEW')
  async previewDocSeriesSequence(@Param('id', ParseIntPipe) id: number) {
    return this.systemConfigService.previewDocSeriesSequence(id);
  }

  @Post('doc-series')
  @RequirePermission('CONFIG_MASTER', 'ADD')
  async createDocSeries(
    @Body() dto: CreateDocNumberSeriesDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.systemConfigService.createDocSeries(
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Put('doc-series/:id')
  @RequirePermission('CONFIG_MASTER', 'EDIT')
  async updateDocSeries(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDocNumberSeriesDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.systemConfigService.updateDocSeries(
      id,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Delete('doc-series/:id')
  @RequirePermission('CONFIG_MASTER', 'DELETE')
  async deleteDocSeries(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.systemConfigService.deleteDocSeries(
      id,
      user,
      this.extractMeta(req),
    );
  }

  @Post('action/:actionType')
  @RequirePermission('CONFIG_MASTER', 'VIEW')
  async recordScreenAction(
    @Param('actionType') actionType: 'PRINT' | 'EXPORT',
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.systemConfigService.recordScreenAction(
      actionType,
      user,
      this.extractMeta(req),
    );
  }
}
