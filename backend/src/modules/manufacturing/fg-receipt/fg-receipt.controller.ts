import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { RequirePermission, CurrentUser } from '../../../common/decorators/auth.decorators';
import { FgReceiptService } from './fg-receipt.service';
import {
  CreateFgReceiptDto,
  UpdateFgReceiptDto,
  QcInspectionFgReceiptDto,
  PostFgReceiptDto,
} from './fg-receipt.dto';

@Controller('manufacturing/fg-receipts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FgReceiptController {
  constructor(private readonly fgReceiptService: FgReceiptService) {}

  @Get('summary')
  @RequirePermission('MFG_FG_RECEIPT', 'VIEW')
  async getSummary(@CurrentUser() user: any) {
    return this.fgReceiptService.getSummary(user);
  }

  @Get('lookups')
  @RequirePermission('MFG_FG_RECEIPT', 'VIEW')
  async getLookups(@CurrentUser() user: any) {
    return this.fgReceiptService.getLookups(user);
  }

  @Get('wo-byproducts/:woId')
  @RequirePermission('MFG_FG_RECEIPT', 'VIEW')
  async getWoBomByproducts(
    @Param('woId', ParseIntPipe) woId: number,
    @Query('receivedQty') receivedQty: string,
    @CurrentUser() user: any,
  ) {
    return this.fgReceiptService.getWoBomByproducts(woId, Number(receivedQty) || 1, user);
  }

  @Get('wo-cost-estimate/:woId')
  @RequirePermission('MFG_FG_RECEIPT', 'VIEW')
  async getWoAbsorptionCostEstimate(
    @Param('woId', ParseIntPipe) woId: number,
    @Query('receivedQty') receivedQty: string,
    @CurrentUser() user: any,
  ) {
    return this.fgReceiptService.getWoAbsorptionCostEstimate(woId, Number(receivedQty) || 1, user);
  }

  @Get()
  @RequirePermission('MFG_FG_RECEIPT', 'VIEW')
  async findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.fgReceiptService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermission('MFG_FG_RECEIPT', 'VIEW')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.fgReceiptService.findOne(id, user);
  }

  @Post()
  @RequirePermission('MFG_FG_RECEIPT', 'ADD')
  async create(
    @Body() dto: CreateFgReceiptDto,
    @CurrentUser() user: any,
  ) {
    return this.fgReceiptService.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('MFG_FG_RECEIPT', 'EDIT')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFgReceiptDto,
    @CurrentUser() user: any,
  ) {
    return this.fgReceiptService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('MFG_FG_RECEIPT', 'DELETE')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.fgReceiptService.remove(id, user);
  }

  @Post(':id/qc-inspection')
  @RequirePermission('MFG_FG_RECEIPT', 'APPROVE')
  async qcInspection(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: QcInspectionFgReceiptDto,
    @CurrentUser() user: any,
  ) {
    return this.fgReceiptService.qcInspection(id, dto, user);
  }

  @Post(':id/post')
  @RequirePermission('MFG_FG_RECEIPT', 'POST')
  async post(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PostFgReceiptDto,
    @CurrentUser() user: any,
  ) {
    return this.fgReceiptService.post(id, dto, user);
  }
}
