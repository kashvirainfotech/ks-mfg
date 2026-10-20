import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  CurrentUser,
  RequirePermission,
  type AuthenticatedUserContext,
} from '../../../common/decorators/auth.decorators';
import { StockAgingService } from './aging.service';
import type {
  AgingFilterDto,
  CreateProvisionProposalDto,
  TriggerPurchaseRequisitionDto,
} from './aging.dto';

@Controller('inventory/aging')
export class StockAgingController {
  constructor(private readonly agingService: StockAgingService) {}

  @Get('summary')
  @RequirePermission('STOCK_AGING', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    const data = await this.agingService.getSummary(user);
    return {
      success: true,
      message: 'Inventory aging & valuation summary retrieved successfully',
      data,
    };
  }

  @Get('lookups')
  @RequirePermission('STOCK_AGING', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    const data = await this.agingService.getLookups(user);
    return {
      success: true,
      message: 'Aging lookups retrieved successfully',
      data,
    };
  }

  @Get('analysis')
  @RequirePermission('STOCK_AGING', 'VIEW')
  async getAgingAnalysis(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query() filters: AgingFilterDto,
  ) {
    const data = await this.agingService.getAgingAnalysis(user, filters);
    return {
      success: true,
      message: 'Inventory aging & FSN analysis retrieved successfully',
      data,
    };
  }

  @Get('reorder-alerts')
  @RequirePermission('STOCK_AGING', 'VIEW')
  async getReorderAlerts(
    @CurrentUser() user: AuthenticatedUserContext,
    @Query() filters: AgingFilterDto,
  ) {
    const data = await this.agingService.getReorderAlerts(user, filters);
    return {
      success: true,
      message: 'Reorder Point & Safety Stock alerts retrieved successfully',
      data,
    };
  }

  @Post('trigger-pr')
  @RequirePermission('STOCK_AGING', 'REORDER')
  async triggerPurchaseRequisition(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() dto: TriggerPurchaseRequisitionDto,
  ) {
    const data = await this.agingService.triggerPurchaseRequisition(user, dto);
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Get('provisions')
  @RequirePermission('STOCK_AGING', 'VIEW')
  async getProvisionProposals(@CurrentUser() user: AuthenticatedUserContext) {
    const data = await this.agingService.getProvisionProposals(user);
    return {
      success: true,
      message: 'Stock valuation provision reviews retrieved successfully',
      data,
    };
  }

  @Get('provisions/:id')
  @RequirePermission('STOCK_AGING', 'VIEW')
  async getProvisionDetail(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.agingService.getProvisionDetail(user, id);
    return {
      success: true,
      message: 'Provision review detail retrieved successfully',
      data,
    };
  }

  @Post('provisions')
  @RequirePermission('STOCK_AGING', 'PROVISION')
  async createProvisionProposal(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() dto: CreateProvisionProposalDto,
  ) {
    const data = await this.agingService.createProvisionProposal(user, dto);
    return {
      success: true,
      message: `Stock valuation review ${data.provisionNo} created successfully`,
      data,
    };
  }

  @Post('provisions/:id/approve')
  @RequirePermission('STOCK_AGING', 'PROVISION')
  async approveProvisionProposal(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.agingService.approveProvisionProposal(user, id);
    return {
      success: true,
      message: `Stock valuation proposal #${id} approved successfully`,
      data,
    };
  }
}
