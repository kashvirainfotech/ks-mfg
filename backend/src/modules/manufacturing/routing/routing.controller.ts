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
import { RoutingService } from './routing.service';
import {
  ApproveRoutingDto,
  CloneRoutingDto,
  CreateRoutingDto,
  RoutingFilterParams,
  UpdateRoutingDto,
} from './routing.dto';
import {
  CurrentUser,
  RequirePermission,
  type AuthenticatedUserContext,
} from '../../../common/decorators/auth.decorators';

@Controller('manufacturing/routings')
export class RoutingController {
  constructor(private readonly routingService: RoutingService) {}

  @Get('summary')
  @RequirePermission('MFG_ROUTING', 'VIEW')
  async getSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.routingService.getRoutingSummary(user);
  }

  @Get('lookups')
  @RequirePermission('MFG_ROUTING', 'VIEW')
  async getLookups(@CurrentUser() user: AuthenticatedUserContext) {
    return this.routingService.getLookups(user);
  }

  @Get()
  @RequirePermission('MFG_ROUTING', 'VIEW')
  async findAll(
    @Query() params: RoutingFilterParams,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.routingService.findAll(params, user);
  }

  @Get(':id')
  @RequirePermission('MFG_ROUTING', 'VIEW')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.routingService.findOne(id, user);
  }

  @Post()
  @RequirePermission('MFG_ROUTING', 'ADD')
  async create(
    @Body() dto: CreateRoutingDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.routingService.create(dto, user);
  }

  @Put(':id')
  @RequirePermission('MFG_ROUTING', 'EDIT')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoutingDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.routingService.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('MFG_ROUTING', 'DELETE')
  async delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.routingService.delete(id, user);
  }

  @Post(':id/approve')
  @RequirePermission('MFG_ROUTING', 'APPROVE')
  async approveRouting(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveRoutingDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.routingService.approveRouting(id, dto, user);
  }

  @Post(':id/clone')
  @RequirePermission('MFG_ROUTING', 'CLONE')
  async cloneRouting(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloneRoutingDto,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.routingService.cloneRouting(id, dto, user);
  }
}
