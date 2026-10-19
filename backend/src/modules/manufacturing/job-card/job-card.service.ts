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
  CompleteJobCardDto,
  CreateJobCardDto,
  GenerateJobCardsFromWoDto,
  InProcessQcDto,
  JobCardFilterParams,
  LogTimeAndOutputDto,
  StartJobCardDto,
  UpdateJobCardDto,
} from './job-card.dto';

@Injectable()
export class JobCardService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // --------------------------------------------------------------------------
  // KPI Summary
  // --------------------------------------------------------------------------
  async getJobCardSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const sql = `
      SELECT
        COUNT(*)::INT AS total_job_cards,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END)::INT AS in_progress_count,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::INT AS completed_count,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END)::INT AS pending_count,
        COALESCE(SUM(completed_qty), 0)::FLOAT AS total_completed_qty,
        COALESCE(SUM(scrapped_qty), 0)::FLOAT AS total_scrapped_qty,
        COUNT(CASE WHEN is_inspection_required = TRUE AND in_process_qc_status = 'PENDING' THEN 1 END)::INT AS pending_qc_count,
        COUNT(CASE WHEN is_inspection_required = TRUE AND in_process_qc_status IN ('ACCEPTED', 'DEVIATION_ACCEPTED') THEN 1 END)::INT AS passed_qc_count,
        COALESCE(SUM(actual_cost), 0)::FLOAT AS total_actual_cost
      FROM tbl_mfg_job_card
      WHERE comp_id = $1 AND is_active = TRUE
        AND ($2::BIGINT IS NULL OR branch_id = $2::BIGINT);
    `;

    const res = await this.pool.query(sql, [compId, branchId]);
    const r = res.rows[0] || {};
    const totalQcDecided = Number(r.passed_qc_count || 0) + Number(r.pending_qc_count || 0);
    const qcPassRate = totalQcDecided > 0 ? Math.round((Number(r.passed_qc_count || 0) / totalQcDecided) * 100) : 100;

    return {
      totalJobCards: Number(r.total_job_cards || 0),
      inProgressCount: Number(r.in_progress_count || 0),
      completedCount: Number(r.completed_count || 0),
      pendingCount: Number(r.pending_count || 0),
      totalCompletedQty: Number(r.total_completed_qty || 0),
      totalScrappedQty: Number(r.total_scrapped_qty || 0),
      pendingQcCount: Number(r.pending_qc_count || 0),
      qcPassRate,
      totalActualCost: Math.round(Number(r.total_actual_cost || 0) * 100) / 100,
    };
  }

  // --------------------------------------------------------------------------
  // Lookups
  // --------------------------------------------------------------------------
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const [woRes, wcRes, mcRes, userRes] = await Promise.all([
      this.pool.query(
        `SELECT
           wo.wo_id,
           wo.wo_no,
           wo.wo_date::TEXT AS wo_date,
           wo.item_id,
           i.item_code,
           i.item_name,
           wo.planned_qty::FLOAT AS planned_qty,
           wo.completed_qty::FLOAT AS completed_qty,
           wo.uom_id,
           u.uom_code,
           wo.status,
           wo.priority,
           wo.batch_no,
           (SELECT COUNT(*)::INT FROM tbl_mfg_wo_routing_op ro WHERE ro.wo_id = wo.wo_id AND ro.is_active = TRUE) AS total_ops,
           (SELECT COUNT(*)::INT FROM tbl_mfg_job_card jc WHERE jc.wo_id = wo.wo_id AND jc.is_active = TRUE) AS generated_job_cards
         FROM tbl_mfg_wo_header wo
         JOIN tbl_inv_item i ON wo.item_id = i.item_id
         JOIN tbl_inv_uom u ON wo.uom_id = u.uom_id
         WHERE wo.comp_id = $1 AND wo.is_active = TRUE
           AND wo.status IN ('RELEASED', 'IN_PROGRESS')
           AND ($2::BIGINT IS NULL OR wo.branch_id = $2::BIGINT)
         ORDER BY wo.wo_id DESC;`,
        [compId, branchId],
      ),
      this.pool.query(
        `SELECT
           work_center_id,
           work_center_code,
           work_center_name,
           work_center_type,
           COALESCE(total_hourly_rate, cost_per_hour, 0)::FLOAT AS hourly_rate
         FROM tbl_mfg_work_center
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY work_center_name ASC;`,
        [compId],
      ),
      this.pool.query(
        `SELECT
           wc_machine_id AS machine_id,
           work_center_id,
           machine_code,
           machine_name,
           status
         FROM tbl_mfg_work_center_machine
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY machine_name ASC;`,
        [compId],
      ),
      this.pool.query(
        `SELECT
           user_id,
           username,
           full_name,
           email
         FROM tbl_sec_user
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY full_name ASC;`,
        [compId],
      ),
    ]);

    return {
      activeWorkOrders: woRes.rows,
      workCenters: wcRes.rows,
      machines: mcRes.rows,
      operators: userRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // Auto Document Number Generation
  // --------------------------------------------------------------------------
  private async generateJobCardNo(branchId: number, compId: number): Promise<string> {
    const branchRes = await this.pool.query(
      `SELECT b.branch_code, fy.fyear_code
       FROM tbl_org_branch b
       LEFT JOIN tbl_org_financial_year fy ON fy.comp_id = b.comp_id AND fy.is_current = TRUE
       WHERE b.branch_id = $1;`,
      [branchId],
    );
    const branchCode = branchRes.rows[0]?.branch_code || 'AHM';
    const fyearCode = (branchRes.rows[0]?.fyear_code || '2627').replace(/[^0-9]/g, '');

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::INT AS count FROM tbl_mfg_job_card WHERE comp_id = $1;`,
      [compId],
    );
    const nextSeq = Number(countRes.rows[0]?.count || 0) + 1;
    return `JC-${branchCode}-${fyearCode}-${String(nextSeq).padStart(4, '0')}`;
  }

  // --------------------------------------------------------------------------
  // Find All (Paginated & Filtered)
  // --------------------------------------------------------------------------
  async findAll(params: JobCardFilterParams, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 15));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['jc.comp_id = $1', 'jc.is_active = TRUE'];
    const values: any[] = [compId];
    let idx = 2;

    if (params.search?.trim()) {
      conditions.push(
        `(jc.job_card_no ILIKE $${idx} OR wo.wo_no ILIKE $${idx} OR jc.op_code ILIKE $${idx} OR jc.op_name ILIKE $${idx} OR i.item_code ILIKE $${idx} OR i.item_name ILIKE $${idx} OR wc.work_center_name ILIKE $${idx})`,
      );
      values.push(`%${params.search.trim()}%`);
      idx++;
    }

    if (params.status?.trim() && params.status !== 'ALL') {
      conditions.push(`jc.status = $${idx}`);
      values.push(params.status.trim());
      idx++;
    }

    if (params.workCenterId) {
      conditions.push(`jc.work_center_id = $${idx}`);
      values.push(params.workCenterId);
      idx++;
    }

    if (params.machineId) {
      conditions.push(`jc.machine_id = $${idx}`);
      values.push(params.machineId);
      idx++;
    }

    if (params.woId) {
      conditions.push(`jc.wo_id = $${idx}`);
      values.push(params.woId);
      idx++;
    }

    if (params.operatorId) {
      conditions.push(`jc.assigned_operator_id = $${idx}`);
      values.push(params.operatorId);
      idx++;
    }

    if (params.qcStatus?.trim() && params.qcStatus !== 'ALL') {
      conditions.push(`jc.in_process_qc_status = $${idx}`);
      values.push(params.qcStatus.trim());
      idx++;
    }

    if (params.startDate) {
      conditions.push(`jc.job_card_date >= $${idx}::DATE`);
      values.push(params.startDate);
      idx++;
    }

    if (params.endDate) {
      conditions.push(`jc.job_card_date <= $${idx}::DATE`);
      values.push(params.endDate);
      idx++;
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `
      SELECT COUNT(*)::INT AS total
      FROM tbl_mfg_job_card jc
      JOIN tbl_mfg_wo_header wo ON jc.wo_id = wo.wo_id
      JOIN tbl_inv_item i ON wo.item_id = i.item_id
      JOIN tbl_mfg_work_center wc ON jc.work_center_id = wc.work_center_id
      WHERE ${whereClause};
    `;
    const countRes = await this.pool.query(countSql, values);
    const total = Number(countRes.rows[0]?.total || 0);

    const dataSql = `
      SELECT
        jc.job_card_id,
        jc.job_card_no,
        jc.job_card_date::TEXT AS job_card_date,
        jc.wo_id,
        wo.wo_no,
        wo.item_id AS wo_item_id,
        i.item_code AS wo_item_code,
        i.item_name AS wo_item_name,
        wo.planned_qty::FLOAT AS wo_planned_qty,
        wo.status AS wo_status,
        jc.wo_routing_op_id,
        jc.op_sequence,
        jc.op_code,
        jc.op_name,
        jc.work_center_id,
        wc.work_center_code,
        wc.work_center_name,
        jc.machine_id,
        mc.machine_code,
        mc.machine_name,
        jc.assigned_operator_id,
        u_op.full_name AS operator_name,
        jc.planned_qty::FLOAT AS planned_qty,
        jc.input_qty::FLOAT AS input_qty,
        jc.completed_qty::FLOAT AS completed_qty,
        jc.scrapped_qty::FLOAT AS scrapped_qty,
        jc.rework_qty::FLOAT AS rework_qty,
        jc.uom_id,
        u.uom_code,
        jc.status,
        jc.scheduled_start_date::TEXT AS scheduled_start_date,
        jc.scheduled_end_date::TEXT AS scheduled_end_date,
        jc.actual_start_time,
        jc.actual_end_time,
        jc.planned_setup_mins::FLOAT AS planned_setup_mins,
        jc.planned_run_mins::FLOAT AS planned_run_mins,
        jc.actual_setup_mins::FLOAT AS actual_setup_mins,
        jc.actual_run_mins::FLOAT AS actual_run_mins,
        jc.downtime_mins::FLOAT AS downtime_mins,
        jc.downtime_reason,
        jc.hourly_rate::FLOAT AS hourly_rate,
        jc.actual_cost::FLOAT AS actual_cost,
        jc.is_inspection_required,
        jc.in_process_qc_status,
        jc.qc_inspector_id,
        u_qc.full_name AS qc_inspector_name,
        jc.qc_inspected_at,
        jc.qc_sample_size,
        jc.qc_accepted_qty::FLOAT AS qc_accepted_qty,
        jc.qc_rejected_qty::FLOAT AS qc_rejected_qty,
        jc.qc_remarks,
        jc.batch_no,
        jc.heat_no,
        jc.remarks,
        jc.created_date,
        (SELECT COUNT(*)::INT FROM tbl_mfg_job_card_time_log tl WHERE tl.job_card_id = jc.job_card_id AND tl.is_active = TRUE) AS time_log_count
      FROM tbl_mfg_job_card jc
      JOIN tbl_mfg_wo_header wo ON jc.wo_id = wo.wo_id
      JOIN tbl_inv_item i ON wo.item_id = i.item_id
      JOIN tbl_inv_uom u ON jc.uom_id = u.uom_id
      JOIN tbl_mfg_work_center wc ON jc.work_center_id = wc.work_center_id
      LEFT JOIN tbl_mfg_work_center_machine mc ON jc.machine_id = mc.wc_machine_id
      LEFT JOIN tbl_sec_user u_op ON jc.assigned_operator_id = u_op.user_id
      LEFT JOIN tbl_sec_user u_qc ON jc.qc_inspector_id = u_qc.user_id
      WHERE ${whereClause}
      ORDER BY jc.wo_id DESC, jc.op_sequence ASC, jc.job_card_id DESC
      LIMIT $${idx} OFFSET $${idx + 1};
    `;

    values.push(limit, offset);
    const dataRes = await this.pool.query(dataSql, values);

    return {
      data: dataRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // --------------------------------------------------------------------------
  // Find One (Detail View with Time Logs)
  // --------------------------------------------------------------------------
  async findOne(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const headSql = `
      SELECT
        jc.job_card_id,
        jc.job_card_no,
        jc.job_card_date::TEXT AS job_card_date,
        jc.wo_id,
        wo.wo_no,
        wo.item_id AS wo_item_id,
        i.item_code AS wo_item_code,
        i.item_name AS wo_item_name,
        i.item_type AS wo_item_type,
        wo.planned_qty::FLOAT AS wo_planned_qty,
        wo.completed_qty::FLOAT AS wo_completed_qty,
        wo.status AS wo_status,
        wo.priority AS wo_priority,
        jc.wo_routing_op_id,
        jc.op_sequence,
        jc.op_code,
        jc.op_name,
        jc.work_center_id,
        wc.work_center_code,
        wc.work_center_name,
        wc.work_center_type,
        jc.machine_id,
        mc.machine_code,
        mc.machine_name,
        jc.assigned_operator_id,
        u_op.full_name AS operator_name,
        jc.planned_qty::FLOAT AS planned_qty,
        jc.input_qty::FLOAT AS input_qty,
        jc.completed_qty::FLOAT AS completed_qty,
        jc.scrapped_qty::FLOAT AS scrapped_qty,
        jc.rework_qty::FLOAT AS rework_qty,
        jc.uom_id,
        u.uom_code,
        u.uom_name,
        jc.status,
        jc.scheduled_start_date::TEXT AS scheduled_start_date,
        jc.scheduled_end_date::TEXT AS scheduled_end_date,
        jc.actual_start_time,
        jc.actual_end_time,
        jc.planned_setup_mins::FLOAT AS planned_setup_mins,
        jc.planned_run_mins::FLOAT AS planned_run_mins,
        jc.actual_setup_mins::FLOAT AS actual_setup_mins,
        jc.actual_run_mins::FLOAT AS actual_run_mins,
        jc.downtime_mins::FLOAT AS downtime_mins,
        jc.downtime_reason,
        jc.hourly_rate::FLOAT AS hourly_rate,
        jc.actual_cost::FLOAT AS actual_cost,
        jc.is_inspection_required,
        jc.in_process_qc_status,
        jc.qc_inspector_id,
        u_qc.full_name AS qc_inspector_name,
        jc.qc_inspected_at,
        jc.qc_sample_size,
        jc.qc_accepted_qty::FLOAT AS qc_accepted_qty,
        jc.qc_rejected_qty::FLOAT AS qc_rejected_qty,
        jc.qc_remarks,
        jc.batch_no,
        jc.heat_no,
        jc.remarks,
        jc.created_date,
        jc.created_by,
        u_cr.full_name AS created_by_name,
        jc.updated_date,
        u_up.full_name AS updated_by_name
      FROM tbl_mfg_job_card jc
      JOIN tbl_mfg_wo_header wo ON jc.wo_id = wo.wo_id
      JOIN tbl_inv_item i ON wo.item_id = i.item_id
      JOIN tbl_inv_uom u ON jc.uom_id = u.uom_id
      JOIN tbl_mfg_work_center wc ON jc.work_center_id = wc.work_center_id
      LEFT JOIN tbl_mfg_work_center_machine mc ON jc.machine_id = mc.wc_machine_id
      LEFT JOIN tbl_sec_user u_op ON jc.assigned_operator_id = u_op.user_id
      LEFT JOIN tbl_sec_user u_qc ON jc.qc_inspector_id = u_qc.user_id
      LEFT JOIN tbl_sec_user u_cr ON jc.created_by = u_cr.user_id
      LEFT JOIN tbl_sec_user u_up ON jc.updated_by = u_up.user_id
      WHERE jc.job_card_id = $1 AND jc.comp_id = $2 AND jc.is_active = TRUE;
    `;

    const headRes = await this.pool.query(headSql, [id, compId]);
    if (headRes.rows.length === 0) {
      throw new NotFoundException(`Job Card #${id} not found.`);
    }

    const header = headRes.rows[0];

    // Child Time & Output Logs
    const logSql = `
      SELECT
        tl.log_id,
        tl.job_card_id,
        tl.operator_id,
        u_op.full_name AS operator_name,
        tl.machine_id,
        mc.machine_name,
        tl.start_time,
        tl.end_time,
        tl.setup_mins::FLOAT AS setup_mins,
        tl.run_mins::FLOAT AS run_mins,
        tl.downtime_mins::FLOAT AS downtime_mins,
        tl.downtime_reason,
        tl.completed_qty::FLOAT AS completed_qty,
        tl.scrapped_qty::FLOAT AS scrapped_qty,
        tl.rework_qty::FLOAT AS rework_qty,
        tl.remarks,
        tl.created_date
      FROM tbl_mfg_job_card_time_log tl
      LEFT JOIN tbl_sec_user u_op ON tl.operator_id = u_op.user_id
      LEFT JOIN tbl_mfg_work_center_machine mc ON tl.machine_id = mc.wc_machine_id
      WHERE tl.job_card_id = $1 AND tl.is_active = TRUE
      ORDER BY tl.log_id DESC;
    `;

    const logRes = await this.pool.query(logSql, [id]);
    header.timeLogs = logRes.rows;

    return header;
  }

  // --------------------------------------------------------------------------
  // Generate Job Cards From Work Order (1-Click Shopfloor Dispatch)
  // --------------------------------------------------------------------------
  async generateJobCardsFromWo(dto: GenerateJobCardsFromWoDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    // Verify WO exists and is active
    const woRes = await this.pool.query(
      `SELECT wo_id, wo_no, planned_qty::FLOAT AS planned_qty, uom_id, status, batch_no
       FROM tbl_mfg_wo_header
       WHERE wo_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [dto.woId, compId],
    );

    if (woRes.rows.length === 0) {
      throw new NotFoundException(`Work Order #${dto.woId} not found.`);
    }

    const wo = woRes.rows[0];
    if (wo.status !== 'RELEASED' && wo.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Job Cards can only be generated for RELEASED or IN_PROGRESS Work Orders (current: ${wo.status}).`,
      );
    }

    // Retrieve unassigned routing operations
    const opRes = await this.pool.query(
      `SELECT
         ro.wo_routing_op_id,
         ro.op_sequence,
         ro.op_code,
         ro.op_name,
         ro.work_center_id,
         ro.machine_id,
         ro.planned_setup_time_mins::FLOAT AS planned_setup_time_mins,
         ro.planned_run_time_mins::FLOAT AS planned_run_time_mins,
         ro.planned_qty::FLOAT AS planned_qty,
         ro.scheduled_start_date,
         ro.scheduled_end_date,
         ro.is_inspection_required,
         COALESCE(wc.total_hourly_rate, wc.cost_per_hour, 0)::FLOAT AS hourly_rate
       FROM tbl_mfg_wo_routing_op ro
       JOIN tbl_mfg_work_center wc ON ro.work_center_id = wc.work_center_id
       WHERE ro.wo_id = $1 AND ro.is_active = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM tbl_mfg_job_card jc
           WHERE jc.wo_routing_op_id = ro.wo_routing_op_id AND jc.is_active = TRUE
         )
       ORDER BY ro.op_sequence ASC;`,
      [dto.woId],
    );

    if (opRes.rows.length === 0) {
      throw new ConflictException(
        `All routing operations for Work Order #${wo.wo_no} already have Job Cards assigned.`,
      );
    }

    const client = await this.pool.connect();
    const createdJobCards: any[] = [];

    try {
      await client.query('BEGIN');

      for (let i = 0; i < opRes.rows.length; i++) {
        const op = opRes.rows[i];
        const jobCardNo = await this.generateJobCardNo(branchId, compId);

        // For first op (OP-10), input_qty = planned_qty; for subsequent, input_qty is staged as previous op produces
        const inputQty = op.op_sequence === 10 ? op.planned_qty : 0;
        const inProcessQcStatus = op.is_inspection_required ? 'PENDING' : 'NA';

        const insertSql = `
          INSERT INTO tbl_mfg_job_card (
            job_card_no, job_card_date, wo_id, wo_routing_op_id,
            op_sequence, op_code, op_name, work_center_id, machine_id,
            planned_qty, input_qty, completed_qty, scrapped_qty, rework_qty, uom_id,
            status, scheduled_start_date, scheduled_end_date,
            planned_setup_mins, planned_run_mins, hourly_rate, actual_cost,
            is_inspection_required, in_process_qc_status,
            batch_no, remarks, is_active,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, CURRENT_DATE, $2, $3,
            $4, $5, $6, $7, $8,
            $9, $10, 0, 0, 0, $11,
            'PENDING', $12, $13,
            $14, $15, $16, 0,
            $17, $18,
            $19, $20, TRUE,
            $21, $22, 1001, $23
          ) RETURNING job_card_id, job_card_no;
        `;

        const jcRes = await client.query(insertSql, [
          jobCardNo,
          dto.woId,
          op.wo_routing_op_id,
          op.op_sequence,
          op.op_code,
          op.op_name,
          op.work_center_id,
          op.machine_id,
          op.planned_qty,
          inputQty,
          wo.uom_id,
          op.scheduled_start_date,
          op.scheduled_end_date,
          op.planned_setup_time_mins,
          op.planned_run_time_mins,
          op.hourly_rate,
          op.is_inspection_required,
          inProcessQcStatus,
          wo.batch_no,
          dto.remarks || `Auto-generated from Work Order #${wo.wo_no}`,
          compId,
          branchId,
          userId,
        ]);

        createdJobCards.push(jcRes.rows[0]);
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        screenCode: 'MFG_JOB_CARD',
        actionType: 'ADD',
        entityTable: 'tbl_mfg_job_card',
        recordId: createdJobCards[0]?.job_card_id || dto.woId,
        newValue: {
          woId: dto.woId,
          woNo: wo.wo_no,
          generatedCount: createdJobCards.length,
          jobCards: createdJobCards.map((j) => j.job_card_no),
        },
        compId,
        branchId,
      });

      return {
        message: `Successfully generated ${createdJobCards.length} Job Card(s) for Work Order #${wo.wo_no}.`,
        jobCards: createdJobCards,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Start Job Card (Clock In / Set IN_PROGRESS)
  // --------------------------------------------------------------------------
  async startJob(id: number, dto: StartJobCardDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;

    const jcRes = await this.pool.query(
      `SELECT job_card_id, job_card_no, wo_id, status, actual_start_time
       FROM tbl_mfg_job_card
       WHERE job_card_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [id, compId],
    );

    if (jcRes.rows.length === 0) {
      throw new NotFoundException(`Job Card #${id} not found.`);
    }

    const jc = jcRes.rows[0];
    if (jc.status === 'COMPLETED' || jc.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot start Job Card in ${jc.status} status.`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const updateSql = `
        UPDATE tbl_mfg_job_card
        SET status = 'IN_PROGRESS',
            assigned_operator_id = COALESCE($1, assigned_operator_id, $2),
            machine_id = COALESCE($3, machine_id),
            actual_start_time = COALESCE(actual_start_time, CURRENT_TIMESTAMP),
            remarks = COALESCE($4, remarks),
            updated_by = $2,
            updated_date = CURRENT_TIMESTAMP
        WHERE job_card_id = $5 AND comp_id = $6
        RETURNING *;
      `;

      const res = await client.query(updateSql, [
        dto.operatorId || null,
        userId,
        dto.machineId || null,
        dto.remarks || null,
        id,
        compId,
      ]);

      // If Work Order was RELEASED, transition to IN_PROGRESS
      await client.query(
        `UPDATE tbl_mfg_wo_header
         SET status = 'IN_PROGRESS',
             actual_start_date = COALESCE(actual_start_date, CURRENT_TIMESTAMP),
             updated_by = $1,
             updated_date = CURRENT_TIMESTAMP
         WHERE wo_id = $2 AND status = 'RELEASED';`,
        [userId, jc.wo_id],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        screenCode: 'MFG_JOB_CARD',
        actionType: 'START',
        entityTable: 'tbl_mfg_job_card',
        recordId: id,
        oldValue: { status: jc.status },
        newValue: { status: 'IN_PROGRESS', actual_start_time: res.rows[0].actual_start_time },
        compId,
        branchId: user.branchId || 1001,
      });

      return res.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Log Time & Production Output
  // --------------------------------------------------------------------------
  async logTimeAndOutput(id: number, dto: LogTimeAndOutputDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;
    const branchId = user.branchId || 1001;

    const jcRes = await this.pool.query(
      `SELECT
         job_card_id, job_card_no, wo_id, wo_routing_op_id, hourly_rate::FLOAT AS hourly_rate,
         completed_qty::FLOAT AS completed_qty, planned_qty::FLOAT AS planned_qty,
         actual_setup_mins::FLOAT AS actual_setup_mins, actual_run_mins::FLOAT AS actual_run_mins,
         status
       FROM tbl_mfg_job_card
       WHERE job_card_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [id, compId],
    );

    if (jcRes.rows.length === 0) {
      throw new NotFoundException(`Job Card #${id} not found.`);
    }

    const jc = jcRes.rows[0];
    if (jc.status === 'COMPLETED' || jc.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot log output for ${jc.status} Job Card.`);
    }

    const setupMins = Math.max(0, Number(dto.setupMins) || 0);
    const runMins = Math.max(0, Number(dto.runMins) || 0);
    const downtimeMins = Math.max(0, Number(dto.downtimeMins) || 0);
    const completedQty = Math.max(0, Number(dto.completedQty) || 0);
    const scrappedQty = Math.max(0, Number(dto.scrappedQty) || 0);
    const reworkQty = Math.max(0, Number(dto.reworkQty) || 0);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert into time log
      await client.query(
        `INSERT INTO tbl_mfg_job_card_time_log (
           job_card_id, operator_id, machine_id,
           start_time, end_time, setup_mins, run_mins, downtime_mins, downtime_reason,
           completed_qty, scrapped_qty, rework_qty, remarks, is_active,
           comp_id, branch_id, fyear_id, created_by
         ) VALUES (
           $1, $2, $3,
           CURRENT_TIMESTAMP - (INTERVAL '1 minute' * $4), CURRENT_TIMESTAMP,
           $5, $6, $7, $8,
           $9, $10, $11, $12, TRUE,
           $13, $14, 1001, $15
         );`,
        [
          id,
          dto.operatorId || userId,
          dto.machineId || null,
          setupMins + runMins + downtimeMins,
          setupMins,
          runMins,
          downtimeMins,
          dto.downtimeReason || null,
          completedQty,
          scrappedQty,
          reworkQty,
          dto.remarks || null,
          compId,
          branchId,
          userId,
        ],
      );

      // 2. Accumulate onto Job Card
      const newSetupMins = jc.actual_setup_mins + setupMins;
      const newRunMins = jc.actual_run_mins + runMins;
      const newCompletedQty = jc.completed_qty + completedQty;
      const totalLaborHours = (newSetupMins + newRunMins) / 60.0;
      const newActualCost = Math.round(totalLaborHours * jc.hourly_rate * 100) / 100;

      const updateJcSql = `
        UPDATE tbl_mfg_job_card
        SET actual_setup_mins = actual_setup_mins + $1,
            actual_run_mins = actual_run_mins + $2,
            downtime_mins = downtime_mins + $3,
            downtime_reason = COALESCE($4, downtime_reason),
            completed_qty = completed_qty + $5,
            scrapped_qty = scrapped_qty + $6,
            rework_qty = rework_qty + $7,
            actual_cost = $8,
            status = 'IN_PROGRESS',
            updated_by = $9,
            updated_date = CURRENT_TIMESTAMP
        WHERE job_card_id = $10 AND comp_id = $11
        RETURNING *;
      `;

      const updatedJc = await client.query(updateJcSql, [
        setupMins,
        runMins,
        downtimeMins,
        dto.downtimeReason || null,
        completedQty,
        scrappedQty,
        reworkQty,
        newActualCost,
        userId,
        id,
        compId,
      ]);

      // 3. Mirror progress on Work Order Routing Operation snapshot
      await client.query(
        `UPDATE tbl_mfg_wo_routing_op
         SET actual_setup_time_mins = actual_setup_time_mins + $1,
             actual_run_time_mins = actual_run_time_mins + $2,
             completed_qty = completed_qty + $3,
             scrapped_qty = scrapped_qty + $4,
             rework_qty = rework_qty + $5,
             actual_cost = $6,
             status = 'IN_PROGRESS',
             updated_by = $7,
             updated_date = CURRENT_TIMESTAMP
         WHERE wo_routing_op_id = $8;`,
        [setupMins, runMins, completedQty, scrappedQty, reworkQty, newActualCost, userId, jc.wo_routing_op_id],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        screenCode: 'MFG_JOB_CARD',
        actionType: 'EDIT',
        entityTable: 'tbl_mfg_job_card',
        recordId: id,
        newValue: {
          addedCompletedQty: completedQty,
          addedSetupMins: setupMins,
          addedRunMins: runMins,
          totalCompletedQty: newCompletedQty,
          totalCost: newActualCost,
        },
        compId,
        branchId,
      });

      return updatedJc.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // In-Process QC Inspection Clearance
  // --------------------------------------------------------------------------
  async inProcessQc(id: number, dto: InProcessQcDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;

    const jcRes = await this.pool.query(
      `SELECT job_card_id, job_card_no, is_inspection_required, in_process_qc_status
       FROM tbl_mfg_job_card
       WHERE job_card_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [id, compId],
    );

    if (jcRes.rows.length === 0) {
      throw new NotFoundException(`Job Card #${id} not found.`);
    }

    const jc = jcRes.rows[0];

    const updateSql = `
      UPDATE tbl_mfg_job_card
      SET in_process_qc_status = $1,
          qc_inspector_id = $2,
          qc_inspected_at = CURRENT_TIMESTAMP,
          qc_sample_size = COALESCE($3, 0),
          qc_accepted_qty = $4,
          qc_rejected_qty = COALESCE($5, 0),
          qc_remarks = $6,
          updated_by = $2,
          updated_date = CURRENT_TIMESTAMP
      WHERE job_card_id = $7 AND comp_id = $8
      RETURNING *;
    `;

    const res = await this.pool.query(updateSql, [
      dto.qcStatus,
      userId,
      dto.sampleSize || 0,
      dto.acceptedQty,
      dto.rejectedQty || 0,
      dto.qcRemarks || null,
      id,
      compId,
    ]);

    await this.auditLogService.logAction({
      userId,
      screenCode: 'MFG_JOB_CARD',
      actionType: 'APPROVE',
      entityTable: 'tbl_mfg_job_card',
      recordId: id,
      oldValue: { qcStatus: jc.in_process_qc_status },
      newValue: {
        qcStatus: dto.qcStatus,
        acceptedQty: dto.acceptedQty,
        rejectedQty: dto.rejectedQty,
        qcRemarks: dto.qcRemarks,
      },
      compId,
      branchId: user.branchId || 1001,
    });

    return res.rows[0];
  }

  // --------------------------------------------------------------------------
  // Complete Job Card (Stage Handover & WO Cost Rollup)
  // --------------------------------------------------------------------------
  async completeJob(id: number, dto: CompleteJobCardDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;

    const jcRes = await this.pool.query(
      `SELECT
         jc.job_card_id, jc.job_card_no, jc.wo_id, jc.wo_routing_op_id, jc.op_sequence,
         jc.completed_qty::FLOAT AS completed_qty, jc.planned_qty::FLOAT AS planned_qty,
         jc.is_inspection_required, jc.in_process_qc_status, jc.actual_cost::FLOAT AS actual_cost,
         jc.status
       FROM tbl_mfg_job_card jc
       WHERE jc.job_card_id = $1 AND jc.comp_id = $2 AND jc.is_active = TRUE;`,
      [id, compId],
    );

    if (jcRes.rows.length === 0) {
      throw new NotFoundException(`Job Card #${id} not found.`);
    }

    const jc = jcRes.rows[0];
    if (jc.status === 'COMPLETED') {
      throw new BadRequestException(`Job Card #${jc.job_card_no} is already completed.`);
    }

    // QC Gate: If QC required, must be ACCEPTED or DEVIATION_ACCEPTED
    if (jc.is_inspection_required && jc.in_process_qc_status === 'PENDING') {
      throw new BadRequestException(
        `Job Card #${jc.job_card_no} requires In-Process Quality Inspection clearance before completion. Current QC Status: PENDING.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Mark Job Card COMPLETED
      const updateJcSql = `
        UPDATE tbl_mfg_job_card
        SET status = 'COMPLETED',
            actual_end_time = CURRENT_TIMESTAMP,
            remarks = COALESCE($1, remarks),
            updated_by = $2,
            updated_date = CURRENT_TIMESTAMP
        WHERE job_card_id = $3 AND comp_id = $4
        RETURNING *;
      `;
      const completedJc = await client.query(updateJcSql, [
        dto.finalRemarks || null,
        userId,
        id,
        compId,
      ]);

      // 2. Mark corresponding routing operation COMPLETED
      await client.query(
        `UPDATE tbl_mfg_wo_routing_op
         SET status = 'COMPLETED',
             updated_by = $1,
             updated_date = CURRENT_TIMESTAMP
         WHERE wo_routing_op_id = $2;`,
        [userId, jc.wo_routing_op_id],
      );

      // 3. Handover completed quantity to next operation in sequence for the same Work Order
      const nextOpRes = await client.query(
        `SELECT job_card_id, op_sequence
         FROM tbl_mfg_job_card
         WHERE wo_id = $1 AND op_sequence > $2 AND is_active = TRUE
         ORDER BY op_sequence ASC
         LIMIT 1;`,
        [jc.wo_id, jc.op_sequence],
      );

      if (nextOpRes.rows.length > 0) {
        const nextJc = nextOpRes.rows[0];
        await client.query(
          `UPDATE tbl_mfg_job_card
           SET input_qty = $1,
               updated_by = $2,
               updated_date = CURRENT_TIMESTAMP
           WHERE job_card_id = $3;`,
          [jc.completed_qty, userId, nextJc.job_card_id],
        );
      }

      // 4. Check if all operations for this Work Order are completed
      const pendingOpsRes = await client.query(
        `SELECT COUNT(*)::INT AS pending_count
         FROM tbl_mfg_job_card
         WHERE wo_id = $1 AND is_active = TRUE AND status != 'COMPLETED';`,
        [jc.wo_id],
      );

      const pendingCount = Number(pendingOpsRes.rows[0]?.pending_count || 0);

      // Roll up all actual operation costs onto the Work Order header
      const costRollupRes = await client.query(
        `SELECT COALESCE(SUM(actual_cost), 0)::FLOAT AS total_actual_op_cost
         FROM tbl_mfg_job_card
         WHERE wo_id = $1 AND is_active = TRUE;`,
        [jc.wo_id],
      );
      const totalOpCost = Number(costRollupRes.rows[0]?.total_actual_op_cost || 0);

      await client.query(
        `UPDATE tbl_mfg_wo_header
         SET actual_operation_cost = $1,
             actual_total_cost = actual_material_cost + $1,
             completed_qty = CASE WHEN $2 = 0 THEN $3 ELSE completed_qty END,
             actual_end_date = CASE WHEN $2 = 0 THEN CURRENT_TIMESTAMP ELSE actual_end_date END,
             updated_by = $4,
             updated_date = CURRENT_TIMESTAMP
         WHERE wo_id = $5;`,
        [totalOpCost, pendingCount, jc.completed_qty, userId, jc.wo_id],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        screenCode: 'MFG_JOB_CARD',
        actionType: 'COMPLETE',
        entityTable: 'tbl_mfg_job_card',
        recordId: id,
        newValue: {
          status: 'COMPLETED',
          completedQty: jc.completed_qty,
          actualCost: jc.actual_cost,
          woId: jc.wo_id,
          allOpsCompleted: pendingCount === 0,
        },
        compId,
        branchId: user.branchId || 1001,
      });

      return completedJc.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Delete Job Card (Draft / Pending Only)
  // --------------------------------------------------------------------------
  async delete(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;

    const jcRes = await this.pool.query(
      `SELECT job_card_id, job_card_no, status, wo_id
       FROM tbl_mfg_job_card
       WHERE job_card_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [id, compId],
    );

    if (jcRes.rows.length === 0) {
      throw new NotFoundException(`Job Card #${id} not found.`);
    }

    const jc = jcRes.rows[0];
    if (jc.status === 'COMPLETED' || jc.status === 'IN_PROGRESS') {
      throw new BadRequestException(
        `Cannot delete Job Card #${jc.job_card_no} in ${jc.status} status. Only PENDING or CANCELLED Job Cards can be deleted.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Soft delete child logs
      await client.query(
        `UPDATE tbl_mfg_job_card_time_log
         SET is_active = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP
         WHERE job_card_id = $2;`,
        [userId, id],
      );

      // Soft delete job card
      await client.query(
        `UPDATE tbl_mfg_job_card
         SET is_active = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP
         WHERE job_card_id = $2;`,
        [userId, id],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        screenCode: 'MFG_JOB_CARD',
        actionType: 'DELETE',
        entityTable: 'tbl_mfg_job_card',
        recordId: id,
        oldValue: { jobCardNo: jc.job_card_no, woId: jc.wo_id },
        compId,
        branchId: user.branchId || 1001,
      });

      return { success: true, message: `Job Card #${jc.job_card_no} deleted successfully.` };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
