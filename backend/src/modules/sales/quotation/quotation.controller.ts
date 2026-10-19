import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { QuotationService } from './quotation.service';
import {
  CreateQuotationDto,
  UpdateQuotationDto,
  ReviseQuotationDto,
  UpdateQuotationStatusDto,
  ConvertQuotationToSoDto,
} from './quotation.dto';

@Controller('sales/quotations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuotationController {
  constructor(private readonly quotationService: QuotationService) {}

  @Get('summary')
  @RequirePermission('SALES_QUOTATION', 'VIEW')
  async getSummary(@CurrentUser() user: any) {
    return this.quotationService.getSummary(user);
  }

  @Get('lookups')
  @RequirePermission('SALES_QUOTATION', 'VIEW')
  async getLookups(@CurrentUser() user: any) {
    return this.quotationService.getLookups(user);
  }

  @Get()
  @RequirePermission('SALES_QUOTATION', 'VIEW')
  async findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.quotationService.findAll(query, user);
  }

  @Get(':id')
  @RequirePermission('SALES_QUOTATION', 'VIEW')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.quotationService.findOne(id, user);
  }

  @Post()
  @RequirePermission('SALES_QUOTATION', 'ADD')
  async create(
    @Body() dto: CreateQuotationDto,
    @CurrentUser() user: any,
  ) {
    return this.quotationService.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('SALES_QUOTATION', 'EDIT')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQuotationDto,
    @CurrentUser() user: any,
  ) {
    return this.quotationService.update(id, dto, user);
  }

  @Post(':id/revise')
  @RequirePermission('SALES_QUOTATION', 'EDIT')
  async revise(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviseQuotationDto,
    @CurrentUser() user: any,
  ) {
    return this.quotationService.revise(id, dto, user);
  }

  @Patch(':id/status')
  @RequirePermission('SALES_QUOTATION', 'EDIT')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQuotationStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.quotationService.updateStatus(id, dto, user);
  }

  @Post(':id/send')
  @RequirePermission('SALES_QUOTATION', 'SEND')
  async send(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { remarks?: string },
    @CurrentUser() user: any,
  ) {
    return this.quotationService.updateStatus(
      id,
      { status: 'SENT', remarks: body?.remarks },
      user,
    );
  }

  @Post(':id/convert-to-so')
  @RequirePermission('SALES_QUOTATION', 'CONVERT_TO_SO')
  async convertToSalesOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConvertQuotationToSoDto,
    @CurrentUser() user: any,
  ) {
    return this.quotationService.convertToSalesOrder(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('SALES_QUOTATION', 'DELETE')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.quotationService.remove(id, user);
  }
}
