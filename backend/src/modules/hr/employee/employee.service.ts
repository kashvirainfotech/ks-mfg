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
import type { CreateEmployeeDto, UpdateEmployeeDto } from './employee.dto';

export interface EmployeeRecord {
  employeeId: number;
  compId: number;
  compCode: string;
  compName: string;
  branchId: number;
  empCode: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  gender: string;
  dateOfBirth: string | null;
  dateOfJoining: string;
  deptId: number;
  deptCode: string;
  deptName: string;
  desigId: number;
  desigCode: string;
  desigName: string;
  gradeCode: string | null;
  primaryBranchId: number;
  primaryBranchCode: string;
  primaryBranchName: string;
  reportingManagerId: number | null;
  reportingManagerCode: string | null;
  reportingManagerName: string | null;
  employmentType: string;
  employmentStatus: string;
  workEmail: string | null;
  mobileNo: string;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bloodGroup: string | null;
  panNo: string | null;
  aadhaarMasked: string | null;
  pfUanNo: string | null;
  esiNo: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankIfscCode: string | null;
  addressLine1: string | null;
  city: string | null;
  stateName: string | null;
  pincode: string | null;
  remarks: string | null;
  directReportCount: number;
  isActive: boolean;
  createdDate: string;
  updatedDate: string | null;
}

