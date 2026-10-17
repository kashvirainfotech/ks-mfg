import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { Pool } from 'pg';
import { DRIZZLE_DB, PG_POOL } from '../../../database/database.module';
import type { DrizzleDb } from '../../../database/database.module';
import {
  tblOrgBranchFyear,
  tblOrgCompany,
  tblOrgFinancialYear,
} from '../../../database/schema';
import { DependencyCheckService } from '../../../common/services/dependency-check.service';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import {
  CreateFinancialYearDto,
  UpdateFinancialYearDto,
  UpsertBranchFyearDto,
} from './financial-year.dto';
import { RequestMeta } from '../company/company.service';

@Injectable()
export class FinancialYearService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly dependencyCheckService: DependencyCheckService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async findAll(filters?: {
    compId?: string;
    isClosed?: string;
    isActive?: string;
    search?: string;
  }) {
    const params: any[] = [];
    const conditions: string[] = [];

    if (filters?.compId && !Number.isNaN(Number(filters.compId))) {
      params.push(Number(filters.compId));
      conditions.push(`fy.comp_id = $${params.length}`);
    }

    if (filters?.isClosed === 'true') {
      conditions.push(`fy.is_closed = TRUE`);
    } else if (filters?.isClosed === 'false') {
      conditions.push(`fy.is_closed = FALSE`);
    }

    if (filters?.isActive === 'true') {
      conditions.push(`fy.is_active = TRUE`);
    } else if (filters?.isActive === 'false') {
      conditions.push(`fy.is_active = FALSE`);
    }

    if (filters?.search && filters.search.trim()) {
      params.push(`%${filters.search.trim()}%`);
      const idx = params.length;
      conditions.push(
        `(fy.fyear_code ILIKE $${idx} OR fy.fyear_name ILIKE $${idx} OR c.comp_code ILIKE $${idx} OR c.comp_name ILIKE $${idx})`,
      );
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const fyRes = await this.pool.query(
      `
      SELECT
        fy.fyear_id AS "fyearId",
        fy.comp_id AS "compId",
        c.comp_code AS "compCode",
        c.comp_name AS "compName",
        fy.fyear_code AS "fyearCode",
        fy.fyear_name AS "fyearName",
        TO_CHAR(fy.start_date, 'YYYY-MM-DD') AS "startDate",
        TO_CHAR(fy.end_date, 'YYYY-MM-DD') AS "endDate",
        fy.is_current AS "isCurrent",
        fy.is_closed AS "isClosed",
        fy.is_active AS "isActive"
      FROM tbl_org_financial_year fy
      INNER JOIN tbl_org_company c ON c.comp_id = fy.comp_id
      ${whereSql}
      ORDER BY fy.comp_id ASC, fy.start_date DESC
      `,
      params,
    );

    const mappingsRes = await this.pool.query(
      `
      SELECT
        b.branch_id AS "branchId",
        b.comp_id AS "compId",
        b.branch_code AS "branchCode",
        b.branch_name AS "branchName",
        b.branch_type AS "branchType",
        b.city,
        bfy.branch_fyear_id AS "branchFyearId",
        bfy.fyear_id AS "fyearId",
        COALESCE(bfy.is_locked, FALSE) AS "isLocked",
        TO_CHAR(bfy.books_begin_from, 'YYYY-MM-DD') AS "booksBeginFrom",
        COALESCE(bfy.is_active, TRUE) AS "isActive"
      FROM tbl_org_branch b
      LEFT JOIN tbl_org_branch_fyear bfy
        ON bfy.branch_id = b.branch_id AND bfy.comp_id = b.comp_id
      WHERE b.is_active = TRUE
      ORDER BY b.branch_id ASC
      `,
    );

    // Also fetch all active branches per company so every FY row shows all company branches
    const branchesRes = await this.pool.query(
      `
      SELECT
        branch_id AS "branchId",
        comp_id AS "compId",
        branch_code AS "branchCode",
        branch_name AS "branchName",
        branch_type AS "branchType",
        city
      FROM tbl_org_branch
      WHERE is_active = TRUE
      ORDER BY comp_id ASC, branch_id ASC
      `,
    );

    return fyRes.rows.map((fy) => {
      const fyearId = Number(fy.fyearId);
      const compId = Number(fy.compId);
      const compBranches = branchesRes.rows.filter(
        (b) => Number(b.compId) === compId,
      );

      const branchLocks = compBranches.map((b) => {
        const branchId = Number(b.branchId);
        const match = mappingsRes.rows.find(
          (m) =>
            Number(m.branchId) === branchId && Number(m.fyearId) === fyearId,
        );
        return {
          branchFyearId: match?.branchFyearId
            ? Number(match.branchFyearId)
            : null,
          compId,
          branchId,
          fyearId,
          branchCode: b.branchCode,
          branchName: b.branchName,
          branchType: b.branchType,
          city: b.city,
          isLocked: Boolean(fy.isClosed || match?.isLocked),
          booksBeginFrom: match?.booksBeginFrom || fy.startDate,
          isActive: match ? Boolean(match.isActive) : true,
        };
      });

      return {
        ...fy,
        fyearId,
        compId,
        branchLocks,
      };
    });
  }

  async findOne(fyearId: number) {
    const all = await this.findAll();
    const found = all.find((f) => f.fyearId === fyearId);
    if (!found) {
      throw new NotFoundException(`Financial Year #${fyearId} not found.`);
    }
    return found;
  }

  async create(
    dto: CreateFinancialYearDto,
    user: AuthenticatedUserContext,
    meta: RequestMeta,
  ) {
    const compRows = await this.db
      .select({
        compId: tblOrgCompany.compId,
        compCode: tblOrgCompany.compCode,
      })
      .from(tblOrgCompany)
      .where(eq(tblOrgCompany.compId, dto.compId))
      .limit(1);

    if (!compRows[0]) {
      throw new NotFoundException(`Company #${dto.compId} not found.`);
    }

    const duplicate = await this.db
      .select({ fyearId: tblOrgFinancialYear.fyearId })
      .from(tblOrgFinancialYear)
      .where(
        and(
          eq(tblOrgFinancialYear.compId, dto.compId),
          eq(tblOrgFinancialYear.fyearCode, dto.fyearCode),
        ),
      )
      .limit(1);

    if (duplicate[0]) {
      throw new ConflictException(
        `Financial Year "${dto.fyearCode}" already exists for Company ${compRows[0].compCode}.`,
      );
    }

    // If marked as current FY, clear previous is_current for the same company
    if (dto.isCurrent) {
      await this.db
        .update(tblOrgFinancialYear)
        .set({ isCurrent: false, updatedBy: user.userId, updatedDate: new Date() })
        .where(eq(tblOrgFinancialYear.compId, dto.compId));
    }

    const [created] = await this.db
      .insert(tblOrgFinancialYear)
      .values({
        compId: dto.compId,
        branchId: user.branchId || 1001,
        fyearCode: dto.fyearCode,
        fyearName: dto.fyearName,
        startDate: dto.startDate,
        endDate: dto.endDate,
        isCurrent: dto.isCurrent ?? false,
        isClosed: dto.isClosed ?? false,
        isActive: dto.isActive ?? true,
        createdBy: user.userId,
      })
      .returning();

    // Auto-seed branch_fyear rows for all active branches of this company
    await this.pool.query(
      `
      INSERT INTO tbl_org_branch_fyear (
        is_locked, books_begin_from, is_active,
        comp_id, branch_id, fyear_id, created_by
      )
      SELECT $1, $2::date, TRUE, b.comp_id, b.branch_id, $3, $4
      FROM tbl_org_branch b
      WHERE b.comp_id = $5 AND b.is_active = TRUE
      ON CONFLICT (comp_id, branch_id, fyear_id) DO NOTHING
      `,
      [
        Boolean(dto.isClosed),
        dto.startDate,
        created.fyearId,
        user.userId,
        dto.compId,
      ],
    );

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'FYEAR_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_org_financial_year',
      recordId: created.fyearId,
      oldValue: null,
      newValue: created,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: dto.compId,
      branchId: user.branchId,
      fyearId: created.fyearId,
    });

    return this.findOne(created.fyearId);
  }

  async update(
    fyearId: number,
    dto: UpdateFinancialYearDto,
    user: AuthenticatedUserContext,
    meta: RequestMeta,
  ) {
    const before = await this.findOne(fyearId);
    const targetCompId = dto.compId ?? before.compId;
    const targetCode = dto.fyearCode ?? before.fyearCode;

    if (
      targetCompId !== before.compId ||
      targetCode !== before.fyearCode
    ) {
      const duplicate = await this.db
        .select({ fyearId: tblOrgFinancialYear.fyearId })
        .from(tblOrgFinancialYear)
        .where(
          and(
            eq(tblOrgFinancialYear.compId, targetCompId),
            eq(tblOrgFinancialYear.fyearCode, targetCode),
            ne(tblOrgFinancialYear.fyearId, fyearId),
          ),
        )
        .limit(1);

      if (duplicate[0]) {
        throw new ConflictException(
          `Financial Year "${targetCode}" already exists for the selected company.`,
        );
      }
    }

    if (dto.isCurrent) {
      await this.db
        .update(tblOrgFinancialYear)
        .set({ isCurrent: false, updatedBy: user.userId, updatedDate: new Date() })
        .where(
          and(
            eq(tblOrgFinancialYear.compId, targetCompId),
            ne(tblOrgFinancialYear.fyearId, fyearId),
          ),
        );
    }

    await this.db
      .update(tblOrgFinancialYear)
      .set({
        compId: targetCompId,
        fyearCode: targetCode,
        fyearName: dto.fyearName ?? before.fyearName,
        startDate: dto.startDate ?? before.startDate,
        endDate: dto.endDate ?? before.endDate,
        isCurrent: dto.isCurrent ?? before.isCurrent,
        isClosed: dto.isClosed ?? before.isClosed,
        isActive: dto.isActive ?? before.isActive,
        updatedBy: user.userId,
        updatedDate: new Date(),
      })
      .where(eq(tblOrgFinancialYear.fyearId, fyearId));

    // If the entire financial year is closed, lock all branch mappings automatically
    if (dto.isClosed === true) {
      await this.db
        .update(tblOrgBranchFyear)
        .set({
          isLocked: true,
          updatedBy: user.userId,
          updatedDate: new Date(),
        })
        .where(eq(tblOrgBranchFyear.fyearId, fyearId));
    }

    const after = await this.findOne(fyearId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'FYEAR_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_org_financial_year',
      recordId: fyearId,
      oldValue: before,
      newValue: after,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: after.compId,
      branchId: user.branchId,
      fyearId,
    });

    return after;
  }

  async upsertBranchLock(
    dto: UpsertBranchFyearDto,
    user: AuthenticatedUserContext,
    meta: RequestMeta,
  ) {
    const existingRows = await this.db
      .select()
      .from(tblOrgBranchFyear)
      .where(
        and(
          eq(tblOrgBranchFyear.compId, dto.compId),
          eq(tblOrgBranchFyear.branchId, dto.branchId),
          eq(tblOrgBranchFyear.fyearId, dto.fyearId),
        ),
      )
      .limit(1);

    const before = existingRows[0] ?? null;

    if (before) {
      const [updated] = await this.db
        .update(tblOrgBranchFyear)
        .set({
          isLocked: dto.isLocked,
          booksBeginFrom: dto.booksBeginFrom ?? before.booksBeginFrom,
          isActive: dto.isActive ?? before.isActive,
          updatedBy: user.userId,
          updatedDate: new Date(),
        })
        .where(eq(tblOrgBranchFyear.branchFyearId, before.branchFyearId))
        .returning();

      await this.auditLogService.logAction({
        userId: user.userId,
        username: user.username,
        screenCode: 'FYEAR_MASTER',
        actionType: 'EDIT',
        entityTable: 'tbl_org_branch_fyear',
        recordId: updated.branchFyearId,
        oldValue: before,
        newValue: updated,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        correlationId: meta.correlationId,
        compId: dto.compId,
        branchId: dto.branchId,
        fyearId: dto.fyearId,
      });
    } else {
      const [inserted] = await this.db
        .insert(tblOrgBranchFyear)
        .values({
          compId: dto.compId,
          branchId: dto.branchId,
          fyearId: dto.fyearId,
          isLocked: dto.isLocked,
          booksBeginFrom: dto.booksBeginFrom ?? null,
          isActive: dto.isActive ?? true,
          createdBy: user.userId,
        })
        .returning();

      await this.auditLogService.logAction({
        userId: user.userId,
        username: user.username,
        screenCode: 'FYEAR_MASTER',
        actionType: 'ADD',
        entityTable: 'tbl_org_branch_fyear',
        recordId: inserted.branchFyearId,
        oldValue: null,
        newValue: inserted,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        correlationId: meta.correlationId,
        compId: dto.compId,
        branchId: dto.branchId,
        fyearId: dto.fyearId,
      });
    }

    return this.findOne(dto.fyearId);
  }

  async remove(
    fyearId: number,
    user: AuthenticatedUserContext,
    meta: RequestMeta,
  ) {
    const before = await this.findOne(fyearId);

    // Pre-deletion universal dependency check across referencing tables
    await this.dependencyCheckService.verifyCanDelete({
      entity: 'FINANCIAL_YEAR',
      entityId: fyearId,
      relations: [
        {
          table: 'tbl_org_branch_fyear',
          column: 'fyear_id',
          label: 'Branch Financial Year Lock Mappings',
        },
        {
          table: 'tbl_sec_user_preference',
          column: 'default_fyear_id',
          label: 'User Default Financial Year Preferences',
        },
      ],
    });

    await this.db
      .delete(tblOrgFinancialYear)
      .where(eq(tblOrgFinancialYear.fyearId, fyearId));

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'FYEAR_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_org_financial_year',
      recordId: fyearId,
      oldValue: before,
      newValue: null,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: before.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });

    return { deletedId: fyearId, fyearCode: before.fyearCode };
  }

  async logActionItem(
    actionType: 'PRINT' | 'EXPORT',
    user: AuthenticatedUserContext,
    meta: RequestMeta,
  ) {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'FYEAR_MASTER',
      actionType,
      entityTable: 'tbl_org_financial_year',
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
