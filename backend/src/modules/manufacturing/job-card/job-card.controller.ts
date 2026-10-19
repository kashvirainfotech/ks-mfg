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
import { JobCardService } from './job-card.service';
import type {
  CompleteJobCardDto,
  GenerateJobCardsFromWoDto,
  InProcessQcDto,
  JobCardFilterParams,
  LogTimeAndOutputDto,
  StartJobCardDto,
} from './job-card.dto';
import {
  CurrentUser,
  RequirePermission,
  type AuthenticatedUserContext,
} from '../../../common/decorators/auth.decorators';

@Controller('manufacturing/job-cards')
export class JobCardController {
  constructor(private readonly jobCardService: JobCardService) {}

  @Get('summary')
  @RequirePermission('MFG_JOB_CARD', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.jobCardService.getJobCardSummary(user);
  }

  @Get('lookups')
  @RequirePermission('MFG_JOB_CARD', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    return this.jobCardService.getLookups(user);
  }

  @Get()
  @RequirePermission('MFG_JOB_CARD', 'VIEW')
  async findAll(
    @Query() params: JobCardFilterParams,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.jobCardService.findAll(params, user);
  }

  @Get(':id')
  @RequirePermission('MFG_JOB_CARD', 'VIEW')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.jobCardService.findOne(id, user);
  }

  @Post('generate')
  @RequirePermission('MFG_JOB_CARD', 'ADD')
  async generateFromWo(
    @Body() dto: GenerateJobCardsFromWoDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.jobCardService.generateJobCardsFromWo(dto, user);
  }

  @Post(':id/start')
  @RequirePermission('MFG_JOB_CARD', 'START')
  async startJob(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StartJobCardDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.jobCardService.startJob(id, dto, user);
  }

  @Post(':id/log-time')
  @RequirePermission('MFG_JOB_CARD', 'COMPLETE')
  async logTimeAndOutput(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LogTimeAndOutputDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.jobCardService.logTimeAndOutput(id, dto, user);
  }

  @Post(':id/qc')
  @RequirePermission('MFG_JOB_CARD', 'APPROVE')
  async inProcessQc(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InProcessQcDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.jobCardService.inProcessQc(id, dto, user);
  }

  @Post(':id/complete')
  @RequirePermission('MFG_JOB_CARD', 'COMPLETE')
  async completeJob(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CompleteJobCardDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.jobCardService.completeJob(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('MFG_JOB_CARD', 'DELETE')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.jobCardService.delete(id, user);
  }
}