@Injectable()
export class EmployeeService implements OnModuleInit {
  private readonly logger = new Logger(EmployeeService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.pool.query(`
        CREATE SEQUENCE IF NOT EXISTS seq_employee_id START WITH 1001 INCREMENT BY 1;
        CREATE TABLE IF NOT EXISTS tbl_hr_employee (
            employee_id             BIGINT          PRIMARY KEY DEFAULT nextval('seq_employee_id'),
            emp_code                VARCHAR(30)     NOT NULL,
            first_name              VARCHAR(80)     NOT NULL,
            last_name               VARCHAR(80),
            full_name               VARCHAR(165)    NOT NULL,
            gender                  VARCHAR(20)     NOT NULL DEFAULT 'MALE',
            date_of_birth           DATE,
            date_of_joining         DATE            NOT NULL,
            dept_id                 BIGINT          NOT NULL REFERENCES tbl_hr_department(dept_id),
            desig_id                BIGINT          NOT NULL REFERENCES tbl_hr_designation(desig_id),
            primary_branch_id       BIGINT          NOT NULL REFERENCES tbl_org_branch(branch_id),
            reporting_manager_id    BIGINT          REFERENCES tbl_hr_employee(employee_id),
            employment_type         VARCHAR(30)     NOT NULL DEFAULT 'PERMANENT',
            employment_status       VARCHAR(30)     NOT NULL DEFAULT 'ACTIVE',
            work_email              VARCHAR(150),
            mobile_no               VARCHAR(25)     NOT NULL,
            emergency_contact_name  VARCHAR(120),
            emergency_contact_phone VARCHAR(25),
            blood_group             VARCHAR(10),
            pan_no                  VARCHAR(15),
            aadhaar_masked          VARCHAR(20),
            pf_uan_no               VARCHAR(25),
            esi_no                  VARCHAR(25),
            bank_name               VARCHAR(120),
            bank_account_no         VARCHAR(40),
            bank_ifsc_code          VARCHAR(20),
            address_line1           VARCHAR(200),
            city                    VARCHAR(80),
            state_name              VARCHAR(80),
            pincode                 VARCHAR(15),
            remarks                 VARCHAR(300),
            is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
            comp_id                 BIGINT          NOT NULL REFERENCES tbl_org_company(comp_id),
            branch_id               BIGINT          NOT NULL DEFAULT 1001,
            fyear_id                BIGINT,
            created_by              BIGINT          NOT NULL,
            created_date            TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_by              BIGINT,
            updated_date            TIMESTAMPTZ,
            CONSTRAINT uq_hr_employee_code UNIQUE (comp_id, emp_code)
        );
        CREATE INDEX IF NOT EXISTS idx_hr_emp_comp_branch_dept ON tbl_hr_employee (comp_id, primary_branch_id, dept_id, is_active);
        CREATE INDEX IF NOT EXISTS idx_hr_emp_manager ON tbl_hr_employee (reporting_manager_id);
      `);
    } catch (err: any) {
      this.logger.warn(
        `Unable to verify tbl_hr_employee table on startup: ${err?.message || err}`,
      );
    }
  }

  async findAllEmployees(filters?: {
    compId?: number;
    branchId?: number;
    deptId?: number;
  }): Promise<EmployeeRecord[]> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (filters?.compId) {
      params.push(filters.compId);
      conditions.push(`e.comp_id = $${params.length}`);
    }
    if (filters?.branchId) {
      params.push(filters.branchId);
      conditions.push(`e.primary_branch_id = $${params.length}`);
    }
    if (filters?.deptId) {
      params.push(filters.deptId);
      conditions.push(`e.dept_id = $${params.length}`);
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const res = await this.pool.query(
      `
      SELECT
        e.employee_id,
        e.comp_id,
        c.comp_code,
        c.comp_name,
        e.branch_id,
        e.emp_code,
        e.first_name,
        e.last_name,
        e.full_name,
        e.gender,
        TO_CHAR(e.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
        TO_CHAR(e.date_of_joining, 'YYYY-MM-DD') AS date_of_joining,
        e.dept_id,
        d.dept_code,
        d.dept_name,
        e.desig_id,
        dg.desig_code,
        dg.desig_name,
        dg.grade_code,
        e.primary_branch_id,
        b.branch_code AS primary_branch_code,
        b.branch_name AS primary_branch_name,
        e.reporting_manager_id,
        rm.emp_code AS reporting_manager_code,
        rm.full_name AS reporting_manager_name,
        e.employment_type,
        e.employment_status,
        e.work_email,
        e.mobile_no,
        e.emergency_contact_name,
        e.emergency_contact_phone,
        e.blood_group,
        e.pan_no,
        e.aadhaar_masked,
        e.pf_uan_no,
        e.esi_no,
        e.bank_name,
        e.bank_account_no,
        e.bank_ifsc_code,
        e.address_line1,
        e.city,
        e.state_name,
        e.pincode,
        e.remarks,
        e.is_active,
        e.created_date,
        e.updated_date,
        (
          SELECT COUNT(*)::int
          FROM tbl_hr_employee sub
          WHERE sub.reporting_manager_id = e.employee_id
        ) AS direct_report_count
      FROM tbl_hr_employee e
      INNER JOIN tbl_org_company c ON c.comp_id = e.comp_id
      INNER JOIN tbl_org_branch b ON b.branch_id = e.primary_branch_id
      INNER JOIN tbl_hr_department d ON d.dept_id = e.dept_id
      INNER JOIN tbl_hr_designation dg ON dg.desig_id = e.desig_id
      LEFT JOIN tbl_hr_employee rm ON rm.employee_id = e.reporting_manager_id
      ${whereSql}
      ORDER BY e.comp_id ASC, e.emp_code ASC
      `,
      params,
    );

    return res.rows.map((r) => this.mapEmployeeRow(r));
  }

  async findEmployeeById(employeeId: number): Promise<EmployeeRecord> {
    const res = await this.pool.query(
      `
      SELECT
        e.employee_id,
        e.comp_id,
        c.comp_code,
        c.comp_name,
        e.branch_id,
        e.emp_code,
        e.first_name,
        e.last_name,
        e.full_name,
        e.gender,
        TO_CHAR(e.date_of_birth, 'YYYY-MM-DD') AS date_of_birth,
        TO_CHAR(e.date_of_joining, 'YYYY-MM-DD') AS date_of_joining,
        e.dept_id,
        d.dept_code,
        d.dept_name,
        e.desig_id,
        dg.desig_code,
        dg.desig_name,
        dg.grade_code,
        e.primary_branch_id,
        b.branch_code AS primary_branch_code,
        b.branch_name AS primary_branch_name,
        e.reporting_manager_id,
        rm.emp_code AS reporting_manager_code,
        rm.full_name AS reporting_manager_name,
        e.employment_type,
        e.employment_status,
        e.work_email,
        e.mobile_no,
        e.emergency_contact_name,
        e.emergency_contact_phone,
        e.blood_group,
        e.pan_no,
        e.aadhaar_masked,
        e.pf_uan_no,
        e.esi_no,
        e.bank_name,
        e.bank_account_no,
        e.bank_ifsc_code,
        e.address_line1,
        e.city,
        e.state_name,
        e.pincode,
        e.remarks,
        e.is_active,
        e.created_date,
        e.updated_date,
        (
          SELECT COUNT(*)::int
          FROM tbl_hr_employee sub
          WHERE sub.reporting_manager_id = e.employee_id
        ) AS direct_report_count
      FROM tbl_hr_employee e
      INNER JOIN tbl_org_company c ON c.comp_id = e.comp_id
      INNER JOIN tbl_org_branch b ON b.branch_id = e.primary_branch_id
      INNER JOIN tbl_hr_department d ON d.dept_id = e.dept_id
      INNER JOIN tbl_hr_designation dg ON dg.desig_id = e.desig_id
      LEFT JOIN tbl_hr_employee rm ON rm.employee_id = e.reporting_manager_id
      WHERE e.employee_id = $1
      LIMIT 1
      `,
      [employeeId],
    );

    if (res.rowCount === 0) {
      throw new NotFoundException(`Employee #${employeeId} not found.`);
    }
    return this.mapEmployeeRow(res.rows[0]);
  }

  async createEmployee(
    dto: CreateEmployeeDto,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<EmployeeRecord> {
    const compId = Number(dto.compId || user.compId || 1001);
    const primaryBranchId = Number(dto.primaryBranchId || user.branchId || 1001);
    const empCode = (dto.empCode || '').trim().toUpperCase();
    const firstName = (dto.firstName || '').trim();
    const lastName = (dto.lastName || '').trim() || null;
    const fullName = lastName ? `${firstName} ${lastName}` : firstName;
    const mobileNo = (dto.mobileNo || '').trim();
    const dateOfJoining = (dto.dateOfJoining || '').trim();

    if (
      !empCode ||
      !firstName ||
      !dateOfJoining ||
      !dto.deptId ||
      !dto.desigId ||
      !primaryBranchId ||
      !mobileNo
    ) {
      throw new BadRequestException(
        'Employee Code, First Name, Date of Joining, Department, Designation, Primary Plant/Branch, and Mobile Number are required.',
      );
    }

    const dupCheck = await this.pool.query(
      `SELECT employee_id FROM tbl_hr_employee WHERE comp_id = $1 AND UPPER(emp_code) = $2 LIMIT 1`,
      [compId, empCode],
    );
    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Employee Code "${empCode}" already exists in the selected company.`,
      );
    }

    const insertRes = await this.pool.query(
      `
      INSERT INTO tbl_hr_employee (
        emp_code, first_name, last_name, full_name, gender,
        date_of_birth, date_of_joining, dept_id, desig_id, primary_branch_id,
        reporting_manager_id, employment_type, employment_status,
        work_email, mobile_no, emergency_contact_name, emergency_contact_phone,
        blood_group, pan_no, aadhaar_masked, pf_uan_no, esi_no,
        bank_name, bank_account_no, bank_ifsc_code,
        address_line1, city, state_name, pincode, remarks, is_active,
        comp_id, branch_id, fyear_id, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20, $21, $22,
        $23, $24, $25,
        $26, $27, $28, $29, $30, $31,
        $32, $33, $34, $35
      )
      RETURNING employee_id
      `,
      [
        empCode,
        firstName,
        lastName,
        fullName,
        dto.gender || 'MALE',
        dto.dateOfBirth?.trim() || null,
        dateOfJoining,
        Number(dto.deptId),
        Number(dto.desigId),
        primaryBranchId,
        dto.reportingManagerId ? Number(dto.reportingManagerId) : null,
        dto.employmentType || 'PERMANENT',
        dto.employmentStatus || 'ACTIVE',
        dto.workEmail?.trim() || null,
        mobileNo,
        dto.emergencyContactName?.trim() || null,
        dto.emergencyContactPhone?.trim() || null,
        dto.bloodGroup?.trim() || null,
        dto.panNo?.trim().toUpperCase() || null,
        dto.aadhaarMasked?.trim() || null,
        dto.pfUanNo?.trim() || null,
        dto.esiNo?.trim() || null,
        dto.bankName?.trim() || null,
        dto.bankAccountNo?.trim() || null,
        dto.bankIfscCode?.trim().toUpperCase() || null,
        dto.addressLine1?.trim() || null,
        dto.city?.trim() || null,
        dto.stateName?.trim() || null,
        dto.pincode?.trim() || null,
        dto.remarks?.trim() || null,
        dto.isActive !== undefined ? Boolean(dto.isActive) : true,
        compId,
        primaryBranchId,
        user.fyearId || 1001,
        user.userId,
      ],
    );

    const newEmployeeId = Number(insertRes.rows[0].employee_id);
    const created = await this.findEmployeeById(newEmployeeId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'EMPLOYEE_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_hr_employee',
      recordId: newEmployeeId,
      newValue: created as unknown as Record<string, unknown>,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId,
      branchId: primaryBranchId,
      fyearId: user.fyearId,
    });

    return created;
  }

  async updateEmployee(
    employeeId: number,
    dto: UpdateEmployeeDto,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<EmployeeRecord> {
    const existing = await this.findEmployeeById(employeeId);
    const compId = Number(dto.compId ?? existing.compId);
    const primaryBranchId = Number(
      dto.primaryBranchId ?? existing.primaryBranchId,
    );
    const empCode = (dto.empCode ?? existing.empCode).trim().toUpperCase();
    const firstName = (dto.firstName ?? existing.firstName).trim();
    const lastName =
      dto.lastName !== undefined
        ? dto.lastName?.trim() || null
        : existing.lastName;
    const fullName = lastName ? `${firstName} ${lastName}` : firstName;

    if (
      dto.reportingManagerId &&
      Number(dto.reportingManagerId) === employeeId
    ) {
      throw new BadRequestException(
        'An employee cannot be assigned as their own Reporting Manager.',
      );
    }

    const dupCheck = await this.pool.query(
      `
      SELECT employee_id
      FROM tbl_hr_employee
      WHERE comp_id = $1 AND UPPER(emp_code) = $2 AND employee_id <> $3
      LIMIT 1
      `,
      [compId, empCode, employeeId],
    );
    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Employee Code "${empCode}" already exists in the selected company.`,
      );
    }

    await this.pool.query(
      `
      UPDATE tbl_hr_employee
      SET
        comp_id = $1,
        branch_id = $2,
        emp_code = $3,
        first_name = $4,
        last_name = $5,
        full_name = $6,
        gender = $7,
        date_of_birth = $8,
        date_of_joining = $9,
        dept_id = $10,
        desig_id = $11,
        primary_branch_id = $12,
        reporting_manager_id = $13,
        employment_type = $14,
        employment_status = $15,
        work_email = $16,
        mobile_no = $17,
        emergency_contact_name = $18,
        emergency_contact_phone = $19,
        blood_group = $20,
        pan_no = $21,
        aadhaar_masked = $22,
        pf_uan_no = $23,
        esi_no = $24,
        bank_name = $25,
        bank_account_no = $26,
        bank_ifsc_code = $27,
        address_line1 = $28,
        city = $29,
        state_name = $30,
        pincode = $31,
        remarks = $32,
        is_active = $33,
        updated_by = $34,
        updated_date = CURRENT_TIMESTAMP
      WHERE employee_id = $35
      `,
      [
        compId,
        primaryBranchId,
        empCode,
        firstName,
        lastName,
        fullName,
        dto.gender ?? existing.gender,
        dto.dateOfBirth !== undefined
          ? dto.dateOfBirth?.trim() || null
          : existing.dateOfBirth,
        dto.dateOfJoining?.trim() || existing.dateOfJoining,
        Number(dto.deptId ?? existing.deptId),
        Number(dto.desigId ?? existing.desigId),
        primaryBranchId,
        dto.reportingManagerId !== undefined
          ? dto.reportingManagerId
            ? Number(dto.reportingManagerId)
            : null
          : existing.reportingManagerId,
        dto.employmentType ?? existing.employmentType,
        dto.employmentStatus ?? existing.employmentStatus,
        dto.workEmail !== undefined
          ? dto.workEmail?.trim() || null
          : existing.workEmail,
        (dto.mobileNo ?? existing.mobileNo).trim(),
        dto.emergencyContactName !== undefined
          ? dto.emergencyContactName?.trim() || null
          : existing.emergencyContactName,
        dto.emergencyContactPhone !== undefined
          ? dto.emergencyContactPhone?.trim() || null
          : existing.emergencyContactPhone,
        dto.bloodGroup !== undefined
          ? dto.bloodGroup?.trim() || null
          : existing.bloodGroup,
        dto.panNo !== undefined
          ? dto.panNo?.trim().toUpperCase() || null
          : existing.panNo,
        dto.aadhaarMasked !== undefined
          ? dto.aadhaarMasked?.trim() || null
          : existing.aadhaarMasked,
        dto.pfUanNo !== undefined
          ? dto.pfUanNo?.trim() || null
          : existing.pfUanNo,
        dto.esiNo !== undefined ? dto.esiNo?.trim() || null : existing.esiNo,
        dto.bankName !== undefined
          ? dto.bankName?.trim() || null
          : existing.bankName,
        dto.bankAccountNo !== undefined
          ? dto.bankAccountNo?.trim() || null
          : existing.bankAccountNo,
        dto.bankIfscCode !== undefined
          ? dto.bankIfscCode?.trim().toUpperCase() || null
          : existing.bankIfscCode,
        dto.addressLine1 !== undefined
          ? dto.addressLine1?.trim() || null
          : existing.addressLine1,
        dto.city !== undefined ? dto.city?.trim() || null : existing.city,
        dto.stateName !== undefined
          ? dto.stateName?.trim() || null
          : existing.stateName,
        dto.pincode !== undefined
          ? dto.pincode?.trim() || null
          : existing.pincode,
        dto.remarks !== undefined
          ? dto.remarks?.trim() || null
          : existing.remarks,
        dto.isActive !== undefined ? Boolean(dto.isActive) : existing.isActive,
        user.userId,
        employeeId,
      ],
    );

    const updated = await this.findEmployeeById(employeeId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'EMPLOYEE_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_hr_employee',
      recordId: employeeId,
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

  async deleteEmployee(
    employeeId: number,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<{ deletedId: number }> {
    const existing = await this.findEmployeeById(employeeId);

    // Pre-Delete Dependency Verification
    await this.dependencyCheckService.verifyCanDelete({
      entity: 'EMPLOYEE',
      entityId: employeeId,
      relations: [
        {
          table: 'tbl_hr_employee',
          column: 'reporting_manager_id',
          label: 'Direct Report Employees',
        },
        {
          table: 'tbl_hr_department',
          column: 'hod_employee_id',
          label: 'Departments Assigned as HOD',
        },
        {
          table: 'tbl_sec_user',
          column: 'linked_entity_id',
          label: 'Linked ERP Security User Accounts',
        },
      ],
    });

    await this.pool.query(`DELETE FROM tbl_hr_employee WHERE employee_id = $1`, [
      employeeId,
    ]);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'EMPLOYEE_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_hr_employee',
      recordId: employeeId,
      oldValue: existing as unknown as Record<string, unknown>,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });

    return { deletedId: employeeId };
  }

  async recordScreenAction(
    actionType: 'PRINT' | 'EXPORT',
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ): Promise<void> {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'EMPLOYEE_MASTER',
      actionType,
      entityTable: 'tbl_hr_employee',
      recordId: 0,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      correlationId: meta.correlationId,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
    });
  }

  private mapEmployeeRow(r: any): EmployeeRecord {
    return {
      employeeId: Number(r.employee_id),
      compId: Number(r.comp_id),
      compCode: r.comp_code,
      compName: r.comp_name,
      branchId: Number(r.branch_id),
      empCode: r.emp_code,
      firstName: r.first_name,
      lastName: r.last_name || null,
      fullName: r.full_name,
      gender: r.gender,
      dateOfBirth: r.date_of_birth || null,
      dateOfJoining: r.date_of_joining,
      deptId: Number(r.dept_id),
      deptCode: r.dept_code,
      deptName: r.dept_name,
      desigId: Number(r.desig_id),
      desigCode: r.desig_code,
      desigName: r.desig_name,
      gradeCode: r.grade_code || null,
      primaryBranchId: Number(r.primary_branch_id),
      primaryBranchCode: r.primary_branch_code,
      primaryBranchName: r.primary_branch_name,
      reportingManagerId: r.reporting_manager_id
        ? Number(r.reporting_manager_id)
        : null,
      reportingManagerCode: r.reporting_manager_code || null,
      reportingManagerName: r.reporting_manager_name || null,
      employmentType: r.employment_type,
      employmentStatus: r.employment_status,
      workEmail: r.work_email || null,
      mobileNo: r.mobile_no,
      emergencyContactName: r.emergency_contact_name || null,
      emergencyContactPhone: r.emergency_contact_phone || null,
      bloodGroup: r.blood_group || null,
      panNo: r.pan_no || null,
      aadhaarMasked: r.aadhaar_masked || null,
      pfUanNo: r.pf_uan_no || null,
      esiNo: r.esi_no || null,
      bankName: r.bank_name || null,
      bankAccountNo: r.bank_account_no || null,
      bankIfscCode: r.bank_ifsc_code || null,
      addressLine1: r.address_line1 || null,
      city: r.city || null,
      stateName: r.state_name || null,
      pincode: r.pincode || null,
      remarks: r.remarks || null,
      directReportCount: Number(r.direct_report_count || 0),
      isActive: Boolean(r.is_active),
      createdDate: r.created_date,
      updatedDate: r.updated_date || null,
    };
  }
}
