import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../database/database.module';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { DependencyCheckService } from '../../../common/services/dependency-check.service';
import type {
  CreateShiftDto,
  CreateWorkCenterDto,
  UpdateMachineStatusDto,
  UpdateWorkCenterDto,
  WorkCenterFilterParams,
} from './work-center.dto';

@Injectable()
export class WorkCenterService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // --------------------------------------------------------------------------
  // KPI Summary
  // --------------------------------------------------------------------------
  async getWorkCenterSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const sql = `
      SELECT
        COUNT(DISTINCT wc.work_center_id)::INT AS total_work_centers,
        COUNT(DISTINCT CASE WHEN wc.status = 'ACTIVE' THEN wc.work_center_id END)::INT AS active_work_centers,
        COALESCE(SUM(CASE WHEN wc.status = 'ACTIVE' THEN wc.capacity_per_day_hours ELSE 0 END), 0)::FLOAT AS total_daily_capacity_hours,
        COALESCE(AVG(CASE WHEN wc.status = 'ACTIVE' THEN wc.efficiency_percent ELSE NULL END), 0)::FLOAT AS avg_efficiency_percent,
        (
          SELECT COUNT(*)::INT
          FROM tbl_mfg_work_center_machine m
          WHERE m.comp_id = $1 AND m.branch_id = $2 AND m.is_active = TRUE
        ) AS total_machines,
        (
          SELECT COUNT(*)::INT
          FROM tbl_mfg_work_center_machine m
          WHERE m.comp_id = $1 AND m.branch_id = $2 AND m.status = 'OPERATIONAL' AND m.is_active = TRUE
        ) AS operational_machines
      FROM tbl_mfg_work_center wc
      WHERE wc.comp_id = $1 AND wc.branch_id = $2 AND wc.is_active = TRUE;
    `;

    const res = await this.pool.query(sql, [compId, branchId]);
    const r = res.rows[0] || {};
    return {
      totalWorkCenters: Number(r.total_work_centers || 0),
      activeWorkCenters: Number(r.active_work_centers || 0),
      totalDailyCapacityHours: Number(r.total_daily_capacity_hours || 0),
      avgEfficiencyPercent: Math.round(Number(r.avg_efficiency_percent || 0) * 10) / 10,
      totalMachines: Number(r.total_machines || 0),
      operationalMachines: Number(r.operational_machines || 0),
    };
  }

  // --------------------------------------------------------------------------
  // Document Code Generation (WC-{TYPE_PREFIX}-{SEQ})
  // --------------------------------------------------------------------------
  private async generateWorkCenterCode(
    type: string,
    compId: number,
    branchId: number,
  ): Promise<string> {
    const prefixMap: Record<string, string> = {
      MACHINE: 'CNC',
      LINE_ASSEMBLY: 'ASSY',
      MANUAL: 'MAN',
      FURNACE: 'HT',
      TEST_BENCH: 'TST',
      SUBCONTRACTOR: 'SUB',
    };
    const prefix = prefixMap[type] || 'WC';

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::INT AS cnt FROM tbl_mfg_work_center WHERE comp_id = $1 AND branch_id = $2;`,
      [compId, branchId],
    );
    const seq = (countRes.rows[0]?.cnt || 0) + 1;
    const padded = String(seq).padStart(2, '0');
    return `WC-${prefix}-${padded}`;
  }

  // --------------------------------------------------------------------------
  // Find All Work Centers
  // --------------------------------------------------------------------------
  async findAllWorkCenters(
    filters: WorkCenterFilterParams,
    user: AuthenticatedUserContext,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const conditions: string[] = [
      `wc.comp_id = $1`,
      `wc.branch_id = $2`,
      `wc.is_active = TRUE`,
    ];
    const params: any[] = [compId, branchId];
    let idx = 3;

    if (filters.status) {
      conditions.push(`wc.status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.workCenterType) {
      conditions.push(`wc.work_center_type = $${idx++}`);
      params.push(filters.workCenterType);
    }
    if (filters.deptId) {
      conditions.push(`wc.dept_id = $${idx++}`);
      params.push(filters.deptId);
    }
    if (filters.search) {
      conditions.push(
        `(wc.work_center_code ILIKE $${idx} OR wc.work_center_name ILIKE $${idx} OR wc.location_desc ILIKE $${idx})`,
      );
      params.push(`%${filters.search}%`);
      idx++;
    }

    const sql = `
      SELECT
        wc.work_center_id,
        wc.comp_id,
        wc.branch_id,
        wc.fyear_id,
        wc.work_center_code,
        wc.work_center_name,
        wc.work_center_type,
        wc.dept_id,
        d.dept_code,
        d.dept_name,
        wc.location_desc,
        wc.capacity_per_day_hours::FLOAT AS capacity_per_day_hours,
        wc.efficiency_percent::FLOAT AS efficiency_percent,
        wc.capacity_uom,
        wc.cost_per_hour::FLOAT AS cost_per_hour,
        wc.labour_cost_per_hour::FLOAT AS labour_cost_per_hour,
        wc.overhead_cost_per_hour::FLOAT AS overhead_cost_per_hour,
        wc.total_hourly_rate::FLOAT AS total_hourly_rate,
        wc.status,
        wc.remarks,
        wc.created_date,
        COUNT(DISTINCT m.wc_machine_id)::INT AS machine_count,
        COUNT(DISTINCT CASE WHEN m.status = 'OPERATIONAL' THEN m.wc_machine_id END)::INT AS operational_machine_count,
        COUNT(DISTINCT s.wc_shift_id)::INT AS shift_count
      FROM tbl_mfg_work_center wc
      LEFT JOIN tbl_hr_department d ON wc.dept_id = d.dept_id
      LEFT JOIN tbl_mfg_work_center_machine m ON wc.work_center_id = m.work_center_id AND m.is_active = TRUE
      LEFT JOIN tbl_mfg_work_center_shift s ON wc.work_center_id = s.work_center_id AND s.is_active = TRUE
      WHERE ${conditions.join(' AND ')}
      GROUP BY
        wc.work_center_id,
        d.dept_code,
        d.dept_name
      ORDER BY wc.work_center_id ASC;
    `;

    const res = await this.pool.query(sql, params);
    return res.rows;
  }

  // --------------------------------------------------------------------------
  // Find One Work Center with Machines & Shifts
  // --------------------------------------------------------------------------
  async findOneWorkCenter(
    workCenterId: number,
    user: AuthenticatedUserContext,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const headSql = `
      SELECT
        wc.work_center_id,
        wc.comp_id,
        wc.branch_id,
        wc.fyear_id,
        wc.work_center_code,
        wc.work_center_name,
        wc.work_center_type,
        wc.dept_id,
        d.dept_code,
        d.dept_name,
        wc.location_desc,
        wc.capacity_per_day_hours::FLOAT AS capacity_per_day_hours,
        wc.efficiency_percent::FLOAT AS efficiency_percent,
        wc.capacity_uom,
        wc.cost_per_hour::FLOAT AS cost_per_hour,
        wc.labour_cost_per_hour::FLOAT AS labour_cost_per_hour,
        wc.overhead_cost_per_hour::FLOAT AS overhead_cost_per_hour,
        wc.total_hourly_rate::FLOAT AS total_hourly_rate,
        wc.status,
        wc.remarks,
        wc.created_date,
        wc.created_by,
        u.full_name AS created_by_name
      FROM tbl_mfg_work_center wc
      LEFT JOIN tbl_hr_department d ON wc.dept_id = d.dept_id
      LEFT JOIN tbl_sec_user u ON wc.created_by = u.user_id
      WHERE wc.work_center_id = $1 AND wc.comp_id = $2 AND wc.branch_id = $3 AND wc.is_active = TRUE;
    `;

    const headRes = await this.pool.query(headSql, [workCenterId, compId, branchId]);
    if (headRes.rows.length === 0) {
      throw new NotFoundException(`Work Center #${workCenterId} not found.`);
    }
    const wc = headRes.rows[0];

    // Machines
    const machineSql = `
      SELECT
        m.wc_machine_id,
        m.work_center_id,
        m.machine_code,
        m.machine_name,
        m.model_no,
        m.serial_no,
        m.manufacturer,
        m.installation_date,
        m.warranty_expiry_date,
        m.power_rating_kw::FLOAT AS power_rating_kw,
        m.status,
        m.last_maintenance_date,
        m.next_maintenance_due,
        m.remarks
      FROM tbl_mfg_work_center_machine m
      WHERE m.work_center_id = $1 AND m.is_active = TRUE
      ORDER BY m.wc_machine_id ASC;
    `;
    const machineRes = await this.pool.query(machineSql, [workCenterId]);

    // Shifts
    const shiftSql = `
      SELECT
        wcs.wc_shift_id,
        wcs.work_center_id,
        wcs.shift_id,
        s.shift_code,
        s.shift_name,
        s.start_time,
        s.end_time,
        s.break_duration_mins,
        s.effective_working_hours::FLOAT AS effective_working_hours,
        s.is_night_shift,
        wcs.days_of_week,
        wcs.operator_count,
        wcs.remarks
      FROM tbl_mfg_work_center_shift wcs
      JOIN tbl_mfg_shift s ON wcs.shift_id = s.shift_id
      WHERE wcs.work_center_id = $1 AND wcs.is_active = TRUE
      ORDER BY s.start_time ASC;
    `;
    const shiftRes = await this.pool.query(shiftSql, [workCenterId]);

    return {
      ...wc,
      machines: machineRes.rows,
      shifts: shiftRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // Create Work Center
  // --------------------------------------------------------------------------
  async createWorkCenter(
    dto: CreateWorkCenterDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const wcType = dto.workCenterType || 'MACHINE';
    const code =
      dto.workCenterCode?.trim() ||
      (await this.generateWorkCenterCode(wcType, compId, branchId));

    // Unique code check
    const checkRes = await this.pool.query(
      `SELECT work_center_id FROM tbl_mfg_work_center WHERE comp_id = $1 AND branch_id = $2 AND work_center_code = $3;`,
      [compId, branchId, code],
    );
    if (checkRes.rows.length > 0) {
      throw new ConflictException(`Work Center Code ${code} already exists in this plant.`);
    }

    const costPerHour = Number(dto.costPerHour || 0);
    const labourCostPerHour = Number(dto.labourCostPerHour || 0);
    const overheadCostPerHour = Number(dto.overheadCostPerHour || 0);
    const totalHourlyRate =
      Math.round((costPerHour + labourCostPerHour + overheadCostPerHour) * 100) / 100;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const insertWcSql = `
        INSERT INTO tbl_mfg_work_center (
          comp_id, branch_id, fyear_id, work_center_code, work_center_name,
          work_center_type, dept_id, location_desc, capacity_per_day_hours,
          efficiency_percent, capacity_uom, cost_per_hour, labour_cost_per_hour,
          overhead_cost_per_hour, total_hourly_rate, status, remarks,
          created_by, created_date
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17,
          $18, CURRENT_TIMESTAMP
        ) RETURNING work_center_id;
      `;

      const wcRes = await client.query(insertWcSql, [
        compId,
        branchId,
        fyearId,
        code,
        dto.workCenterName.trim(),
        wcType,
        dto.deptId || null,
        dto.locationDesc?.trim() || null,
        Number(dto.capacityPerDayHours || 8.0),
        Number(dto.efficiencyPercent || 85.0),
        dto.capacityUom || 'HOURS',
        costPerHour,
        labourCostPerHour,
        overheadCostPerHour,
        totalHourlyRate,
        dto.status || 'ACTIVE',
        dto.remarks?.trim() || null,
        userId,
      ]);

      const workCenterId = wcRes.rows[0].work_center_id;

      // Insert Machines
      if (dto.machines && dto.machines.length > 0) {
        for (let i = 0; i < dto.machines.length; i++) {
          const m = dto.machines[i];
          const mCode = m.machineCode?.trim() || `MCH-${code}-${String(i + 1).padStart(2, '0')}`;
          await client.query(
            `INSERT INTO tbl_mfg_work_center_machine (
              work_center_id, machine_code, machine_name, model_no, serial_no,
              manufacturer, installation_date, warranty_expiry_date, power_rating_kw,
              status, last_maintenance_date, next_maintenance_due, remarks,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9,
              $10, $11, $12, $13,
              $14, $15, $16, $17
            );`,
            [
              workCenterId,
              mCode,
              m.machineName.trim(),
              m.modelNo?.trim() || null,
              m.serialNo?.trim() || null,
              m.manufacturer?.trim() || null,
              m.installationDate || null,
              m.warrantyExpiryDate || null,
              Number(m.powerRatingKw || 0),
              m.status || 'OPERATIONAL',
              m.lastMaintenanceDate || null,
              m.nextMaintenanceDue || null,
              m.remarks?.trim() || null,
              compId,
              branchId,
              fyearId,
              userId,
            ],
          );
        }
      }

      // Insert Shift links
      if (dto.shifts && dto.shifts.length > 0) {
        for (const s of dto.shifts) {
          await client.query(
            `INSERT INTO tbl_mfg_work_center_shift (
              work_center_id, shift_id, days_of_week, operator_count, remarks,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9
            ) ON CONFLICT (work_center_id, shift_id) DO NOTHING;`,
            [
              workCenterId,
              s.shiftId,
              s.daysOfWeek || 'MON,TUE,WED,THU,FRI,SAT',
              s.operatorCount || 1,
              s.remarks?.trim() || null,
              compId,
              branchId,
              fyearId,
              userId,
            ],
          );
        }
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'MFG_WORK_CENTER',
        actionType: 'CREATE',
        entityTable: 'tbl_mfg_work_center',
        recordId: workCenterId,
        newValue: dto,
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findOneWorkCenter(workCenterId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Update Work Center
  // --------------------------------------------------------------------------
  async updateWorkCenter(
    workCenterId: number,
    dto: UpdateWorkCenterDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const current = await this.findOneWorkCenter(workCenterId, user);

    const costPerHour =
      dto.costPerHour !== undefined ? Number(dto.costPerHour) : Number(current.cost_per_hour);
    const labourCostPerHour =
      dto.labourCostPerHour !== undefined
        ? Number(dto.labourCostPerHour)
        : Number(current.labour_cost_per_hour);
    const overheadCostPerHour =
      dto.overheadCostPerHour !== undefined
        ? Number(dto.overheadCostPerHour)
        : Number(current.overhead_cost_per_hour);
    const totalHourlyRate =
      Math.round((costPerHour + labourCostPerHour + overheadCostPerHour) * 100) / 100;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const updateSql = `
        UPDATE tbl_mfg_work_center SET
          work_center_name = COALESCE($1, work_center_name),
          work_center_type = COALESCE($2, work_center_type),
          dept_id = COALESCE($3, dept_id),
          location_desc = COALESCE($4, location_desc),
          capacity_per_day_hours = COALESCE($5, capacity_per_day_hours),
          efficiency_percent = COALESCE($6, efficiency_percent),
          capacity_uom = COALESCE($7, capacity_uom),
          cost_per_hour = $8,
          labour_cost_per_hour = $9,
          overhead_cost_per_hour = $10,
          total_hourly_rate = $11,
          status = COALESCE($12, status),
          remarks = COALESCE($13, remarks),
          updated_by = $14,
          updated_date = CURRENT_TIMESTAMP
        WHERE work_center_id = $15 AND comp_id = $16 AND branch_id = $17;
      `;

      await client.query(updateSql, [
        dto.workCenterName?.trim() || null,
        dto.workCenterType || null,
        dto.deptId ?? null,
        dto.locationDesc?.trim() || null,
        dto.capacityPerDayHours !== undefined ? Number(dto.capacityPerDayHours) : null,
        dto.efficiencyPercent !== undefined ? Number(dto.efficiencyPercent) : null,
        dto.capacityUom || null,
        costPerHour,
        labourCostPerHour,
        overheadCostPerHour,
        totalHourlyRate,
        dto.status || null,
        dto.remarks?.trim() || null,
        userId,
        workCenterId,
        compId,
        branchId,
      ]);

      // Reconcile Machines if passed
      if (dto.machines !== undefined) {
        await client.query(
          `DELETE FROM tbl_mfg_work_center_machine WHERE work_center_id = $1;`,
          [workCenterId],
        );
        for (let i = 0; i < dto.machines.length; i++) {
          const m = dto.machines[i];
          const mCode =
            m.machineCode?.trim() ||
            `MCH-${current.work_center_code}-${String(i + 1).padStart(2, '0')}`;
          await client.query(
            `INSERT INTO tbl_mfg_work_center_machine (
              work_center_id, machine_code, machine_name, model_no, serial_no,
              manufacturer, installation_date, warranty_expiry_date, power_rating_kw,
              status, last_maintenance_date, next_maintenance_due, remarks,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9,
              $10, $11, $12, $13,
              $14, $15, $16, $17
            );`,
            [
              workCenterId,
              mCode,
              m.machineName.trim(),
              m.modelNo?.trim() || null,
              m.serialNo?.trim() || null,
              m.manufacturer?.trim() || null,
              m.installationDate || null,
              m.warrantyExpiryDate || null,
              Number(m.powerRatingKw || 0),
              m.status || 'OPERATIONAL',
              m.lastMaintenanceDate || null,
              m.nextMaintenanceDue || null,
              m.remarks?.trim() || null,
              compId,
              branchId,
              fyearId,
              userId,
            ],
          );
        }
      }

      // Reconcile Shifts if passed
      if (dto.shifts !== undefined) {
        await client.query(
          `DELETE FROM tbl_mfg_work_center_shift WHERE work_center_id = $1;`,
          [workCenterId],
        );
        for (const s of dto.shifts) {
          await client.query(
            `INSERT INTO tbl_mfg_work_center_shift (
              work_center_id, shift_id, days_of_week, operator_count, remarks,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9
            ) ON CONFLICT (work_center_id, shift_id) DO NOTHING;`,
            [
              workCenterId,
              s.shiftId,
              s.daysOfWeek || 'MON,TUE,WED,THU,FRI,SAT',
              s.operatorCount || 1,
              s.remarks?.trim() || null,
              compId,
              branchId,
              fyearId,
              userId,
            ],
          );
        }
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'MFG_WORK_CENTER',
        actionType: 'UPDATE',
        entityTable: 'tbl_mfg_work_center',
        recordId: workCenterId,
        oldValue: current,
        newValue: dto,
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findOneWorkCenter(workCenterId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Update Machine Maintenance & Status Log (MAINTENANCE)
  // --------------------------------------------------------------------------
  async updateMachineStatus(
    workCenterId: number,
    machineId: number,
    dto: UpdateMachineStatusDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const mRes = await this.pool.query(
      `SELECT wc_machine_id, machine_code, machine_name, status
       FROM tbl_mfg_work_center_machine
       WHERE wc_machine_id = $1 AND work_center_id = $2 AND comp_id = $3 AND is_active = TRUE;`,
      [machineId, workCenterId, compId],
    );
    if (mRes.rows.length === 0) {
      throw new NotFoundException(`Machine #${machineId} not found in Work Center #${workCenterId}.`);
    }
    const current = mRes.rows[0];

    await this.pool.query(
      `UPDATE tbl_mfg_work_center_machine SET
        status = $1,
        last_maintenance_date = COALESCE($2, last_maintenance_date),
        next_maintenance_due = COALESCE($3, next_maintenance_due),
        remarks = COALESCE($4, remarks),
        updated_by = $5,
        updated_date = CURRENT_TIMESTAMP
       WHERE wc_machine_id = $6 AND work_center_id = $7;`,
      [
        dto.status,
        dto.lastMaintenanceDate || null,
        dto.nextMaintenanceDue || null,
        dto.remarks || null,
        userId,
        machineId,
        workCenterId,
      ],
    );

    // If all machines in work center are BREAKDOWN, optionally tag work center as UNDER_MAINTENANCE
    if (dto.status === 'BREAKDOWN') {
      const opCountRes = await this.pool.query(
        `SELECT COUNT(*)::INT AS op_cnt
         FROM tbl_mfg_work_center_machine
         WHERE work_center_id = $1 AND status = 'OPERATIONAL' AND is_active = TRUE;`,
        [workCenterId],
      );
      if (Number(opCountRes.rows[0]?.op_cnt || 0) === 0) {
        await this.pool.query(
          `UPDATE tbl_mfg_work_center SET status = 'UNDER_MAINTENANCE', updated_by = $1, updated_date = CURRENT_TIMESTAMP WHERE work_center_id = $2;`,
          [userId, workCenterId],
        );
      }
    } else if (dto.status === 'OPERATIONAL') {
      await this.pool.query(
        `UPDATE tbl_mfg_work_center SET status = 'ACTIVE', updated_by = $1, updated_date = CURRENT_TIMESTAMP WHERE work_center_id = $2 AND status = 'UNDER_MAINTENANCE';`,
        [userId, workCenterId],
      );
    }

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'MFG_WORK_CENTER',
      actionType: 'MAINTENANCE',
      entityTable: 'tbl_mfg_work_center_machine',
      recordId: machineId,
      oldValue: { status: current.status },
      newValue: dto,
      compId,
      branchId,
      fyearId,
      ...meta,
    });

    return this.findOneWorkCenter(workCenterId, user);
  }

  // --------------------------------------------------------------------------
  // Delete Work Center
  // --------------------------------------------------------------------------
  async deleteWorkCenter(
    workCenterId: number,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const res = await this.pool.query(
      `SELECT work_center_id, work_center_code, status
       FROM tbl_mfg_work_center
       WHERE work_center_id = $1 AND comp_id = $2 AND branch_id = $3 AND is_active = TRUE;`,
      [workCenterId, compId, branchId],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`Work Center #${workCenterId} not found.`);
    }
    const current = res.rows[0];

    // Pre-deletion checks
    await this.dependencyCheckService.verifyCanDelete({
      entity: 'Work Center',
      entityId: workCenterId,
      relations: [],
    });

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM tbl_mfg_work_center_shift WHERE work_center_id = $1;`,
        [workCenterId],
      );
      await client.query(
        `DELETE FROM tbl_mfg_work_center_machine WHERE work_center_id = $1;`,
        [workCenterId],
      );
      await client.query(
        `DELETE FROM tbl_mfg_work_center WHERE work_center_id = $1;`,
        [workCenterId],
      );
      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'MFG_WORK_CENTER',
        actionType: 'DELETE',
        entityTable: 'tbl_mfg_work_center',
        recordId: workCenterId,
        oldValue: current,
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return {
        success: true,
        message: `Work Center ${current.work_center_code} deleted successfully.`,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Sourcing Lookups (Shifts & Departments)
  // --------------------------------------------------------------------------
  async getShifts(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const sql = `
      SELECT
        shift_id,
        shift_code,
        shift_name,
        start_time,
        end_time,
        break_duration_mins,
        effective_working_hours::FLOAT AS effective_working_hours,
        is_night_shift,
        remarks
      FROM tbl_mfg_shift
      WHERE comp_id = $1 AND branch_id = $2 AND is_active = TRUE
      ORDER BY start_time ASC;
    `;
    const res = await this.pool.query(sql, [compId, branchId]);
    return res.rows;
  }

  async createShift(
    dto: CreateShiftDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const code = dto.shiftCode.trim().toUpperCase();

    const check = await this.pool.query(
      `SELECT shift_id FROM tbl_mfg_shift WHERE comp_id = $1 AND branch_id = $2 AND shift_code = $3;`,
      [compId, branchId, code],
    );
    if (check.rows.length > 0) {
      throw new ConflictException(`Shift code ${code} already exists.`);
    }

    const insertSql = `
      INSERT INTO tbl_mfg_shift (
        comp_id, branch_id, fyear_id, shift_code, shift_name,
        start_time, end_time, break_duration_mins, effective_working_hours,
        is_night_shift, remarks, created_by, created_date
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, CURRENT_TIMESTAMP
      ) RETURNING shift_id;
    `;

    const res = await this.pool.query(insertSql, [
      compId,
      branchId,
      fyearId,
      code,
      dto.shiftName.trim(),
      dto.startTime,
      dto.endTime,
      dto.breakDurationMins || 30,
      Number(dto.effectiveWorkingHours || 8.0),
      Boolean(dto.isNightShift),
      dto.remarks?.trim() || null,
      userId,
    ]);

    const shiftId = res.rows[0].shift_id;

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'MFG_WORK_CENTER',
      actionType: 'CREATE',
      entityTable: 'tbl_mfg_shift',
      recordId: shiftId,
      newValue: dto,
      compId,
      branchId,
      fyearId,
      ...meta,
    });

    return {
      shiftId,
      ...dto,
    };
  }

  async getDepartments(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const sql = `
      SELECT dept_id, dept_code, dept_name, dept_category
      FROM tbl_hr_department
      WHERE comp_id = $1 AND is_active = TRUE
      ORDER BY dept_name ASC;
    `;
    const res = await this.pool.query(sql, [compId]);
    return res.rows;
  }
}
