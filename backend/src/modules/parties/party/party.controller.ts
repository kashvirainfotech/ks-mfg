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
import { PartyService } from './party.service';
import type { CreatePartyDto, UpdatePartyDto } from './party.dto';

@Controller('parties')
export class PartyController {
  constructor(private readonly partyService: PartyService) {}

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

  @Get('summary')
  @RequirePermission('PARTY_MASTER', 'VIEW')
  async getPartySummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.partyService.getPartySummary(user);
  }

  @Get()
  @RequirePermission('PARTY_MASTER', 'VIEW')
  async findAllParties(
    @Query('isCustomer') isCustomer?: string,
    @Query('isSupplier') isSupplier?: string,
    @Query('isJobWorker') isJobWorker?: string,
    @Query('isTransporter') isTransporter?: string,
    @Query('partyGroup') partyGroup?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    return this.partyService.findAllParties(
      {
        isCustomer:
          isCustomer === 'true'
            ? true
            : isCustomer === 'false'
            ? false
            : undefined,
        isSupplier:
          isSupplier === 'true'
            ? true
            : isSupplier === 'false'
            ? false
            : undefined,
        isJobWorker:
          isJobWorker === 'true'
            ? true
            : isJobWorker === 'false'
            ? false
            : undefined,
        isTransporter:
          isTransporter === 'true'
            ? true
            : isTransporter === 'false'
            ? false
            : undefined,
        partyGroup,
        isActive:
          isActive === 'true'
            ? true
            : isActive === 'false'
            ? false
            : undefined,
        search,
      },
      user!,
    );
  }

  @Get(':partyId')
  @RequirePermission('PARTY_MASTER', 'VIEW')
  async findPartyById(
    @Param('partyId', ParseIntPipe) partyId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.partyService.findPartyById(partyId, user);
  }

  @Post()
  @RequirePermission('PARTY_MASTER', 'ADD')
  async createParty(
    @Body() dto: CreatePartyDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.partyService.createParty(dto, user, this.extractMeta(req));
  }

  @Put(':partyId')
  @RequirePermission('PARTY_MASTER', 'EDIT')
  async updateParty(
    @Param('partyId', ParseIntPipe) partyId: number,
    @Body() dto: UpdatePartyDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.partyService.updateParty(
      partyId,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Delete(':partyId')
  @RequirePermission('PARTY_MASTER', 'DELETE')
  async deleteParty(
    @Param('partyId', ParseIntPipe) partyId: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.partyService.deleteParty(partyId, user, this.extractMeta(req));
  }

  @Post('actions/log')
  @RequirePermission('PARTY_MASTER', 'VIEW')
  async logScreenAction(
    @Body('actionType') actionType: 'PRINT' | 'EXPORT',
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.partyService.recordScreenAction(
      actionType,
      user,
      this.extractMeta(req),
    );
  }
}
