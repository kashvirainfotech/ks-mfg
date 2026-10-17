import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, ne } from 'drizzle-orm';
import { Pool } from 'pg';
import { DRIZZLE_DB, PG_POOL } from '../../../database/database.module';
import type { DrizzleDb } from '../../../database/database.module';
import { tblOrgBranch, tblOrgCompany } from '../../../database/schema';
import { DependencyCheckService } from '../../../common/services/dependency-check.service';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import { CreateBranchDto, UpdateBranchDto } from './branch.dto';
import { RequestMeta } from '../company/company.service';

@Injectable()
export class BranchService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly dependencyCheckService: DependencyCheckService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(filters?: {
    compId?: string;
    branchType?: string;
    isActive?: string;
    search?: string;
  }) {
    const params: any[] = [];
    const conditions: string[] = [];

    if (filters?.compId && !Number.isNaN(Number(filters.compId))) {
      params.push(Number(filters.compId));
      conditions.push(`b.comp_id = $${params.length}`);
    }

    if (filters?.branchType && filters.branchType !== 'ALL') {
      params.push(filters.branchType);
      conditions.push(`b.branch_type = $${params.length}`);
    }

    if (filters?.isActive === 'true') {
      conditions.push(`b.is_active = TRUE`);
    } else if (filters?.isActive === 'false') {
      conditions.push(`b.is_active = FALSE`);
    }

    if (filters?.search && filters.search.trim()) {
      params.push(`%${filters.search.trim()}%`);
      const idx = params.length;
      conditions.push(
        `(b.branch_code ILIKE $${idx} OR b.branch_name ILIKE $${idx} OR b.city ILIKE $${idx} OR b.state_name ILIKE $${idx} OR b.gstin ILIKE $${idx} OR c.comp_code ILIKE $${idx} OR c.comp_name ILIKE $${idx})`,
      );
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const res = await this.pool.query(
      `
      SELECT
        b.branch_id AS "branchId",
        b.comp_id AS "compId",
        c.comp_code AS "compCode",
        c.comp_name AS "compName",
        b.branch_code AS "branchCode",
        b.branch_name AS "branchName",
        b.branch_type AS "branchType",
        b.gstin,
        b.address,
        b.city,
        b.state_name AS "stateName",
        b.state_code AS "stateCode",
        b.pincode,
        b.country,
        b.phone,
        b.email,
        b.is_head_office AS "isHeadOffice",
        b.is_active AS "isActive",
        b.fyear_id AS "fyearId",
        b.created_by AS "createdBy",
        b.created_date AS "createdDate",
        b.updated_by AS "updatedBy",
        b.updated_date AS "updatedDate"
      FROM tbl_org_branch b
      INNER JOIN tbl_org_company c ON c.comp_id = b.comp_id
      ${whereSql}
      ORDER BY b.comp_id ASC, b.branch_id ASC
      `,
      params,
    );

    return res.rows.map((r) => ({
      ...r,
      branchId: Number(r.branchId),
      compId: Number(r.compId),
    }));
  }

  async findOne(branchId: number) {
    const res = await this.pool.query(
      `
      SELECT
        b.branch_id AS "branchId",
        b.comp_id AS "compId",
        c.comp_code AS "compCode",
        c.comp_name AS "compName",
        b.branch_code AS "branchCode",
        b.branch_name AS "branchName",
        b.branch_type AS "branchType",
        b.gstin,
        b.address,
        b.city,
        b.state_name AS "stateName",
        b.state_code AS "stateCode",
        b.pincode,
        b.country,
        b.phone,
        b.email,
        b.is_head_office AS "isHeadOffice",
        b.is_active AS "isActive"
      FROM tbl_org_branch b
      INNER JOIN tbl_org_company c ON c.comp_id = b.comp_id
      WHERE b.branch_id = $1
      LIMIT 1
      `,
      [branchId],
    );

    if (!res.rows[0]) {
      throw new NotFoundException(`Branch #${branchId} not found.`);
    }

    return {
      ...res.rows[0],
      branchId: Number(res.rows[0].branchId),
      compId: Number(res.rows[0].compId),
    };
  }

  async create(
    dto: CreateBranchDto,
    user: AuthenticatedUserContext,
    meta: RequestMeta,
  ) {
    // Verify parent company exists
    const compRows = await this.db
      .select({
        compId: tblOrgCompany.compId,
        compCode: tblOrgCompany.compCode,
        compName: tblOrgCompany.compName,
      })
      .from(tblOrgCompany)
      .where(eq(tblOrgCompany.compId, dto.compId))
      .limit(1);

    if (!compRows[0]) {
      throw new NotFoundException(`Parent Company #${dto.compId} not found.`);
    }

    // Verify unique (comp_id, branch_code)
    const duplicate = await this.db
      .select({ branchId: tblOrgBranch.branchId })
      .from(tblOrgBranch)
      .where(
        and(
          eq(tblOrgBranch.compId, dto.compId),
          eq(tblOrgBranch.branchCode, dto.branchCode),
        ),
      )
      .limit(1);

    if (duplicate[0]) {
      throw new ConflictException(
        `Branch Code "${dto.branchCode}" already exists under Company ${compRows[0].compCode}.`,
      );
    }

    const [created] = await this.db
      .insert(tblOrgBranch)
      .values({
        compId: dto.compId,
        branchCode: dto.branchCode,
        branchName: dto.branchName,
        branchType: dto.branchType || 'PLANT',
        gstin: dto.gstin || null,
        address: dto.address || null,
        city: dto.city || null,
        stateName: dto.stateName || null,
        stateCode: dto.stateCode || null,
        pincode: dto.pincode || null,
        country: dto.country || 'India',
        phone: dto.phone || null,
        email: dto.email || null,
        isHeadOffice: dto.isHeadOffice ?? false,
        isActive: dto.isActive ?? true,
        fyearId: user.fyearId || 1001,
        createdBy: user.userId,
      })
      .returning();

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'BRANCH_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_org_branch',
      recordId: created.branchId,
      oldValue: null,
      newValue: created,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: dto.compId,
      branchId: created.branchId,
      fyearId: user.fyearId,
    });

    return this.findOne(created.branchId);
  }

  async update(
    branchId: number,
    dto: UpdateBranchDto,
    user: AuthenticatedUserContext,
    meta: RequestMeta,
  ) {
    const before = await this.findOne(branchId);
    const targetCompId = dto.compId ?? before.compId;
    const targetCode = dto.branchCode ?? before.branchCode;

    if (
      targetCompId !== before.compId ||
      targetCode !== before.branchCode
    ) {
      const duplicate = await this.db
        .select({ branchId: tblOrgBranch.branchId })
        .from(tblOrgBranch)
        .where(
          and(
            eq(tblOrgBranch.compId, targetCompId),
            eq(tblOrgBranch.branchCode, targetCode),
            ne(tblOrgBranch.branchId, branchId),
          ),
        )
        .limit(1);

      if (duplicate[0]) {
        throw new ConflictException(
          `Branch Code "${targetCode}" already exists in the selected company.`,
        );
      }
    }

    await this.db
      .update(tblOrgBranch)
      .set({
        compId: targetCompId,
        branchCode: targetCode,
        branchName: dto.branchName ?? before.branchName,
        branchType: dto.branchType ?? before.branchType,
        gstin: dto.gstin !== undefined ? dto.gstin || null : before.gstin,
        address:
          dto.address !== undefined ? dto.address || null : before.address,
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
        isHeadOffice: dto.isHeadOffice ?? before.isHeadOffice,
        isActive: dto.isActive ?? before.isActive,
        updatedBy: user.userId,
        updatedDate: new Date(),
      })
      .where(eq(tblOrgBranch.branchId, branchId));

    const after = await this.findOne(branchId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'BRANCH_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_org_branch',
      recordId: branchId,
      oldValue: before,
      newValue: after,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: after.compId,
      branchId,
      fyearId: user.fyearId,
    });

    return after;
  }

  async remove(
    branchId: number,
    user: AuthenticatedUserContext,
    meta: RequestMeta,
  ) {
    const before = await this.findOne(branchId);

    // Pre-deletion universal dependency check across referencing tables
    await this.dependencyCheckService.verifyCanDelete({
      entity: 'BRANCH',
      entityId: branchId,
      relations: [
        {
          table: 'tbl_org_branch_fyear',
          column: 'branch_id',
          label: 'Branch Financial Year Mappings',
        },
        {
          table: 'tbl_sec_user_branch_role',
          column: 'mapped_branch_id',
          label: 'User Branch Role Assignments',
        },
        {
          table: 'tbl_sec_user_preference',
          column: 'default_branch_id',
          label: 'User Default Branch Preferences',
        },
      ],
    });

    await this.db
      .delete(tblOrgBranch)
      .where(eq(tblOrgBranch.branchId, branchId));

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'BRANCH_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_org_branch',
      recordId: branchId,
      oldValue: before,
      newValue: null,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: before.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });

    return { deletedId: branchId, branchCode: before.branchCode };
  }

  async logActionItem(
    actionType: 'PRINT' | 'EXPORT',
    user: AuthenticatedUserContext,
    meta: RequestMeta,
  ) {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'BRANCH_MASTER',
      actionType,
      entityTable: 'tbl_org_branch',
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
