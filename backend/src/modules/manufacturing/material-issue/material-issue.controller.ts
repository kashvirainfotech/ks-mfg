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
} from '@nestjs/common';
import { MaterialIssueService } from './material-issue.service';
import type {
  CreateMaterialIssueDto,
  MaterialIssueFilterParams,
  ReturnToStoreDto,
  SubmitMaterialIssueDto,
  UpdateMaterialIssueDto,
} from './material-issue.dto';
import {
  CurrentUser,
  RequirePermission,
  type AuthenticatedUserContext,
} from '../../../common/decorators/auth.decorators';

@Controller('manufacturing/material-issues')
export class MaterialIssueController {
  constructor(private readonly materialIssueService: MaterialIssueService) {}

  @Get('summary')
  @RequirePermission('MFG_MATERIAL_ISSUE', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.materialIssueService.getMaterialIssueSummary(user);
  }

  @Get('lookups')
  @RequirePermission('MFG_MATERIAL_ISSUE', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    return this.materialIssueService.getLookups(user);
  }

  @Get('wo-bom-items/:woId')
  @RequirePermission('MFG_MATERIAL_ISSUE', 'VIEW')
  async getWoBomItems(
    @Param('woId', ParseIntPipe) woId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.materialIssueService.getWoBomItems(woId, user);
  }

  @Get()
  @RequirePermission('MFG_MATERIAL_ISSUE', 'VIEW')
  async findAll(
    @Query() params: MaterialIssueFilterParams,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.materialIssueService.findAll(params, user);
  }

  @Get(':id')
  @RequirePermission('MFG_MATERIAL_ISSUE', 'VIEW')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.materialIssueService.findOne(id, user);
  }

  @Post()
  @RequirePermission('MFG_MATERIAL_ISSUE', 'ADD')
  async create(
    @Body() dto: CreateMaterialIssueDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.materialIssueService.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('MFG_MATERIAL_ISSUE', 'EDIT')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMaterialIssueDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.materialIssueService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('MFG_MATERIAL_ISSUE', 'DELETE')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.materialIssueService.delete(id, user);
  }

  @Post(':id/submit')
  @RequirePermission('MFG_MATERIAL_ISSUE', 'SUBMIT')
  async submitAndPost(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitMaterialIssueDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.materialIssueService.submitAndPost(id, dto, user);
  }

  @Post('return-to-store')
  @RequirePermission('MFG_MATERIAL_ISSUE', 'RETURN')
  async returnToStore(
    @Body() dto: ReturnToStoreDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.materialIssueService.returnToStore(dto, user);
  }
}
