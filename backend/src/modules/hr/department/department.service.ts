import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { DependencyCheckService } from '../../../common/services/dependency-check.service';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import type {
  CreateDepartmentDto,
  CreateDesignationDto,
  UpdateDepartmentDto,
  UpdateDesignationDto,
} from './department.dto';

export interface DepartmentRecord {
  deptId: number;
  compId: number;
  compCode: string;
  compName: string;
  branchId: number;
  deptCode: string;
  deptName: string;
  deptCategory: string;
  parentDeptId: number | null;
  parentDeptCode: string | null;
  parentDeptName: string | null;
  hodEmployeeId: number | null;
  costCenterCode: string | null;
  description: string | null;
  designationCount: number;
  isActive: boolean;
  createdDate: string;
  updatedDate: string | null;
}

export interface DesignationRecord {
  desigId: number;
  compId: number;
  compCode: string;
  compName: string;
  branchId: number;
  desigCode: string;
  desigName: string;
  deptId: number | null;
  deptCode: string | null;
  deptName: string | null;
  gradeCode: string;
  hierarchyLevel: number;
  description: string | null;
  isActive: boolean;
  createdDate: string;
  updatedDate: string | null;
}

@Injectable()
export class DepartmentService implements OnModuleInit {
  private readonly logger = new Logger(DepartmentService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE SEQUENCE IF NOT EXISTS seq_dept_id START WITH 1001 INCREMENT BY 1;
        CREATE TABLE IF NOT EXISTS tbl_hr_department (
            dept_id             BIGINT          PRIMARY KEY DEFAULT nextval('seq_dept_id'),
            dept_code           VARCHAR(30)     NOT NULL,
            dept_name           VARCHAR(120)    NOT NULL,
            dept_category       VARCHAR(40)     NOT NULL DEFAULT 'PRODUCTION',
            parent_dept_id      BIGINT          REFERENCES tbl_hr_department(dept_id),
            hod_employee_id     BIGINT,
            cost_center_code    VARCHAR(40),
            description         VARCHAR(300),
            is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
            comp_id             BIGINT          NOT NULL REFERENCES tbl_org_company(comp_id),
            branch_id           BIGINT          NOT NULL DEFAULT 1001,
            fyear_id            BIGINT,
            created_by          BIGINT          NOT NULL,
            created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_by          BIGINT,
            updated_date        TIMESTAMPTZ,
            CONSTRAINT uq_hr_dept_code UNIQUE (comp_id, dept_code)
        );
        CREATE INDEX IF NOT EXISTS idx_hr_dept_comp_branch ON tbl_hr_department (comp_id, branch_id, is_active);

        CREATE SEQUENCE IF NOT EXISTS seq_desig_id START WITH 1001 INCREMENT BY 1;
        CREATE TABLE IF NOT EXISTS tbl_hr_designation (
            desig_id            BIGINT          PRIMARY KEY DEFAULT nextval('seq_desig_id'),
            desig_code          VARCHAR(30)     NOT NULL,
            desig_name          VARCHAR(120)    NOT NULL,
            dept_id             BIGINT          REFERENCES tbl_hr_department(dept_id),
            grade_code          VARCHAR(20)     NOT NULL DEFAULT 'L3',
            hierarchy_level     INT             NOT NULL DEFAULT 3,
            description         VARCHAR(300),
            is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
            comp_id             BIGINT          NOT NULL REFERENCES tbl_org_company(comp_id),
            branch_id           BIGINT          NOT NULL DEFAULT 1001,
            fyear_id            BIGINT,
            created_by          BIGINT          NOT NULL,
            created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_by          BIGINT,
            updated_date        TIMESTAMPTZ,
            CONSTRAINT uq_hr_desig_code UNIQUE (comp_id, desig_code)
        );
        CREATE INDEX IF NOT EXISTS idx_hr_desig_comp_dept ON tbl_hr_designation (comp_id, dept_id, is_active);
      `);
    } catch (err: any) {
      this.logger.warn(
        `Unable to verify HR tables on startup: ${err?.message || err}`,
      );
    }
  }

  // ==========================================================================
  // 1. Department Master CRUD (`tbl_hr_department`)
  // ==========================================================================

  async findAllDepartments(compId?: number): Promise<DepartmentRecord[]> {
    const params: any[] = [];
    let whereSql = '';
    if (compId) {
      params.push(compId);
      whereSql = `WHERE d.comp_id = $1`;
    }

    const res = await this.pool.query(
      `
      SELECT
        d.dept_id,
        d.comp_id,
        c.comp_code,
        c.comp_name,
        d.branch_id,
        d.dept_code,
        d.dept_name,
        d.dept_category,
        d.parent_dept_id,
        pd.dept_code AS parent_dept_code,
        pd.dept_name AS parent_dept_name,
        d.hod_employee_id,
        d.cost_center_code,
        d.description,
        d.is_active,
        d.created_date,
        d.updated_date,
        (
          SELECT COUNT(*)::int
          FROM tbl_hr_designation dg
          WHERE dg.dept_id = d.dept_id
        ) AS designation_count
      FROM tbl_hr_department d
      INNER JOIN tbl_org_company c ON c.comp_id = d.comp_id
      LEFT JOIN tbl_hr_department pd ON pd.dept_id = d.parent_dept_id
      ${whereSql}
      ORDER BY d.comp_id ASC, d.dept_code ASC
      `,
      params,
    );

    return res.rows.map((r) => this.mapDepartmentRow(r));
  }

  async findDepartmentById(deptId: number): Promise<DepartmentRecord> {
    const res = await this.pool.query(
      `
      SELECT
        d.dept_id,
        d.comp_id,
        c.comp_code,
        c.comp_name,
        d.branch_id,
        d.dept_code,
        d.dept_name,
        d.dept_category,
        d.parent_dept_id,
        pd.dept_code AS parent_dept_code,
        pd.dept_name AS parent_dept_name,
        d.hod_employee_id,
        d.cost_center_code,
        d.description,
        d.is_active,
        d.created_date,
        d.updated_date,
        (
          SELECT COUNT(*)::int
          FROM tbl_hr_designation dg
          WHERE dg.dept_id = d.dept_id
        ) AS designation_count
      FROM tbl_hr_department d
      INNER JOIN tbl_org_company c ON c.comp_id = d.comp_id
      LEFT JOIN tbl_hr_department pd ON pd.dept_id = d.parent_dept_id
      WHERE d.dept_id = $1
      LIMIT 1
      `,
      [deptId],
    );

    if (res.rowCount === 0) {
      throw new NotFoundException(`Department #${deptId} not found.`);
    }
    return this.mapDepartmentRow(res.rows[0]);
  }

  async createDepartment(
    dto: CreateDepartmentDto,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<DepartmentRecord> {
    const compId = Number(dto.compId || user.compId || 1001);
    const branchId = Number(dto.branchId || user.branchId || 1001);
    const deptCode = (dto.deptCode || '').trim().toUpperCase();
    const deptName = (dto.deptName || '').trim();

    if (!deptCode || !deptName) {
      throw new BadRequestException(
        'Department Code and Department Name are required.',
      );
    }

    const dupCheck = await this.pool.query(
      `SELECT dept_id FROM tbl_hr_department WHERE comp_id = $1 AND UPPER(dept_code) = $2 LIMIT 1`,
      [compId, deptCode],
    );
    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Department Code "${deptCode}" already exists in the selected company.`,
      );
    }

    const insertRes = await this.pool.query(
      `
      INSERT INTO tbl_hr_department (
        dept_code, dept_name, dept_category, parent_dept_id, hod_employee_id,
        cost_center_code, description, is_active,
        comp_id, branch_id, fyear_id, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12
      )
      RETURNING dept_id
      `,
      [
        deptCode,
        deptName,
        dto.deptCategory || 'PRODUCTION',
        dto.parentDeptId || null,
        dto.hodEmployeeId || null,
        dto.costCenterCode?.trim() || null,
        dto.description?.trim() || null,
        dto.isActive !== undefined ? Boolean(dto.isActive) : true,
        compId,
        branchId,
        user.fyearId || 1001,
        user.userId,
      ],
    );

    const newDeptId = Number(insertRes.rows[0].dept_id);
    const created = await this.findDepartmentById(newDeptId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'DEPT_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_hr_department',
      recordId: newDeptId,
      newValue: created as unknown as Record<string, unknown>,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId,
      branchId,
      fyearId: user.fyearId,
    });

    return created;
  }

  async updateDepartment(
    deptId: number,
    dto: UpdateDepartmentDto,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<DepartmentRecord> {
    const existing = await this.findDepartmentById(deptId);
    const compId = Number(dto.compId ?? existing.compId);
    const deptCode = (dto.deptCode ?? existing.deptCode).trim().toUpperCase();
    const deptName = (dto.deptName ?? existing.deptName).trim();

    if (dto.parentDeptId && Number(dto.parentDeptId) === deptId) {
      throw new BadRequestException(
        'A department cannot be assigned as its own parent department.',
      );
    }

    const dupCheck = await this.pool.query(
      `
      SELECT dept_id
      FROM tbl_hr_department
      WHERE comp_id = $1 AND UPPER(dept_code) = $2 AND dept_id <> $3
      LIMIT 1
      `,
      [compId, deptCode, deptId],
    );
    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Department Code "${deptCode}" already exists in the selected company.`,
      );
    }

    await this.pool.query(
      `
      UPDATE tbl_hr_department
      SET
        comp_id = $1,
        dept_code = $2,
        dept_name = $3,
        dept_category = $4,
        parent_dept_id = $5,
        hod_employee_id = $6,
        cost_center_code = $7,
        description = $8,
        is_active = $9,
        updated_by = $10,
        updated_date = CURRENT_TIMESTAMP
      WHERE dept_id = $11
      `,
      [
        compId,
        deptCode,
        deptName,
        dto.deptCategory ?? existing.deptCategory,
        dto.parentDeptId !== undefined
          ? dto.parentDeptId || null
          : existing.parentDeptId,
        dto.hodEmployeeId !== undefined
          ? dto.hodEmployeeId || null
          : existing.hodEmployeeId,
        dto.costCenterCode !== undefined
          ? dto.costCenterCode?.trim() || null
          : existing.costCenterCode,
        dto.description !== undefined
          ? dto.description?.trim() || null
          : existing.description,
        dto.isActive !== undefined ? Boolean(dto.isActive) : existing.isActive,
        user.userId,
        deptId,
      ],
    );

    const updated = await this.findDepartmentById(deptId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'DEPT_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_hr_department',
      recordId: deptId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });

    return updated;
  }

  async deleteDepartment(
    deptId: number,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<{ deletedId: number }> {
    const existing = await this.findDepartmentById(deptId);

    // Pre-Delete Dependency Verification
    await this.dependencyCheckService.verifyCanDelete({
      entity: 'DEPARTMENT',
      entityId: deptId,
      relations: [
        {
          table: 'tbl_hr_department',
          column: 'parent_dept_id',
          label: 'Child Sub-Departments',
        },
        {
          table: 'tbl_hr_designation',
          column: 'dept_id',
          label: 'Linked Job Designations',
        },
        {
          table: 'tbl_hr_employee',
          column: 'dept_id',
          label: 'Assigned Employees',
        },
      ],
    });

    await this.pool.query(`DELETE FROM tbl_hr_department WHERE dept_id = $1`, [
      deptId,
    ]);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'DEPT_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_hr_department',
      recordId: deptId,
      oldValue: existing as unknown as Record<string, unknown>,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });

    return { deletedId: deptId };
  }

  // ==========================================================================
  // 2. Designation Master CRUD (`tbl_hr_designation`)
  // ==========================================================================

  async findAllDesignations(compId?: number): Promise<DesignationRecord[]> {
    const params: any[] = [];
    let whereSql = '';
    if (compId) {
      params.push(compId);
      whereSql = `WHERE dg.comp_id = $1`;
    }

    const res = await this.pool.query(
      `
      SELECT
        dg.desig_id,
        dg.comp_id,
        c.comp_code,
        c.comp_name,
        dg.branch_id,
        dg.desig_code,
        dg.desig_name,
        dg.dept_id,
        d.dept_code,
        d.dept_name,
        dg.grade_code,
        dg.hierarchy_level,
        dg.description,
        dg.is_active,
        dg.created_date,
        dg.updated_date
      FROM tbl_hr_designation dg
      INNER JOIN tbl_org_company c ON c.comp_id = dg.comp_id
      LEFT JOIN tbl_hr_department d ON d.dept_id = dg.dept_id
      ${whereSql}
      ORDER BY dg.comp_id ASC, dg.hierarchy_level ASC, dg.desig_code ASC
      `,
      params,
    );

    return res.rows.map((r) => this.mapDesignationRow(r));
  }

  async findDesignationById(desigId: number): Promise<DesignationRecord> {
    const res = await this.pool.query(
      `
      SELECT
        dg.desig_id,
        dg.comp_id,
        c.comp_code,
        c.comp_name,
        dg.branch_id,
        dg.desig_code,
        dg.desig_name,
        dg.dept_id,
        d.dept_code,
        d.dept_name,
        dg.grade_code,
        dg.hierarchy_level,
        dg.description,
        dg.is_active,
        dg.created_date,
        dg.updated_date
      FROM tbl_hr_designation dg
      INNER JOIN tbl_org_company c ON c.comp_id = dg.comp_id
      LEFT JOIN tbl_hr_department d ON d.dept_id = dg.dept_id
      WHERE dg.desig_id = $1
      LIMIT 1
      `,
      [desigId],
    );

    if (res.rowCount === 0) {
      throw new NotFoundException(`Designation #${desigId} not found.`);
    }
    return this.mapDesignationRow(res.rows[0]);
  }

  async createDesignation(
    dto: CreateDesignationDto,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<DesignationRecord> {
    const compId = Number(dto.compId || user.compId || 1001);
    const branchId = Number(dto.branchId || user.branchId || 1001);
    const desigCode = (dto.desigCode || '').trim().toUpperCase();
    const desigName = (dto.desigName || '').trim();

    if (!desigCode || !desigName) {
      throw new BadRequestException(
        'Designation Code and Designation Title are required.',
      );
    }

    const dupCheck = await this.pool.query(
      `SELECT desig_id FROM tbl_hr_designation WHERE comp_id = $1 AND UPPER(desig_code) = $2 LIMIT 1`,
      [compId, desigCode],
    );
    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Designation Code "${desigCode}" already exists in the selected company.`,
      );
    }

    const insertRes = await this.pool.query(
      `
      INSERT INTO tbl_hr_designation (
        desig_code, desig_name, dept_id, grade_code, hierarchy_level,
        description, is_active,
        comp_id, branch_id, fyear_id, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7,
        $8, $9, $10, $11
      )
      RETURNING desig_id
      `,
      [
        desigCode,
        desigName,
        dto.deptId || null,
        (dto.gradeCode || 'L3').trim().toUpperCase(),
        Number(dto.hierarchyLevel || 3),
        dto.description?.trim() || null,
        dto.isActive !== undefined ? Boolean(dto.isActive) : true,
        compId,
        branchId,
        user.fyearId || 1001,
        user.userId,
      ],
    );

    const newDesigId = Number(insertRes.rows[0].desig_id);
    const created = await this.findDesignationById(newDesigId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'DEPT_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_hr_designation',
      recordId: newDesigId,
      newValue: created as unknown as Record<string, unknown>,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId,
      branchId,
      fyearId: user.fyearId,
    });

    return created;
  }

  async updateDesignation(
    desigId: number,
    dto: UpdateDesignationDto,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<DesignationRecord> {
    const existing = await this.findDesignationById(desigId);
    const compId = Number(dto.compId ?? existing.compId);
    const desigCode = (dto.desigCode ?? existing.desigCode)
      .trim()
      .toUpperCase();
    const desigName = (dto.desigName ?? existing.desigName).trim();

    const dupCheck = await this.pool.query(
      `
      SELECT desig_id
      FROM tbl_hr_designation
      WHERE comp_id = $1 AND UPPER(desig_code) = $2 AND desig_id <> $3
      LIMIT 1
      `,
      [compId, desigCode, desigId],
    );
    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Designation Code "${desigCode}" already exists in the selected company.`,
      );
    }

    await this.pool.query(
      `
      UPDATE tbl_hr_designation
      SET
        comp_id = $1,
        desig_code = $2,
        desig_name = $3,
        dept_id = $4,
        grade_code = $5,
        hierarchy_level = $6,
        description = $7,
        is_active = $8,
        updated_by = $9,
        updated_date = CURRENT_TIMESTAMP
      WHERE desig_id = $10
      `,
      [
        compId,
        desigCode,
        desigName,
        dto.deptId !== undefined ? dto.deptId || null : existing.deptId,
        (dto.gradeCode ?? existing.gradeCode).trim().toUpperCase(),
        Number(dto.hierarchyLevel ?? existing.hierarchyLevel),
        dto.description !== undefined
          ? dto.description?.trim() || null
          : existing.description,
        dto.isActive !== undefined ? Boolean(dto.isActive) : existing.isActive,
        user.userId,
        desigId,
      ],
    );

    const updated = await this.findDesignationById(desigId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'DEPT_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_hr_designation',
      recordId: desigId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });

    return updated;
  }

  async deleteDesignation(
    desigId: number,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<{ deletedId: number }> {
    const existing = await this.findDesignationById(desigId);

    // Pre-Delete Dependency Verification
    await this.dependencyCheckService.verifyCanDelete({
      entity: 'DESIGNATION',
      entityId: desigId,
      relations: [
        {
          table: 'tbl_hr_employee',
          column: 'desig_id',
          label: 'Assigned Employees',
        },
      ],
    });

    await this.pool.query(
      `DELETE FROM tbl_hr_designation WHERE desig_id = $1`,
      [desigId],
    );

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'DEPT_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_hr_designation',
      recordId: desigId,
      oldValue: existing as unknown as Record<string, unknown>,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });

    return { deletedId: desigId };
  }

  async recordScreenAction(
    actionType: 'PRINT' | 'EXPORT',
    entityTable: string,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<void> {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'DEPT_MASTER',
      actionType,
      entityTable,
      recordId: 0,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });
  }

  private mapDepartmentRow(r: any): DepartmentRecord {
    return {
      deptId: Number(r.dept_id),
      compId: Number(r.comp_id),
      compCode: r.comp_code,
      compName: r.comp_name,
      branchId: Number(r.branch_id),
      deptCode: r.dept_code,
      deptName: r.dept_name,
      deptCategory: r.dept_category,
      parentDeptId: r.parent_dept_id ? Number(r.parent_dept_id) : null,
      parentDeptCode: r.parent_dept_code || null,
      parentDeptName: r.parent_dept_name || null,
      hodEmployeeId: r.hod_employee_id ? Number(r.hod_employee_id) : null,
      costCenterCode: r.cost_center_code || null,
      description: r.description || null,
      designationCount: Number(r.designation_count || 0),
      isActive: Boolean(r.is_active),
      createdDate: r.created_date,
      updatedDate: r.updated_date || null,
    };
  }

  private mapDesignationRow(r: any): DesignationRecord {
    return {
      desigId: Number(r.desig_id),
      compId: Number(r.comp_id),
      compCode: r.comp_code,
      compName: r.comp_name,
      branchId: Number(r.branch_id),
      desigCode: r.desig_code,
      desigName: r.desig_name,
      deptId: r.dept_id ? Number(r.dept_id) : null,
      deptCode: r.dept_code || null,
      deptName: r.dept_name || null,
      gradeCode: r.grade_code,
      hierarchyLevel: Number(r.hierarchy_level),
      description: r.description || null,
      isActive: Boolean(r.is_active),
      createdDate: r.created_date,
      updatedDate: r.updated_date || null,
    };
  }
}
