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
import {
  CurrentUser,
  RequirePermission,
} from '../../../common/decorators/auth.decorators';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import { SalesReturnService } from './return.service';
import type {
  CreateSalesReturnDto,
  UpdateSalesReturnDto,
  InspectSalesReturnDto,
  PostCreditNoteDto,
  RestockSalesReturnDto,
  GenerateCreditNoteIrnDto,
  SalesReturnFilterParams,
} from './return.dto';

@Controller('sales/returns')
export class SalesReturnController {
  constructor(private readonly returnService: SalesReturnService) {}

  @Get('summary')
  @RequirePermission('SALES_RETURN', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.returnService.getSummary(user);
  }

  @Get('lookups')
  @RequirePermission('SALES_RETURN', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    return this.returnService.getLookups(user);
  }

  @Get()
  @RequirePermission('SALES_RETURN', 'VIEW')
  async getReturns(
    @Query() filters: SalesReturnFilterParams,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.returnService.getReturns(user, filters);
  }

  @Get(':id')
  @RequirePermission('SALES_RETURN', 'VIEW')
  async getReturnById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.returnService.getReturnById(user, id);
  }

  @Post()
  @RequirePermission('SALES_RETURN', 'ADD')
  async createReturn(
    @Body() dto: CreateSalesReturnDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.returnService.createReturn(user, dto);
  }

  @Put(':id')
  @RequirePermission('SALES_RETURN', 'EDIT')
  async updateReturn(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSalesReturnDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.returnService.updateReturn(user, id, dto);
  }

  @Post(':id/inspect')
  @RequirePermission('SALES_RETURN', 'INSPECT')
  async inspectReturn(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InspectSalesReturnDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.returnService.inspectReturn(user, id, dto);
  }

  @Post(':id/post-credit-note')
  @RequirePermission('SALES_RETURN', 'POST_CREDIT_NOTE')
  async postCreditNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PostCreditNoteDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.returnService.postCreditNote(user, id, dto);
  }

  @Post(':id/generate-irn')
  @RequirePermission('SALES_RETURN', 'POST_CREDIT_NOTE')
  async generateIrn(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GenerateCreditNoteIrnDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.returnService.generateIrn(user, id, dto);
  }

  @Post(':id/restock')
  @RequirePermission('SALES_RETURN', 'RESTOCK')
  async restockReturn(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RestockSalesReturnDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.returnService.restockReturn(user, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermission('SALES_RETURN', 'EDIT')
  async cancelReturn(
    @Param('id', ParseIntPipe) id: number,
    @Body('cancellationReason') cancellationReason: string,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.returnService.cancelReturn(user, id, cancellationReason || 'Cancelled by user');
  }

  @Delete(':id')
  @RequirePermission('SALES_RETURN', 'DELETE')
  async deleteReturn(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.returnService.deleteReturn(user, id);
  }
}
