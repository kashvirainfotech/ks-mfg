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
import { JobWorkService } from './job-work.service';
import {
  CreateJobWorkChallanDto,
  UpdateJobWorkChallanDto,
  DispatchJobWorkChallanDto,
  CreateJobWorkReceiptDto,
  ReconcileJobWorkChallanDto,
} from './job-work.dto';

@Controller('manufacturing/job-work')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class JobWorkController {
  constructor(private readonly jobWorkService: JobWorkService) {}

  @Get('summary')
  @RequirePermission('MFG_JOB_WORK', 'VIEW')
  async getSummary(@CurrentUser() user: any) {
    return this.jobWorkService.getSummary(user);
  }

  @Get('lookups')
  @RequirePermission('MFG_JOB_WORK', 'VIEW')
  async getLookups(@CurrentUser() user: any) {
    return this.jobWorkService.getLookups(user);
  }

  // --- Outward Delivery Challans ---

  @Get('challans')
  @RequirePermission('MFG_JOB_WORK', 'VIEW')
  async getChallans(@Query() query: any, @CurrentUser() user: any) {
    return this.jobWorkService.getChallans(query, user);
  }

  @Get('challans/:id')
  @RequirePermission('MFG_JOB_WORK', 'VIEW')
  async getChallanById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.jobWorkService.getChallanById(id, user);
  }

  @Post('challans')
  @RequirePermission('MFG_JOB_WORK', 'ADD')
  async createChallan(
    @Body() dto: CreateJobWorkChallanDto,
    @CurrentUser() user: any,
  ) {
    return this.jobWorkService.createChallan(dto, user);
  }

  @Put('challans/:id')
  @RequirePermission('MFG_JOB_WORK', 'EDIT')
  async updateChallan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateJobWorkChallanDto,
    @CurrentUser() user: any,
  ) {
    return this.jobWorkService.updateChallan(id, dto, user);
  }

  @Delete('challans/:id')
  @RequirePermission('MFG_JOB_WORK', 'DELETE')
  async deleteChallan(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.jobWorkService.deleteChallan(id, user);
  }

  @Post('challans/:id/dispatch')
  @RequirePermission('MFG_JOB_WORK', 'DISPATCH')
  async dispatchChallan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DispatchJobWorkChallanDto,
    @CurrentUser() user: any,
  ) {
    return this.jobWorkService.dispatchChallan(id, dto, user);
  }

  @Post('challans/:id/reconcile')
  @RequirePermission('MFG_JOB_WORK', 'RECONCILE')
  async reconcileChallan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReconcileJobWorkChallanDto,
    @CurrentUser() user: any,
  ) {
    return this.jobWorkService.reconcileChallan(id, dto, user);
  }

  // --- Inward Receipts ---

  @Get('receipts')
  @RequirePermission('MFG_JOB_WORK', 'VIEW')
  async getReceipts(@Query() query: any, @CurrentUser() user: any) {
    return this.jobWorkService.getReceipts(query, user);
  }

  @Get('receipts/:id')
  @RequirePermission('MFG_JOB_WORK', 'VIEW')
  async getReceiptById(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
  ) {
    return this.jobWorkService.getReceiptById(id, user);
  }

  @Post('receipts')
  @RequirePermission('MFG_JOB_WORK', 'RECEIVE')
  async createReceipt(
    @Body() dto: CreateJobWorkReceiptDto,
    @CurrentUser() user: any,
  ) {
    return this.jobWorkService.createReceipt(dto, user);
  }
}
