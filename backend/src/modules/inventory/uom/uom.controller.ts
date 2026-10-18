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
import { UomService } from './uom.service';
import type {
  CreateItemCategoryDto,
  CreateUomConversionDto,
  CreateUomDto,
  UpdateItemCategoryDto,
  UpdateUomConversionDto,
  UpdateUomDto,
} from './uom.dto';

@Controller('inventory/uoms')
export class UomController {
  constructor(private readonly uomService: UomService) {}

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

  // ==========================================================================
  // TAB 2: UOM CONVERSION MATRIX (tbl_inv_uom_conversion)
  // Static route '/conversions' declared first to prevent collision with '/:id'
  // ==========================================================================

  @Get('conversions')
  @RequirePermission('UOM_MASTER', 'VIEW')
  async findAllConversions(
    @Query('fromUomId') fromUomId?: string,
    @Query('toUomId') toUomId?: string,
    @Query('conversionType') conversionType?: string,
  ) {
    return this.uomService.findAllConversions({
      fromUomId: fromUomId ? Number(fromUomId) : undefined,
      toUomId: toUomId ? Number(toUomId) : undefined,
      conversionType,
    });
  }

  @Get('conversions/:conversionId')
  @RequirePermission('UOM_MASTER', 'VIEW')
  async findConversionById(
    @Param('conversionId', ParseIntPipe) conversionId: number,
  ) {
    return this.uomService.findConversionById(conversionId);
  }

  @Post('conversions')
  @RequirePermission('UOM_MASTER', 'ADD')
  async createConversion(
    @Body() dto: CreateUomConversionDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.uomService.createConversion(dto, user, this.extractMeta(req));
  }

  @Put('conversions/:conversionId')
  @RequirePermission('UOM_MASTER', 'EDIT')
  async updateConversion(
    @Param('conversionId', ParseIntPipe) conversionId: number,
    @Body() dto: UpdateUomConversionDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.uomService.updateConversion(
      conversionId,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Delete('conversions/:conversionId')
  @RequirePermission('UOM_MASTER', 'DELETE')
  async deleteConversion(
    @Param('conversionId', ParseIntPipe) conversionId: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.uomService.deleteConversion(
      conversionId,
      user,
      this.extractMeta(req),
    );
  }

  // ==========================================================================
  // TAB 3: ITEM CATEGORY HIERARCHY TREE (tbl_inv_item_category)
  // Static route '/categories' declared first to prevent collision with '/:id'
  // ==========================================================================

  @Get('categories')
  @RequirePermission('UOM_MASTER', 'VIEW')
  async findAllCategories(
    @Query('categoryType') categoryType?: string,
    @Query('parentCategoryId') parentCategoryId?: string,
    @Query('isLeaf') isLeaf?: string,
  ) {
    return this.uomService.findAllCategories({
      categoryType,
      parentCategoryId: parentCategoryId ? Number(parentCategoryId) : undefined,
      isLeaf: isLeaf !== undefined ? isLeaf === 'true' : undefined,
    });
  }

  @Get('categories/:categoryId')
  @RequirePermission('UOM_MASTER', 'VIEW')
  async findCategoryById(
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ) {
    return this.uomService.findCategoryById(categoryId);
  }

  @Post('categories')
  @RequirePermission('UOM_MASTER', 'ADD')
  async createCategory(
    @Body() dto: CreateItemCategoryDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.uomService.createCategory(dto, user, this.extractMeta(req));
  }

  @Put('categories/:categoryId')
  @RequirePermission('UOM_MASTER', 'EDIT')
  async updateCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Body() dto: UpdateItemCategoryDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.uomService.updateCategory(
      categoryId,
      dto,
      user,
      this.extractMeta(req),
    );
  }

  @Delete('categories/:categoryId')
  @RequirePermission('UOM_MASTER', 'DELETE')
  async deleteCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.uomService.deleteCategory(
      categoryId,
      user,
      this.extractMeta(req),
    );
  }

  // ==========================================================================
  // SCREEN AUDIT ACTION LOGGING (PRINT / EXPORT)
  // ==========================================================================

  @Post('action/:actionType')
  @RequirePermission('UOM_MASTER', 'VIEW')
  async recordScreenAction(
    @Param('actionType') actionType: 'PRINT' | 'EXPORT',
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.uomService.recordScreenAction(
      actionType,
      user,
      this.extractMeta(req),
    );
  }

  // ==========================================================================
  // TAB 1: UNITS OF MEASUREMENT (tbl_inv_uom)
  // ==========================================================================

  @Get()
  @RequirePermission('UOM_MASTER', 'VIEW')
  async findAllUoms(
    @Query('uomType') uomType?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.uomService.findAllUoms({
      uomType,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @RequirePermission('UOM_MASTER', 'VIEW')
  async findUomById(@Param('id', ParseIntPipe) id: number) {
    return this.uomService.findUomById(id);
  }

  @Post()
  @RequirePermission('UOM_MASTER', 'ADD')
  async createUom(
    @Body() dto: CreateUomDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.uomService.createUom(dto, user, this.extractMeta(req));
  }

  @Put(':id')
  @RequirePermission('UOM_MASTER', 'EDIT')
  async updateUom(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUomDto,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.uomService.updateUom(id, dto, user, this.extractMeta(req));
  }

  @Delete(':id')
  @RequirePermission('UOM_MASTER', 'DELETE')
  async deleteUom(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    return this.uomService.deleteUom(id, user, this.extractMeta(req));
  }
}
