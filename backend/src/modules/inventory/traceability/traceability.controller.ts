import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import {
  CurrentUser,
  RequirePermission,
  type AuthenticatedUserContext,
} from '../../../common/decorators/auth.decorators';
import { StockTraceabilityService } from './traceability.service';
import type {
  CreateBatchMasterDto,
  CreateSerialMasterDto,
  CreateGenealogyLinkDto,
  TraceabilityFilterDto,
} from './traceability.dto';

@Controller('inventory/traceability')
export class StockTraceabilityController {
  constructor(private readonly traceabilityService: StockTraceabilityService) {}

  @Get('summary')
  @RequirePermission('STOCK_TRACEABILITY', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    const data = await this.traceabilityService.getSummary(user);
    return {
      success: true,
      message: 'Traceability summary retrieved successfully',
      data,
    };
  }

  @Get('lookups')
  @RequirePermission('STOCK_TRACEABILITY', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    const data = await this.traceabilityService.getLookups(user);
    return {
      success: true,
      message: 'Traceability lookups retrieved successfully',
      data,
    };
  }

  @Get('batches')
  @RequirePermission('STOCK_TRACEABILITY', 'VIEW')
  async getBatches(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query() filters: TraceabilityFilterDto,
  ) {
    const data = await this.traceabilityService.getBatches(user, filters);
    return {
      success: true,
      message: 'Batches retrieved successfully',
      data,
    };
  }

  @Get('serials')
  @RequirePermission('STOCK_TRACEABILITY', 'VIEW')
  async getSerials(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query() filters: TraceabilityFilterDto,
  ) {
    const data = await this.traceabilityService.getSerials(user, filters);
    return {
      success: true,
      message: 'Serials retrieved successfully',
      data,
    };
  }

  @Get('genealogy')
  @RequirePermission('STOCK_TRACEABILITY', 'VIEW')
  async getGenealogyList(@CurrentUser() user: AuthenticatedUserContext) {
    const data = await this.traceabilityService.getGenealogyList(user);
    return {
      success: true,
      message: 'Genealogy linkages retrieved successfully',
      data,
    };
  }

  @Get('explore')
  @RequirePermission('STOCK_TRACEABILITY', 'DRILLDOWN')
  async explore360(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query('query') query: string,
  ) {
    const data = await this.traceabilityService.explore360(user, query);
    return {
      success: true,
      message: '360° traceability analysis generated successfully',
      data,
    };
  }

  @Post('batches')
  @RequirePermission('STOCK_TRACEABILITY', 'REGISTER_BATCH')
  async createBatch(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() dto: CreateBatchMasterDto,
  ) {
    const data = await this.traceabilityService.createBatch(user, dto);
    return {
      success: true,
      message: 'Batch Quality Passport registered successfully',
      data,
    };
  }

  @Post('serials')
  @RequirePermission('STOCK_TRACEABILITY', 'REGISTER_SERIAL')
  async createSerial(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() dto: CreateSerialMasterDto,
  ) {
    const data = await this.traceabilityService.createSerial(user, dto);
    return {
      success: true,
      message: 'Serial unit registered successfully',
      data,
    };
  }

  @Post('genealogy')
  @RequirePermission('STOCK_TRACEABILITY', 'REGISTER_BATCH')
  async createGenealogyLink(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() dto: CreateGenealogyLinkDto,
  ) {
    const data = await this.traceabilityService.createGenealogyLink(user, dto);
    return {
      success: true,
      message: 'Parent-child transformation link registered successfully',
      data,
    };
  }
}
