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
  ApproveRoutingDto,
  CloneRoutingDto,
  CreateRoutingDto,
  CreateRoutingOperationDto,
  RoutingFilterParams,
  UpdateRoutingDto,
} from './routing.dto';

@Injectable()
export class RoutingService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // --------------------------------------------------------------------------
  // KPI Summary
  // --------------------------------------------------------------------------
  async getRoutingSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const sql = `
      SELECT
        COUNT(*)::INT AS total_routings,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::INT AS active_routings,
        COUNT(DISTINCT item_id)::INT AS distinct_items,
        COALESCE(AVG(CASE WHEN status = 'ACTIVE' THEN total_run_time_mins ELSE NULL END), 0)::FLOAT AS avg_cycle_time_mins,
        COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN total_cost_per_unit ELSE 0 END), 0)::FLOAT AS total_routing_cost
      FROM tbl_mfg_routing_header
      WHERE comp_id = $1 AND is_active = TRUE
        AND ($2::BIGINT IS NULL OR branch_id = $2::BIGINT);
    `;

    const res = await this.pool.query(sql, [compId, branchId]);
    const r = res.rows[0] || {};
    return {
      totalRoutings: Number(r.total_routings || 0),
      activeRoutings: Number(r.active_routings || 0),
      distinctItems: Number(r.distinct_items || 0),
      avgCycleTimeMins: Math.round(Number(r.avg_cycle_time_mins || 0) * 100) / 100,
      totalRoutingCost: Math.round(Number(r.total_routing_cost || 0) * 100) / 100,
    };
  }

  // --------------------------------------------------------------------------
  // Auto Document Code Generation
  // --------------------------------------------------------------------------
  private async generateRoutingCode(
    itemId: number,
    versionNo: string,
    compId: number,
  ): Promise<string> {
    const itRes = await this.pool.query(
      `SELECT item_code FROM tbl_inv_item WHERE item_id = $1 AND comp_id = $2;`,
      [itemId, compId],
    );
    const itemCode = itRes.rows[0]?.item_code || `ITM${itemId}`;
    const cleanVer = (versionNo || '1.0').replace(/[^0-9.]/g, '');
    return `ROUT-${itemCode}-V${cleanVer}`;
  }

  // --------------------------------------------------------------------------
  // Find All (Paginated & Filtered)
  // --------------------------------------------------------------------------
  async findAll(params: RoutingFilterParams, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['h.comp_id = $1', 'h.is_active = TRUE'];
    const values: any[] = [compId];
    let paramIndex = 2;

    if (branchId) {
      conditions.push(`h.branch_id = $${paramIndex}`);
      values.push(branchId);
      paramIndex++;
    }

    if (params.search) {
      conditions.push(
        `(h.routing_code ILIKE $${paramIndex} OR h.routing_name ILIKE $${paramIndex} OR i.item_code ILIKE $${paramIndex} OR i.item_name ILIKE $${paramIndex})`,
      );
      values.push(`%${params.search}%`);
      paramIndex++;
    }

    if (params.status) {
      conditions.push(`h.status = $${paramIndex}`);
      values.push(params.status);
      paramIndex++;
    }

    if (params.itemId) {
      conditions.push(`h.item_id = $${paramIndex}`);
      values.push(params.itemId);
      paramIndex++;
    }

    if (params.isDefault !== undefined) {
      conditions.push(`h.is_default = $${paramIndex}`);
      values.push(params.isDefault);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `
      SELECT COUNT(*)::INT AS total
      FROM tbl_mfg_routing_header h
      JOIN tbl_inv_item i ON h.item_id = i.item_id
      WHERE ${whereClause};
    `;

    const countRes = await this.pool.query(countSql, values);
    const total = Number(countRes.rows[0]?.total || 0);

    const dataSql = `
      SELECT
        h.routing_id,
        h.routing_code,
        h.routing_name,
        h.item_id,
        i.item_code,
        i.item_name,
        u.uom_code,
        h.version_no,
        h.status,
        h.is_default,
        h.effective_from,
        h.effective_to,
        h.batch_size::FLOAT AS batch_size,
        h.total_setup_time_mins::FLOAT AS total_setup_time_mins,
        h.total_run_time_mins::FLOAT AS total_run_time_mins,
        h.total_lead_time_days::FLOAT AS total_lead_time_days,
        h.total_machine_cost::FLOAT AS total_machine_cost,
        h.total_labor_cost::FLOAT AS total_labor_cost,
        h.total_overhead_cost::FLOAT AS total_overhead_cost,
        h.total_cost_per_unit::FLOAT AS total_cost_per_unit,
        h.approved_by,
        u_app.full_name AS approved_by_name,
        h.approved_date,
        h.approval_remarks,
        h.remarks,
        h.created_date,
        COUNT(o.routing_op_id)::INT AS operation_count
      FROM tbl_mfg_routing_header h
      JOIN tbl_inv_item i ON h.item_id = i.item_id
      LEFT JOIN tbl_inv_uom u ON i.uom_id = u.uom_id
      LEFT JOIN tbl_sec_user u_app ON h.approved_by = u_app.user_id
      LEFT JOIN tbl_mfg_routing_operation o ON h.routing_id = o.routing_id AND o.is_active = TRUE
      WHERE ${whereClause}
      GROUP BY h.routing_id, i.item_code, i.item_name, u.uom_code, u_app.full_name
      ORDER BY h.is_default DESC, h.routing_code ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    values.push(limit, offset);
    const dataRes = await this.pool.query(dataSql, values);

    return {
      data: dataRes.rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // --------------------------------------------------------------------------
  // Find One (With Operations Detail)
  // --------------------------------------------------------------------------
  async findOne(routingId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const headerSql = `
      SELECT
        h.routing_id,
        h.routing_code,
        h.routing_name,
        h.item_id,
        i.item_code,
        i.item_name,
        i.item_type,
        u.uom_code,
        u.uom_name,
        h.version_no,
        h.status,
        h.is_default,
        h.effective_from,
        h.effective_to,
        h.batch_size::FLOAT AS batch_size,
        h.total_setup_time_mins::FLOAT AS total_setup_time_mins,
        h.total_run_time_mins::FLOAT AS total_run_time_mins,
        h.total_lead_time_days::FLOAT AS total_lead_time_days,
        h.total_machine_cost::FLOAT AS total_machine_cost,
        h.total_labor_cost::FLOAT AS total_labor_cost,
        h.total_overhead_cost::FLOAT AS total_overhead_cost,
        h.total_cost_per_unit::FLOAT AS total_cost_per_unit,
        h.approved_by,
        u_app.full_name AS approved_by_name,
        h.approved_date,
        h.approval_remarks,
        h.remarks,
        h.comp_id,
        h.branch_id,
        h.created_by,
        h.created_date,
        h.updated_by,
        h.updated_date
      FROM tbl_mfg_routing_header h
      JOIN tbl_inv_item i ON h.item_id = i.item_id
      LEFT JOIN tbl_inv_uom u ON i.uom_id = u.uom_id
      LEFT JOIN tbl_sec_user u_app ON h.approved_by = u_app.user_id
      WHERE h.routing_id = $1 AND h.comp_id = $2 AND h.is_active = TRUE;
    `;

    const hRes = await this.pool.query(headerSql, [routingId, compId]);
    if (hRes.rows.length === 0) {
      throw new NotFoundException(`Routing with ID ${routingId} not found`);
    }

    const header = hRes.rows[0];

    const opSql = `
      SELECT
        o.routing_op_id,
        o.routing_id,
        o.op_sequence,
        o.op_code,
        o.op_name,
        o.work_center_id,
        wc.work_center_code,
        wc.work_center_name,
        wc.work_center_type,
        o.machine_id,
        m.machine_code,
        m.machine_name,
        o.setup_time_mins::FLOAT AS setup_time_mins,
        o.run_time_mins::FLOAT AS run_time_mins,
        o.overlap_percent::FLOAT AS overlap_percent,
        o.machine_hourly_rate::FLOAT AS machine_hourly_rate,
        o.labor_hourly_rate::FLOAT AS labor_hourly_rate,
        o.overhead_hourly_rate::FLOAT AS overhead_hourly_rate,
        o.total_hourly_rate::FLOAT AS total_hourly_rate,
        o.machine_cost_per_unit::FLOAT AS machine_cost_per_unit,
        o.labor_cost_per_unit::FLOAT AS labor_cost_per_unit,
        o.overhead_cost_per_unit::FLOAT AS overhead_cost_per_unit,
        o.total_cost_per_unit::FLOAT AS total_cost_per_unit,
        o.tooling_description,
        o.fixture_no,
        o.is_inspection_required,
        o.qc_checkpoints,
        o.is_subcontracted,
        o.subcontract_vendor_id,
        p.party_name AS subcontract_vendor_name,
        o.remarks
      FROM tbl_mfg_routing_operation o
      JOIN tbl_mfg_work_center wc ON o.work_center_id = wc.work_center_id
      LEFT JOIN tbl_mfg_work_center_machine m ON o.machine_id = m.wc_machine_id
      LEFT JOIN tbl_crm_party p ON o.subcontract_vendor_id = p.party_id
      WHERE o.routing_id = $1 AND o.is_active = TRUE
      ORDER BY o.op_sequence ASC;
    `;

    const opRes = await this.pool.query(opSql, [routingId]);

    return {
      ...header,
      operations: opRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // Cost & Lead Time Computation Helper
  // --------------------------------------------------------------------------
  private calculateOperationCosts(
    op: CreateRoutingOperationDto,
    batchSize: number,
    wcRates: { costPerHour: number; labourCostPerHour: number; overheadCostPerHour: number },
  ) {
    const effectiveBatch = batchSize > 0 ? batchSize : 1;
    const setupMins = Number(op.setupTimeMins || 0);
    const runMins = Number(op.runTimeMins || 0);

    // Amortized setup minutes per unit
    const amortizedSetupMins = setupMins / effectiveBatch;
    const totalOpMinsPerUnit = runMins + amortizedSetupMins;
    const totalOpHoursPerUnit = totalOpMinsPerUnit / 60.0;

    // Rates: prioritize DTO rate, fallback to Work Center master rates
    const machineRate = op.machineHourlyRate !== undefined && op.machineHourlyRate !== null
      ? Number(op.machineHourlyRate)
      : wcRates.costPerHour;
    const laborRate = op.laborHourlyRate !== undefined && op.laborHourlyRate !== null
      ? Number(op.laborHourlyRate)
      : wcRates.labourCostPerHour;
    const overheadRate = op.overheadHourlyRate !== undefined && op.overheadHourlyRate !== null
      ? Number(op.overheadHourlyRate)
      : wcRates.overheadCostPerHour;
    const totalRate = machineRate + laborRate + overheadRate;

    const machineCostPerUnit = Math.round(totalOpHoursPerUnit * machineRate * 10000) / 10000;
    const laborCostPerUnit = Math.round(totalOpHoursPerUnit * laborRate * 10000) / 10000;
    const overheadCostPerUnit = Math.round(totalOpHoursPerUnit * overheadRate * 10000) / 10000;
    const totalCostPerUnit = Math.round((machineCostPerUnit + laborCostPerUnit + overheadCostPerUnit) * 10000) / 10000;

    return {
      setupMins,
      runMins,
      machineRate,
      laborRate,
      overheadRate,
      totalRate,
      machineCostPerUnit,
      laborCostPerUnit,
      overheadCostPerUnit,
      totalCostPerUnit,
    };
  }

  // --------------------------------------------------------------------------
  // Create Routing & Operations
  // --------------------------------------------------------------------------
  async create(dto: CreateRoutingDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    if (!dto.operations || dto.operations.length === 0) {
      throw new BadRequestException('At least one routing operation is required');
    }

    const versionNo = dto.versionNo || '1.0';
    const routingCode = dto.routingCode?.trim() || (await this.generateRoutingCode(dto.itemId, versionNo, compId));
    const batchSize = Number(dto.batchSize || 1.0);

    // Verify uniqueness of routingCode
    const codeDup = await this.pool.query(
      `SELECT routing_id FROM tbl_mfg_routing_header WHERE comp_id = $1 AND routing_code = $2;`,
      [compId, routingCode],
    );
    if (codeDup.rows.length > 0) {
      throw new ConflictException(`Routing code '${routingCode}' already exists`);
    }

    // Verify uniqueness of (item_id, version_no)
    const verDup = await this.pool.query(
      `SELECT routing_id FROM tbl_mfg_routing_header WHERE comp_id = $1 AND item_id = $2 AND version_no = $3;`,
      [compId, dto.itemId, versionNo],
    );
    if (verDup.rows.length > 0) {
      throw new ConflictException(
        `Version '${versionNo}' already exists for item ID ${dto.itemId}`,
      );
    }

    // Fetch work centers for rate lookups
    const wcRes = await this.pool.query(
      `SELECT work_center_id, cost_per_hour, labour_cost_per_hour, overhead_cost_per_hour FROM tbl_mfg_work_center WHERE comp_id = $1;`,
      [compId],
    );
    const wcMap = new Map<number, { costPerHour: number; labourCostPerHour: number; overheadCostPerHour: number }>();
    wcRes.rows.forEach((r) => {
      wcMap.set(Number(r.work_center_id), {
        costPerHour: Number(r.cost_per_hour || 0),
        labourCostPerHour: Number(r.labour_cost_per_hour || 0),
        overheadCostPerHour: Number(r.overhead_cost_per_hour || 0),
      });
    });

    // Compute totals
    let totalSetupMins = 0;
    let totalRunMins = 0;
    let totalMachineCost = 0;
    let totalLaborCost = 0;
    let totalOverheadCost = 0;
    let totalCostPerUnit = 0;

    const computedOperations = dto.operations.map((op) => {
      const defaultRates = wcMap.get(Number(op.workCenterId)) || {
        costPerHour: 0,
        labourCostPerHour: 0,
        overheadCostPerHour: 0,
      };
      const c = this.calculateOperationCosts(op, batchSize, defaultRates);

      totalSetupMins += c.setupMins;
      totalRunMins += c.runMins;
      totalMachineCost += c.machineCostPerUnit;
      totalLaborCost += c.laborCostPerUnit;
      totalOverheadCost += c.overheadCostPerUnit;
      totalCostPerUnit += c.totalCostPerUnit;

      return {
        ...op,
        ...c,
      };
    });

    // Lead time days estimation: assume 8 hours/day shopfloor throughput + 20% buffer
    const totalWorkingMins = totalSetupMins + totalRunMins * batchSize;
    const totalLeadTimeDays = Math.max(0.5, Math.round(((totalWorkingMins / (8 * 60)) * 1.2) * 100) / 100);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const isDefault = dto.isDefault ?? true;
      if (isDefault) {
        await client.query(
          `UPDATE tbl_mfg_routing_header SET is_default = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP WHERE comp_id = $2 AND item_id = $3;`,
          [userId, compId, dto.itemId],
        );
      }

      const insertHeaderSql = `
        INSERT INTO tbl_mfg_routing_header (
          routing_code, routing_name, item_id, version_no, status,
          is_default, effective_from, effective_to, batch_size,
          total_setup_time_mins, total_run_time_mins, total_lead_time_days,
          total_machine_cost, total_labor_cost, total_overhead_cost, total_cost_per_unit,
          remarks, is_active, comp_id, branch_id, created_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, COALESCE($7::DATE, CURRENT_DATE), $8::DATE, $9,
          $10, $11, $12,
          $13, $14, $15, $16,
          $17, TRUE, $18, $19, $20
        ) RETURNING routing_id;
      `;

      const headerRes = await client.query(insertHeaderSql, [
        routingCode,
        dto.routingName,
        dto.itemId,
        versionNo,
        dto.status || 'DRAFT',
        isDefault,
        dto.effectiveFrom || null,
        dto.effectiveTo || null,
        batchSize,
        Math.round(totalSetupMins * 100) / 100,
        Math.round(totalRunMins * 100) / 100,
        totalLeadTimeDays,
        Math.round(totalMachineCost * 100) / 100,
        Math.round(totalLaborCost * 100) / 100,
        Math.round(totalOverheadCost * 100) / 100,
        Math.round(totalCostPerUnit * 10000) / 10000,
        dto.remarks || null,
        compId,
        branchId,
        userId,
      ]);

      const routingId = Number(headerRes.rows[0].routing_id);

      // Insert operations
      const insertOpSql = `
        INSERT INTO tbl_mfg_routing_operation (
          routing_id, op_sequence, op_code, op_name,
          work_center_id, machine_id, setup_time_mins, run_time_mins, overlap_percent,
          machine_hourly_rate, labor_hourly_rate, overhead_hourly_rate, total_hourly_rate,
          machine_cost_per_unit, labor_cost_per_unit, overhead_cost_per_unit, total_cost_per_unit,
          tooling_description, fixture_no, is_inspection_required, qc_checkpoints,
          is_subcontracted, subcontract_vendor_id, remarks, is_active,
          comp_id, branch_id, created_by
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17,
          $18, $19, $20, $21,
          $22, $23, $24, TRUE,
          $25, $26, $27
        );
      `;

      for (const op of computedOperations) {
        await client.query(insertOpSql, [
          routingId,
          op.opSequence,
          op.opCode,
          op.opName,
          op.workCenterId,
          op.machineId || null,
          op.setupMins,
          op.runMins,
          op.overlapPercent || 0,
          op.machineRate,
          op.laborRate,
          op.overheadRate,
          op.totalRate,
          op.machineCostPerUnit,
          op.laborCostPerUnit,
          op.overheadCostPerUnit,
          op.totalCostPerUnit,
          op.toolingDescription || null,
          op.fixtureNo || null,
          op.isInspectionRequired ?? false,
          op.qcCheckpoints || null,
          op.isSubcontracted ?? false,
          op.subcontractVendorId || null,
          op.remarks || null,
          compId,
          branchId,
          userId,
        ]);
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'MFG_ROUTING',
        actionType: 'ADD',
        entityTable: 'tbl_mfg_routing_header',
        recordId: routingId,
        newValue: dto,
        compId,
        branchId,
      });

      return this.findOne(routingId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Update Routing & Operations
  // --------------------------------------------------------------------------
  async update(routingId: number, dto: UpdateRoutingDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    const existing = await this.findOne(routingId, user);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const batchSize = Number(dto.batchSize ?? existing.batch_size);

      // If version changed, verify uniqueness
      if (dto.versionNo && dto.versionNo !== existing.version_no) {
        const verDup = await client.query(
          `SELECT routing_id FROM tbl_mfg_routing_header WHERE comp_id = $1 AND item_id = $2 AND version_no = $3 AND routing_id <> $4;`,
          [compId, existing.item_id, dto.versionNo, routingId],
        );
        if (verDup.rows.length > 0) {
          throw new ConflictException(
            `Version '${dto.versionNo}' already exists for item ID ${existing.item_id}`,
          );
        }
      }

      // If isDefault set to true, reset others
      if (dto.isDefault === true) {
        await client.query(
          `UPDATE tbl_mfg_routing_header SET is_default = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP WHERE comp_id = $2 AND item_id = $3 AND routing_id <> $4;`,
          [userId, compId, existing.item_id, routingId],
        );
      }

      // If operations array is supplied, replace operations and recalculate costs
      if (dto.operations && dto.operations.length > 0) {
        // Fetch work centers for rate lookups
        const wcRes = await client.query(
          `SELECT work_center_id, cost_per_hour, labour_cost_per_hour, overhead_cost_per_hour FROM tbl_mfg_work_center WHERE comp_id = $1;`,
          [compId],
        );
        const wcMap = new Map<number, { costPerHour: number; labourCostPerHour: number; overheadCostPerHour: number }>();
        wcRes.rows.forEach((r) => {
          wcMap.set(Number(r.work_center_id), {
            costPerHour: Number(r.cost_per_hour || 0),
            labourCostPerHour: Number(r.labour_cost_per_hour || 0),
            overheadCostPerHour: Number(r.overhead_cost_per_hour || 0),
          });
        });

        let totalSetupMins = 0;
        let totalRunMins = 0;
        let totalMachineCost = 0;
        let totalLaborCost = 0;
        let totalOverheadCost = 0;
        let totalCostPerUnit = 0;

        const computedOperations = dto.operations.map((op) => {
          const defaultRates = wcMap.get(Number(op.workCenterId)) || {
            costPerHour: 0,
            labourCostPerHour: 0,
            overheadCostPerHour: 0,
          };
          const c = this.calculateOperationCosts(op, batchSize, defaultRates);

          totalSetupMins += c.setupMins;
          totalRunMins += c.runMins;
          totalMachineCost += c.machineCostPerUnit;
          totalLaborCost += c.laborCostPerUnit;
          totalOverheadCost += c.overheadCostPerUnit;
          totalCostPerUnit += c.totalCostPerUnit;

          return { ...op, ...c };
        });

        const totalWorkingMins = totalSetupMins + totalRunMins * batchSize;
        const totalLeadTimeDays = Math.max(0.5, Math.round(((totalWorkingMins / (8 * 60)) * 1.2) * 100) / 100);

        // Delete old operations
        await client.query(
          `DELETE FROM tbl_mfg_routing_operation WHERE routing_id = $1;`,
          [routingId],
        );

        // Insert new operations
        const insertOpSql = `
          INSERT INTO tbl_mfg_routing_operation (
            routing_id, op_sequence, op_code, op_name,
            work_center_id, machine_id, setup_time_mins, run_time_mins, overlap_percent,
            machine_hourly_rate, labor_hourly_rate, overhead_hourly_rate, total_hourly_rate,
            machine_cost_per_unit, labor_cost_per_unit, overhead_cost_per_unit, total_cost_per_unit,
            tooling_description, fixture_no, is_inspection_required, qc_checkpoints,
            is_subcontracted, subcontract_vendor_id, remarks, is_active,
            comp_id, branch_id, created_by
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16, $17,
            $18, $19, $20, $21,
            $22, $23, $24, TRUE,
            $25, $26, $27
          );
        `;

        for (const op of computedOperations) {
          await client.query(insertOpSql, [
            routingId,
            op.opSequence,
            op.opCode,
            op.opName,
            op.workCenterId,
            op.machineId || null,
            op.setupMins,
            op.runMins,
            op.overlapPercent || 0,
            op.machineRate,
            op.laborRate,
            op.overheadRate,
            op.totalRate,
            op.machineCostPerUnit,
            op.laborCostPerUnit,
            op.overheadCostPerUnit,
            op.totalCostPerUnit,
            op.toolingDescription || null,
            op.fixtureNo || null,
            op.isInspectionRequired ?? false,
            op.qcCheckpoints || null,
            op.isSubcontracted ?? false,
            op.subcontractVendorId || null,
            op.remarks || null,
            compId,
            branchId,
            userId,
          ]);
        }

        // Update header with new totals
        const updateHeaderSql = `
          UPDATE tbl_mfg_routing_header SET
            routing_name = COALESCE($1, routing_name),
            version_no = COALESCE($2, version_no),
            status = COALESCE($3, status),
            is_default = COALESCE($4, is_default),
            effective_from = COALESCE($5::DATE, effective_from),
            effective_to = $6::DATE,
            batch_size = $7,
            total_setup_time_mins = $8,
            total_run_time_mins = $9,
            total_lead_time_days = $10,
            total_machine_cost = $11,
            total_labor_cost = $12,
            total_overhead_cost = $13,
            total_cost_per_unit = $14,
            remarks = COALESCE($15, remarks),
            updated_by = $16,
            updated_date = CURRENT_TIMESTAMP
          WHERE routing_id = $17 AND comp_id = $18;
        `;

        await client.query(updateHeaderSql, [
          dto.routingName ?? null,
          dto.versionNo ?? null,
          dto.status ?? null,
          dto.isDefault ?? null,
          dto.effectiveFrom ?? null,
          dto.effectiveTo ?? null,
          batchSize,
          Math.round(totalSetupMins * 100) / 100,
          Math.round(totalRunMins * 100) / 100,
          totalLeadTimeDays,
          Math.round(totalMachineCost * 100) / 100,
          Math.round(totalLaborCost * 100) / 100,
          Math.round(totalOverheadCost * 100) / 100,
          Math.round(totalCostPerUnit * 10000) / 10000,
          dto.remarks ?? null,
          userId,
          routingId,
          compId,
        ]);
      } else {
        // Only header fields updated
        const updateHeaderOnlySql = `
          UPDATE tbl_mfg_routing_header SET
            routing_name = COALESCE($1, routing_name),
            version_no = COALESCE($2, version_no),
            status = COALESCE($3, status),
            is_default = COALESCE($4, is_default),
            effective_from = COALESCE($5::DATE, effective_from),
            effective_to = $6::DATE,
            batch_size = COALESCE($7, batch_size),
            remarks = COALESCE($8, remarks),
            updated_by = $9,
            updated_date = CURRENT_TIMESTAMP
          WHERE routing_id = $10 AND comp_id = $11;
        `;

        await client.query(updateHeaderOnlySql, [
          dto.routingName ?? null,
          dto.versionNo ?? null,
          dto.status ?? null,
          dto.isDefault ?? null,
          dto.effectiveFrom ?? null,
          dto.effectiveTo ?? null,
          dto.batchSize ?? null,
          dto.remarks ?? null,
          userId,
          routingId,
          compId,
        ]);
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'MFG_ROUTING',
        actionType: 'EDIT',
        entityTable: 'tbl_mfg_routing_header',
        recordId: routingId,
        oldValue: existing,
        newValue: dto,
        compId,
        branchId,
      });

      return this.findOne(routingId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Delete Routing
  // --------------------------------------------------------------------------
  async delete(routingId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const existing = await this.findOne(routingId, user);

    // Dependency check: Is this routing assigned to active BOMs?
    const bomCheck = await this.pool.query(
      `SELECT bom_id, bom_code FROM tbl_mfg_bom_header WHERE routing_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [routingId, compId],
    );
    if (bomCheck.rows.length > 0) {
      const boms = bomCheck.rows.map((b) => b.bom_code).join(', ');
      throw new BadRequestException(
        `Cannot delete routing '${existing.routing_code}' as it is currently linked to Bill of Materials: ${boms}`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Soft delete operations and header
      await client.query(
        `UPDATE tbl_mfg_routing_operation SET is_active = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP WHERE routing_id = $2;`,
        [user.userId || 1001, routingId],
      );

      await client.query(
        `UPDATE tbl_mfg_routing_header SET is_active = FALSE, status = 'OBSOLETE', updated_by = $1, updated_date = CURRENT_TIMESTAMP WHERE routing_id = $2 AND comp_id = $3;`,
        [user.userId || 1001, routingId, compId],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId: user.userId || 1001,
        username: user.username,
        screenCode: 'MFG_ROUTING',
        actionType: 'DELETE',
        entityTable: 'tbl_mfg_routing_header',
        recordId: routingId,
        oldValue: existing,
        compId,
        branchId: user.branchId || 1001,
      });

      return {
        success: true,
        message: `Routing '${existing.routing_code}' successfully deleted`,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Approve Routing
  // --------------------------------------------------------------------------
  async approveRouting(routingId: number, dto: ApproveRoutingDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;
    const existing = await this.findOne(routingId, user);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const setAsDefault = dto.setAsDefault ?? true;
      if (setAsDefault) {
        await client.query(
          `UPDATE tbl_mfg_routing_header SET is_default = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP WHERE comp_id = $2 AND item_id = $3 AND routing_id <> $4;`,
          [userId, compId, existing.item_id, routingId],
        );
      }

      await client.query(
        `UPDATE tbl_mfg_routing_header SET
          status = 'ACTIVE',
          is_default = $1,
          approved_by = $2,
          approved_date = CURRENT_TIMESTAMP,
          approval_remarks = $3,
          updated_by = $2,
          updated_date = CURRENT_TIMESTAMP
        WHERE routing_id = $4 AND comp_id = $5;`,
        [setAsDefault, userId, dto.approvalRemarks || 'Approved and released for shopfloor execution', routingId, compId],
      );

      // Optionally sync to active BOM for this item
      if (dto.syncToBom) {
        await client.query(
          `UPDATE tbl_mfg_bom_header SET routing_id = $1, updated_by = $2, updated_date = CURRENT_TIMESTAMP WHERE comp_id = $3 AND item_id = $4 AND is_default = TRUE;`,
          [routingId, userId, compId, existing.item_id],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'MFG_ROUTING',
        actionType: 'APPROVE',
        entityTable: 'tbl_mfg_routing_header',
        recordId: routingId,
        newValue: { status: 'ACTIVE', ...dto },
        compId,
        branchId: user.branchId || 1001,
      });

      return this.findOne(routingId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Clone / Revise Routing
  // --------------------------------------------------------------------------
  async cloneRouting(routingId: number, dto: CloneRoutingDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const original = await this.findOne(routingId, user);

    const cleanVer = (dto.newVersionNo || '1.1').trim();
    const newRoutingCode = await this.generateRoutingCode(original.item_id, cleanVer, compId);

    const createDto: CreateRoutingDto = {
      routingCode: newRoutingCode,
      routingName: dto.newRoutingName?.trim() || `${original.routing_name} (Rev ${cleanVer})`,
      itemId: original.item_id,
      versionNo: cleanVer,
      status: 'DRAFT',
      isDefault: false,
      batchSize: original.batch_size,
      remarks: `Cloned from ${original.routing_code} (Rev ${original.version_no})`,
      operations: dto.copyOperations !== false
        ? original.operations.map((o: any) => ({
            opSequence: o.op_sequence,
            opCode: o.op_code,
            opName: o.op_name,
            workCenterId: o.work_center_id,
            machineId: o.machine_id,
            setupTimeMins: o.setup_time_mins,
            runTimeMins: o.run_time_mins,
            overlapPercent: o.overlap_percent,
            machineHourlyRate: o.machine_hourly_rate,
            laborHourlyRate: o.labor_hourly_rate,
            overheadHourlyRate: o.overhead_hourly_rate,
            toolingDescription: o.tooling_description,
            fixtureNo: o.fixture_no,
            isInspectionRequired: o.is_inspection_required,
            qcCheckpoints: o.qc_checkpoints,
            isSubcontracted: o.is_subcontracted,
            subcontractVendorId: o.subcontract_vendor_id,
            remarks: o.remarks,
          }))
        : [],
    };

    const cloned = await this.create(createDto, user);

    await this.auditLogService.logAction({
      userId: user.userId || 1001,
      username: user.username,
      screenCode: 'MFG_ROUTING',
      actionType: 'ADD',
      entityTable: 'tbl_mfg_routing_header',
      recordId: cloned.routing_id,
      newValue: { originalRoutingId: routingId, ...dto },
      compId,
      branchId: user.branchId || 1001,
    });

    return cloned;
  }

  // --------------------------------------------------------------------------
  // Lookups (Items, Work Centers, Machines, Vendors)
  // --------------------------------------------------------------------------
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // Items eligible for routings (manufactured, sub-assembly, or assembly)
    const itemsSql = `
      SELECT
        i.item_id,
        i.item_code,
        i.item_name,
        i.item_type,
        u.uom_code,
        u.uom_name
      FROM tbl_inv_item i
      LEFT JOIN tbl_inv_uom u ON i.uom_id = u.uom_id
      WHERE i.comp_id = $1 AND i.is_active = TRUE
      ORDER BY i.item_code ASC;
    `;

    // Active work centers with standard hourly costing rates
    const wcSql = `
      SELECT
        wc.work_center_id,
        wc.work_center_code,
        wc.work_center_name,
        wc.work_center_type,
        wc.capacity_per_day_hours::FLOAT AS capacity_per_day_hours,
        wc.efficiency_percent::FLOAT AS efficiency_percent,
        wc.cost_per_hour::FLOAT AS cost_per_hour,
        wc.labour_cost_per_hour::FLOAT AS labour_cost_per_hour,
        wc.overhead_cost_per_hour::FLOAT AS overhead_cost_per_hour,
        wc.total_hourly_rate::FLOAT AS total_hourly_rate,
        wc.status
      FROM tbl_mfg_work_center wc
      WHERE wc.comp_id = $1 AND wc.branch_id = $2 AND wc.is_active = TRUE
      ORDER BY wc.work_center_code ASC;
    `;

    // Machine assets per work center
    const machineSql = `
      SELECT
        m.wc_machine_id,
        m.work_center_id,
        m.machine_code,
        m.machine_name,
        m.status,
        m.power_rating_kw::FLOAT AS power_rating_kw
      FROM tbl_mfg_work_center_machine m
      WHERE m.comp_id = $1 AND m.branch_id = $2 AND m.is_active = TRUE
      ORDER BY m.machine_code ASC;
    `;

    // Subcontractors / suppliers
    const vendorSql = `
      SELECT
        party_id,
        party_code,
        party_name,
        city
      FROM tbl_crm_party
      WHERE comp_id = $1 AND party_type IN ('SUPPLIER', 'BOTH') AND is_active = TRUE
      ORDER BY party_name ASC;
    `;

    const [itemsRes, wcRes, machineRes, vendorRes] = await Promise.all([
      this.pool.query(itemsSql, [compId]),
      this.pool.query(wcSql, [compId, branchId]),
      this.pool.query(machineSql, [compId, branchId]),
      this.pool.query(vendorSql, [compId]),
    ]);

    return {
      items: itemsRes.rows,
      workCenters: wcRes.rows,
      machines: machineRes.rows,
      subcontractVendors: vendorRes.rows,
    };
  }
}
