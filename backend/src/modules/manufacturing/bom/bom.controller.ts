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
import { BomService } from './bom.service';
import type {
  ApproveBomDto,
  BomFilterParams,
  BomStatus,
  BomType,
  CloneBomDto,
  CreateBomDto,
  UpdateBomDto,
} from './bom.dto';

@Controller('manufacturing/boms')
export class BomController {
  constructor(private readonly bomService: BomService) {}

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

  // 1. KPI Summary
  @Get('summary')
  @RequirePermission('MFG_BOM', 'VIEW')
  async getBomSummary(@CurrentUser() user: AuthenticatedUserContext) {
    return this.bomService.getBomSummary(user);
  }

  // 2. Manufactured assemblies lookup
  @Get('manufactured-items')
  @RequirePermission('MFG_BOM', 'VIEW')
  async getManufacturedItems(@CurrentUser() user: AuthenticatedUserContext) {
    return this.bomService.getManufacturedItems(user);
  }

  // 3. Raw materials & components lookup
  @Get('component-items')
  @RequirePermission('MFG_BOM', 'VIEW')
  async getComponentItems(@CurrentUser() user: AuthenticatedUserContext) {
    return this.bomService.getComponentItems(user);
  }

  // 4. Active sub-assembly BOMs lookup
  @Get('child-boms')
  @RequirePermission('MFG_BOM', 'VIEW')
  async getChildBoms(@CurrentUser() user: AuthenticatedUserContext) {
    return this.bomService.getChildBoms(user);
  }

  // 5. UOMs lookup
  @Get('uoms')
  @RequirePermission('MFG_BOM', 'VIEW')
  async getUoms(@CurrentUser() user: AuthenticatedUserContext) {
    return this.bomService.getUoms(user);
  }

  // 6. Multi-level Indented BOM Tree Explosion
  @Get(':id/tree')
  @RequirePermission('MFG_BOM', 'EXPLODE')
  async explodeBomTree(
    @Param('id', ParseIntPipe) bomId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.bomService.explodeBomTree(bomId, user);
  }

  // 7. Get Single BOM Detail (with items and byproducts)
  @Get(':id')
  @RequirePermission('MFG_BOM', 'VIEW')
  async findOneBom(
    @Param('id', ParseIntPipe) bomId: number,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.bomService.findOneBom(bomId, user);
  }

  // 8. Find All BOMs with Filtering
  @Get()
  @RequirePermission('MFG_BOM', 'VIEW')
  async findAllBoms(
    @Query('status') status?: string,
    @Query('bomType') bomType?: string,
    @Query('itemId') itemId?: string,
    @Query('isDefault') isDefault?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: AuthenticatedUserContext,
  ) {
    const filters: BomFilterParams = {
      status: status as BomStatus | undefined,
      bomType: bomType as BomType | undefined,
      itemId: itemId ? Number(itemId) : undefined,
      isDefault: isDefault !== undefined ? isDefault === 'true' : undefined,
      search,
    };
    return this.bomService.findAllBoms(filters, user!);
  }

  // 9. Create BOM
  @Post()
  @RequirePermission('MFG_BOM', 'ADD')
  async createBom(
    @Body() dto: CreateBomDto,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.bomService.createBom(dto, user, this.extractMeta(req));
  }

  // 10. Update BOM
  @Put(':id')
  @RequirePermission('MFG_BOM', 'EDIT')
  async updateBom(
    @Param('id', ParseIntPipe) bomId: number,
    @Body() dto: UpdateBomDto,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.bomService.updateBom(bomId, dto, user, this.extractMeta(req));
  }

  // 11. Approve & Release BOM to Production
  @Post(':id/approve')
  @RequirePermission('MFG_BOM', 'APPROVE')
  async approveBom(
    @Param('id', ParseIntPipe) bomId: number,
    @Body() dto: ApproveBomDto,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.bomService.approveBom(bomId, dto, user, this.extractMeta(req));
  }

  // 12. Clone / Copy BOM to New Version
  @Post(':id/clone')
  @RequirePermission('MFG_BOM', 'CLONE')
  async cloneBom(
    @Param('id', ParseIntPipe) bomId: number,
    @Body() dto: CloneBomDto,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.bomService.cloneBom(bomId, dto, user, this.extractMeta(req));
  }

  // 13. Delete BOM (Draft or Unreferenced only)
  @Delete(':id')
  @RequirePermission('MFG_BOM', 'DELETE')
  async deleteBom(
    @Param('id', ParseIntPipe) bomId: number,
    @Req() req: Request,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.bomService.deleteBom(bomId, user, this.extractMeta(req));
  }
}
