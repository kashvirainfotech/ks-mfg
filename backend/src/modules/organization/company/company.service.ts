import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq, ilike, or, and, ne } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../../database/database.module';
import type { DrizzleDb } from '../../../database/database.module';
import { tblOrgCompany } from '../../../database/schema';
import { DependencyCheckService } from '../../../common/services/dependency-check.service';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import { CreateCompanyDto, UpdateCompanyDto } from './company.dto';

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

@Injectable()
export class CompanyService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly dependencyCheckService: DependencyCheckService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(search?: string, isActive?: string) {
    const conditions = [];

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(tblOrgCompany.compCode, term),
          ilike(tblOrgCompany.compName, term),
          ilike(tblOrgCompany.legalName, term),
          ilike(tblOrgCompany.gstin, term),
          ilike(tblOrgCompany.city, term),
          ilike(tblOrgCompany.stateName, term),
        ),
      );
    }

    if (isActive === 'true') {
      conditions.push(eq(tblOrgCompany.isActive, true));
    } else if (isActive === 'false') {
      conditions.push(eq(tblOrgCompany.isActive, false));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    return this.db
      .select()
      .from(tblOrgCompany)
      .where(whereClause)
      .orderBy(asc(tblOrgCompany.compId));
  }

  async findOne(compId: number) {
    const rows = await this.db
      .select()
      .from(tblOrgCompany)
      .where(eq(tblOrgCompany.compId, compId))
      .limit(1);

    if (!rows[0]) {
      throw new NotFoundException(`Company #${compId} not found.`);
    }
    return rows[0];
  }

  async create(
    dto: CreateCompanyDto,
    user: AuthenticatedUserContext,
    meta: RequestMeta,
  ) {
    const existingCode = await this.db
      .select({ compId: tblOrgCompany.compId })
      .from(tblOrgCompany)
      .where(eq(tblOrgCompany.compCode, dto.compCode))
      .limit(1);

    if (existingCode[0]) {
      throw new ConflictException(
        `Company Code "${dto.compCode}" already exists.`,
      );
    }

    const [created] = await this.db
      .insert(tblOrgCompany)
      .values({
        compCode: dto.compCode,
        compName: dto.compName,
        legalName: dto.legalName,
        gstin: dto.gstin || null,
        panNo: dto.panNo || null,
        cinNo: dto.cinNo || null,
        iecCode: dto.iecCode || null,
        msmeRegNo: dto.msmeRegNo || null,
        baseCurrencyCode: dto.baseCurrencyCode || 'INR',
        registeredAddress: dto.registeredAddress || null,
        city: dto.city || null,
        stateName: dto.stateName || null,
        stateCode: dto.stateCode || null,
        pincode: dto.pincode || null,
        country: dto.country || 'India',
        phone: dto.phone || null,
        email: dto.email || null,
        website: dto.website || null,
        logoUrl: dto.logoUrl || null,
        isActive: dto.isActive ?? true,
        branchId: user.branchId || 1001,
        fyearId: user.fyearId || 1001,
        createdBy: user.userId,
      })
      .returning();

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'COMPANY_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_org_company',
      recordId: created.compId,
      oldValue: null,
      newValue: created,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });

    return created;
  }

  async update(
    compId: number,
    dto: UpdateCompanyDto,
    user: AuthenticatedUserContext,
    meta: RequestMeta,
  ) {
    const before = await this.findOne(compId);

    if (dto.compCode && dto.compCode !== before.compCode) {
      const duplicate = await this.db
        .select({ compId: tblOrgCompany.compId })
        .from(tblOrgCompany)
        .where(
          and(
            eq(tblOrgCompany.compCode, dto.compCode),
            ne(tblOrgCompany.compId, compId),
          ),
        )
        .limit(1);

      if (duplicate[0]) {
        throw new ConflictException(
          `Company Code "${dto.compCode}" is already used by another company.`,
        );
      }
    }

    const [updated] = await this.db
      .update(tblOrgCompany)
      .set({
        compCode: dto.compCode ?? before.compCode,
        compName: dto.compName ?? before.compName,
        legalName: dto.legalName ?? before.legalName,
        gstin: dto.gstin !== undefined ? dto.gstin || null : before.gstin,
        panNo: dto.panNo !== undefined ? dto.panNo || null : before.panNo,
        cinNo: dto.cinNo !== undefined ? dto.cinNo || null : before.cinNo,
        iecCode:
          dto.iecCode !== undefined ? dto.iecCode || null : before.iecCode,
        msmeRegNo:
          dto.msmeRegNo !== undefined
            ? dto.msmeRegNo || null
            : before.msmeRegNo,
        baseCurrencyCode: dto.baseCurrencyCode ?? before.baseCurrencyCode,
        registeredAddress:
          dto.registeredAddress !== undefined
            ? dto.registeredAddress || null
            : before.registeredAddress,
        city: dto.city !== undefined ? dto.city || null : before.city,
        stateName:
          dto.stateName !== undefined
            ? dto.stateName || null
            : before.stateName,
        stateCode:
          dto.stateCode !== undefined
            ? dto.stateCode || null
            : before.stateCode,
        pincode:
          dto.pincode !== undefined ? dto.pincode || null : before.pincode,
        country: dto.country ?? before.country,
        phone: dto.phone !== undefined ? dto.phone || null : before.phone,
        email: dto.email !== undefined ? dto.email || null : before.email,
        website:
          dto.website !== undefined ? dto.website || null : before.website,
        logoUrl:
          dto.logoUrl !== undefined ? dto.logoUrl || null : before.logoUrl,
        isActive: dto.isActive ?? before.isActive,
        updatedBy: user.userId,
        updatedDate: new Date(),
      })
      .where(eq(tblOrgCompany.compId, compId))
      .returning();

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'COMPANY_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_org_company',
      recordId: compId,
      oldValue: before,
      newValue: updated,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });

    return updated;
  }

  async remove(
    compId: number,
    user: AuthenticatedUserContext,
    meta: RequestMeta,
  ) {
    const before = await this.findOne(compId);

    // Pre-deletion universal dependency check across referencing tables
    await this.dependencyCheckService.verifyCanDelete({
      entity: 'COMPANY',
      entityId: compId,
      relations: [
        {
          table: 'tbl_org_branch',
          column: 'comp_id',
          label: 'Plant / Branches',
        },
        {
          table: 'tbl_org_financial_year',
          column: 'comp_id',
          label: 'Financial Years',
        },
        {
          table: 'tbl_sec_user_company_role',
          column: 'mapped_comp_id',
          label: 'User Company Role Assignments',
        },
        {
          table: 'tbl_sec_user_branch_role',
          column: 'mapped_comp_id',
          label: 'User Branch Role Assignments',
        },
      ],
    });

    await this.db
      .delete(tblOrgCompany)
      .where(eq(tblOrgCompany.compId, compId));

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'COMPANY_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_org_company',
      recordId: compId,
      oldValue: before,
      newValue: null,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });

    return { deletedId: compId, compCode: before.compCode };
  }

  async logActionItem(
    actionType: 'PRINT' | 'EXPORT',
    user: AuthenticatedUserContext,
    meta: RequestMeta,
  ) {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'COMPANY_MASTER',
      actionType,
      entityTable: 'tbl_org_company',
      recordId: 0,
      oldValue: null,
      newValue: { action: actionType, timestamp: new Date().toISOString() },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });

    return { logged: true, actionType };
  }
}
