import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../database/database.module';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import { AuditLogService } from '../../../common/services/audit-log.service';
import type {
  ApproveInProcessQcDto,
  CreateInProcessQcDto,
  GrantDeviationDto,
  InProcessQcFilterDto,
  UpdateInProcessQcDto,
} from './in-process-qc.dto';

@Injectable()
export class InProcessQcService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
  ) {}

  // --------------------------------------------------------------------------
  // KPI Summary
  // --------------------------------------------------------------------------
  async getSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const sql = `
      SELECT
        COUNT(*)::INT AS total_inspections,
        COUNT(CASE WHEN inspection_stage = 'FIRST_PIECE' AND overall_result IN ('ACCEPTED', 'ACCEPTED_UNDER_DEVIATION') THEN 1 END)::INT AS first_piece_approved,
        COUNT(CASE WHEN overall_result = 'ACCEPTED_UNDER_DEVIATION' THEN 1 END)::INT AS deviation_count,
        COUNT(CASE WHEN overall_result = 'REJECTED' THEN 1 END)::INT AS rejected_count,
        COUNT(CASE WHEN status IN ('DRAFT', 'IN_PROGRESS') THEN 1 END)::INT AS active_pending_count
      FROM tbl_qc_in_process_header
      WHERE comp_id = $1 AND is_active = TRUE
        AND ($2::BIGINT IS NULL OR branch_id = $2::BIGINT);
    `;

    const res = await this.pool.query(sql, [compId, branchId]);
    const r = res.rows[0] || {};
    return {
      totalInspections: Number(r.total_inspections || 0),
      firstPieceApproved: Number(r.first_piece_approved || 0),
      deviationCount: Number(r.deviation_count || 0),
      rejectedCount: Number(r.rejected_count || 0),
      activePendingCount: Number(r.active_pending_count || 0),
    };
  }

  // --------------------------------------------------------------------------
  // Lookups: Work Orders, Job Cards, Work Centers, Machines, Operators, Inspectors
  // --------------------------------------------------------------------------
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const [woRes, jcRes, wcRes, mcRes, userRes, itemRes] = await Promise.all([
      // Work orders
      this.pool.query(
        `SELECT wo_id, wo_no, wo_date, item_id, planned_qty, status
         FROM tbl_mfg_wo_header
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY wo_id DESC
         LIMIT 50;`,
        [compId],
      ),
      // Job cards
      this.pool.query(
        `SELECT jc.job_card_id, jc.job_card_no, jc.wo_id, jc.wo_routing_op_id,
                jc.op_sequence, jc.op_code, jc.op_name, jc.work_center_id, jc.machine_id,
                jc.assigned_operator_id, jc.planned_qty, jc.completed_qty, jc.uom_id,
                jc.status, jc.in_process_qc_status, jc.batch_no, jc.heat_no,
                wo.item_id
         FROM tbl_mfg_job_card jc
         JOIN tbl_mfg_wo_header wo ON wo.wo_id = jc.wo_id
         WHERE jc.comp_id = $1 AND jc.is_active = TRUE
         ORDER BY jc.job_card_id DESC
         LIMIT 50;`,
        [compId],
      ),
      // Work centers
      this.pool.query(
        `SELECT work_center_id, wc_code, wc_name, wc_type
         FROM tbl_mfg_work_center
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY wc_code ASC;`,
        [compId],
      ),
      // Machines
      this.pool.query(
        `SELECT wc_machine_id, work_center_id, machine_code, machine_name
         FROM tbl_mfg_work_center_machine
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY machine_code ASC;`,
        [compId],
      ),
      // Users (Inspectors, Operators)
      this.pool.query(
        `SELECT user_id, username, full_name
         FROM tbl_sec_user
         WHERE is_active = TRUE
         ORDER BY full_name ASC;`,
      ),
      // Items
      this.pool.query(
        `SELECT item_id, item_code, item_name, uom_id
         FROM tbl_inv_item
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY item_code ASC;`,
        [compId],
      ),
    ]);

    return {
      workOrders: woRes.rows.map((r) => ({
        woId: Number(r.wo_id),
        woNo: r.wo_no,
        woDate: r.wo_date,
        itemId: Number(r.item_id),
        plannedQty: Number(r.planned_qty),
        status: r.status,
      })),
      jobCards: jcRes.rows.map((r) => ({
        jobCardId: Number(r.job_card_id),
        jobCardNo: r.job_card_no,
        woId: Number(r.wo_id),
        woRoutingOpId: r.wo_routing_op_id ? Number(r.wo_routing_op_id) : null,
        opSequence: Number(r.op_sequence),
        opCode: r.op_code,
        opName: r.op_name,
        workCenterId: Number(r.work_center_id),
        machineId: r.machine_id ? Number(r.machine_id) : null,
        assignedOperatorId: r.assigned_operator_id
          ? Number(r.assigned_operator_id)
          : null,
        plannedQty: Number(r.planned_qty),
        completedQty: Number(r.completed_qty),
        uomId: Number(r.uom_id),
        status: r.status,
        inProcessQcStatus: r.in_process_qc_status,
        batchNo: r.batch_no,
        heatNo: r.heat_no,
        itemId: Number(r.item_id),
      })),
      workCenters: wcRes.rows.map((r) => ({
        workCenterId: Number(r.work_center_id),
        wcCode: r.wc_code,
        wcName: r.wc_name,
        wcType: r.wc_type,
      })),
      machines: mcRes.rows.map((r) => ({
        machineId: Number(r.wc_machine_id),
        workCenterId: Number(r.work_center_id),
        machineCode: r.machine_code,
        machineName: r.machine_name,
      })),
      users: userRes.rows.map((r) => ({
        userId: Number(r.user_id),
        username: r.username,
        fullName: r.full_name,
      })),
      items: itemRes.rows.map((r) => ({
        itemId: Number(r.item_id),
        itemCode: r.item_code,
        itemName: r.item_name,
        uomId: Number(r.uom_id),
      })),
    };
  }

  // --------------------------------------------------------------------------
  // List All Inspections (with multi-field search and filters)
  // --------------------------------------------------------------------------
  async findAll(filter: InProcessQcFilterDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const conditions: string[] = ['h.comp_id = $1', 'h.is_active = TRUE'];
    const params: any[] = [compId];
    let paramIndex = 2;

    if (branchId) {
      conditions.push(`h.branch_id = $${paramIndex}`);
      params.push(branchId);
      paramIndex++;
    }

    if (filter.status) {
      conditions.push(`h.status = $${paramIndex}`);
      params.push(filter.status);
      paramIndex++;
    }

    if (filter.overallResult) {
      conditions.push(`h.overall_result = $${paramIndex}`);
      params.push(filter.overallResult);
      paramIndex++;
    }

    if (filter.inspectionStage) {
      conditions.push(`h.inspection_stage = $${paramIndex}`);
      params.push(filter.inspectionStage);
      paramIndex++;
    }

    if (filter.woId) {
      conditions.push(`h.wo_id = $${paramIndex}`);
      params.push(filter.woId);
      paramIndex++;
    }

    if (filter.jobCardId) {
      conditions.push(`h.job_card_id = $${paramIndex}`);
      params.push(filter.jobCardId);
      paramIndex++;
    }

    if (filter.itemId) {
      conditions.push(`h.item_id = $${paramIndex}`);
      params.push(filter.itemId);
      paramIndex++;
    }

    if (filter.startDate) {
      conditions.push(`h.ipqc_date >= $${paramIndex}`);
      params.push(filter.startDate);
      paramIndex++;
    }

    if (filter.endDate) {
      conditions.push(`h.ipqc_date <= $${paramIndex}`);
      params.push(filter.endDate);
      paramIndex++;
    }

    if (filter.search && filter.search.trim()) {
      conditions.push(
        `(h.ipqc_no ILIKE $${paramIndex} OR wo.wo_no ILIKE $${paramIndex} OR jc.job_card_no ILIKE $${paramIndex} OR it.item_name ILIKE $${paramIndex} OR it.item_code ILIKE $${paramIndex} OR h.batch_no ILIKE $${paramIndex})`,
      );
      params.push(`%${filter.search.trim()}%`);
      paramIndex++;
    }

    const sql = `
      SELECT
        h.ipqc_id,
        h.ipqc_no,
        h.ipqc_date,
        h.wo_id,
        wo.wo_no,
        h.job_card_id,
        jc.job_card_no,
        jc.op_code,
        jc.op_name,
        h.item_id,
        it.item_code,
        it.item_name,
        h.work_center_id,
        wc.wc_code,
        wc.wc_name,
        h.machine_id,
        mc.machine_code,
        mc.machine_name,
        h.assigned_operator_id,
        op_user.full_name AS operator_name,
        h.inspector_id,
        insp_user.full_name AS inspector_name,
        h.inspection_stage,
        h.shift_name,
        h.batch_no,
        h.heat_no,
        h.lot_qty,
        h.sample_size,
        h.accepted_qty,
        h.rejected_qty,
        h.rework_qty,
        h.overall_result,
        h.disposition_type,
        h.deviation_reason,
        h.approver_id,
        appr_user.full_name AS approver_name,
        h.approval_date,
        h.is_capa_required,
        h.ncr_no,
        h.remarks,
        h.status,
        h.created_date,
        COALESCE(p_stat.param_count, 0)::INT AS param_count,
        COALESCE(p_stat.pass_count, 0)::INT AS pass_count,
        COALESCE(p_stat.fail_count, 0)::INT AS fail_count,
        COALESCE(p_stat.concession_count, 0)::INT AS concession_count
      FROM tbl_qc_in_process_header h
      JOIN tbl_mfg_wo_header wo ON wo.wo_id = h.wo_id
      LEFT JOIN tbl_mfg_job_card jc ON jc.job_card_id = h.job_card_id
      JOIN tbl_inv_item it ON it.item_id = h.item_id
      LEFT JOIN tbl_mfg_work_center wc ON wc.work_center_id = h.work_center_id
      LEFT JOIN tbl_mfg_work_center_machine mc ON mc.wc_machine_id = h.machine_id
      LEFT JOIN tbl_sec_user op_user ON op_user.user_id = h.assigned_operator_id
      LEFT JOIN tbl_sec_user insp_user ON insp_user.user_id = h.inspector_id
      LEFT JOIN tbl_sec_user appr_user ON appr_user.user_id = h.approver_id
      LEFT JOIN (
        SELECT
          ipqc_id,
          COUNT(*)::INT AS param_count,
          COUNT(CASE WHEN param_result = 'PASS' THEN 1 END)::INT AS pass_count,
          COUNT(CASE WHEN param_result = 'FAIL' THEN 1 END)::INT AS fail_count,
          COUNT(CASE WHEN param_result = 'CONCESSION' THEN 1 END)::INT AS concession_count
        FROM tbl_qc_in_process_param
        WHERE is_active = TRUE
        GROUP BY ipqc_id
      ) p_stat ON p_stat.ipqc_id = h.ipqc_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY h.ipqc_id DESC;
    `;

    const res = await this.pool.query(sql, params);
    return res.rows.map((r) => ({
      ipqcId: Number(r.ipqc_id),
      ipqcNo: r.ipqc_no,
      ipqcDate: r.ipqc_date,
      woId: Number(r.wo_id),
      woNo: r.wo_no,
      jobCardId: r.job_card_id ? Number(r.job_card_id) : null,
      jobCardNo: r.job_card_no,
      opCode: r.op_code,
      opName: r.op_name,
      itemId: Number(r.item_id),
      itemCode: r.item_code,
      itemName: r.item_name,
      workCenterId: r.work_center_id ? Number(r.work_center_id) : null,
      wcCode: r.wc_code,
      wcName: r.wc_name,
      machineId: r.machine_id ? Number(r.machine_id) : null,
      machineCode: r.machine_code,
      machineName: r.machine_name,
      assignedOperatorId: r.assigned_operator_id
        ? Number(r.assigned_operator_id)
        : null,
      operatorName: r.operator_name,
      inspectorId: Number(r.inspector_id),
      inspectorName: r.inspector_name,
      inspectionStage: r.inspection_stage,
      shiftName: r.shift_name,
      batchNo: r.batch_no,
      heatNo: r.heat_no,
      lotQty: Number(r.lot_qty),
      sampleSize: Number(r.sample_size),
      acceptedQty: Number(r.accepted_qty),
      rejectedQty: Number(r.rejected_qty),
      reworkQty: Number(r.rework_qty),
      overallResult: r.overall_result,
      dispositionType: r.disposition_type,
      deviationReason: r.deviation_reason,
      approverId: r.approver_id ? Number(r.approver_id) : null,
      approverName: r.approver_name,
      approvalDate: r.approval_date,
      isCapaRequired: Boolean(r.is_capa_required),
      ncrNo: r.ncr_no,
      remarks: r.remarks,
      status: r.status,
      createdDate: r.created_date,
      paramCount: Number(r.param_count),
      passCount: Number(r.pass_count),
      failCount: Number(r.fail_count),
      concessionCount: Number(r.concession_count),
    }));
  }

  // --------------------------------------------------------------------------
  // Single Inspection Details (including all Characteristic Parameters)
  // --------------------------------------------------------------------------
  async findById(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const headerSql = `
      SELECT
        h.*,
        wo.wo_no,
        jc.job_card_no,
        jc.op_code,
        jc.op_name,
        it.item_code,
        it.item_name,
        wc.wc_code,
        wc.wc_name,
        mc.machine_code,
        mc.machine_name,
        op_user.full_name AS operator_name,
        insp_user.full_name AS inspector_name,
        appr_user.full_name AS approver_name
      FROM tbl_qc_in_process_header h
      JOIN tbl_mfg_wo_header wo ON wo.wo_id = h.wo_id
      LEFT JOIN tbl_mfg_job_card jc ON jc.job_card_id = h.job_card_id
      JOIN tbl_inv_item it ON it.item_id = h.item_id
      LEFT JOIN tbl_mfg_work_center wc ON wc.work_center_id = h.work_center_id
      LEFT JOIN tbl_mfg_work_center_machine mc ON mc.wc_machine_id = h.machine_id
      LEFT JOIN tbl_sec_user op_user ON op_user.user_id = h.assigned_operator_id
      LEFT JOIN tbl_sec_user insp_user ON insp_user.user_id = h.inspector_id
      LEFT JOIN tbl_sec_user appr_user ON appr_user.user_id = h.approver_id
      WHERE h.ipqc_id = $1 AND h.comp_id = $2 AND h.is_active = TRUE;
    `;

    const hRes = await this.pool.query(headerSql, [id, compId]);
    if (hRes.rows.length === 0) {
      throw new NotFoundException(`In-process QC record #${id} not found`);
    }
    const h = hRes.rows[0];

    const paramSql = `
      SELECT *
      FROM tbl_qc_in_process_param
      WHERE ipqc_id = $1 AND is_active = TRUE
      ORDER BY param_sequence ASC, ipqc_param_id ASC;
    `;

    const pRes = await this.pool.query(paramSql, [id]);

    return {
      ipqcId: Number(h.ipqc_id),
      ipqcNo: h.ipqc_no,
      ipqcDate: h.ipqc_date,
      woId: Number(h.wo_id),
      woNo: h.wo_no,
      jobCardId: h.job_card_id ? Number(h.job_card_id) : null,
      jobCardNo: h.job_card_no,
      opCode: h.op_code,
      opName: h.op_name,
      woRoutingOpId: h.wo_routing_op_id ? Number(h.wo_routing_op_id) : null,
      itemId: Number(h.item_id),
      itemCode: h.item_code,
      itemName: h.item_name,
      workCenterId: h.work_center_id ? Number(h.work_center_id) : null,
      wcCode: h.wc_code,
      wcName: h.wc_name,
      machineId: h.machine_id ? Number(h.machine_id) : null,
      machineCode: h.machine_code,
      machineName: h.machine_name,
      assignedOperatorId: h.assigned_operator_id
        ? Number(h.assigned_operator_id)
        : null,
      operatorName: h.operator_name,
      inspectorId: Number(h.inspector_id),
      inspectorName: h.inspector_name,
      inspectionStage: h.inspection_stage,
      shiftName: h.shift_name,
      batchNo: h.batch_no,
      heatNo: h.heat_no,
      lotQty: Number(h.lot_qty),
      sampleSize: Number(h.sample_size),
      acceptedQty: Number(h.accepted_qty),
      rejectedQty: Number(h.rejected_qty),
      reworkQty: Number(h.rework_qty),
      overallResult: h.overall_result,
      dispositionType: h.disposition_type,
      deviationReason: h.deviation_reason,
      approverId: h.approver_id ? Number(h.approver_id) : null,
      approverName: h.approver_name,
      approvalDate: h.approval_date,
      isCapaRequired: Boolean(h.is_capa_required),
      ncrNo: h.ncr_no,
      remarks: h.remarks,
      status: h.status,
      createdDate: h.created_date,
      params: pRes.rows.map((p) => ({
        ipqcParamId: Number(p.ipqc_param_id),
        ipqcId: Number(p.ipqc_id),
        paramSequence: Number(p.param_sequence),
        paramName: p.param_name,
        paramCategory: p.param_category,
        instrumentName: p.instrument_name,
        nominalVal: p.nominal_val !== null ? Number(p.nominal_val) : null,
        minTolerance:
          p.min_tolerance !== null ? Number(p.min_tolerance) : null,
        maxTolerance:
          p.max_tolerance !== null ? Number(p.max_tolerance) : null,
        uomCode: p.uom_code,
        obsVal1: p.obs_val_1 !== null ? Number(p.obs_val_1) : null,
        obsVal2: p.obs_val_2 !== null ? Number(p.obs_val_2) : null,
        obsVal3: p.obs_val_3 !== null ? Number(p.obs_val_3) : null,
        obsVal4: p.obs_val_4 !== null ? Number(p.obs_val_4) : null,
        obsVal5: p.obs_val_5 !== null ? Number(p.obs_val_5) : null,
        meanVal: p.mean_val !== null ? Number(p.mean_val) : null,
        visualResult: p.visual_result,
        paramResult: p.param_result,
        deviationRemarks: p.deviation_remarks,
      })),
    };
  }

  // --------------------------------------------------------------------------
  // Create In-Process QC Inspection
  // --------------------------------------------------------------------------
  async create(
    dto: CreateInProcessQcDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Auto-generate IPQC number if not provided
      let ipqcNo = dto.ipqcNo;
      if (!ipqcNo || !ipqcNo.trim()) {
        const countRes = await client.query(
          `SELECT nextval('seq_qc_in_process_id') AS next_val;`,
        );
        const seqVal = countRes.rows[0].next_val;
        ipqcNo = `IPQC-AHM-2627-${String(seqVal).padStart(4, '0')}`;
      }

      // Compute initial counts or overall result
      let overall = dto.overallResult || 'PENDING';
      let status = 'IN_PROGRESS';
      if (overall === 'ACCEPTED' || overall === 'ACCEPTED_UNDER_DEVIATION') {
        status = 'COMPLETED';
      }

      const headerInsertSql = `
        INSERT INTO tbl_qc_in_process_header (
          ipqc_no, ipqc_date, wo_id, job_card_id, wo_routing_op_id,
          item_id, work_center_id, machine_id, assigned_operator_id, inspector_id,
          inspection_stage, shift_name, batch_no, heat_no,
          lot_qty, sample_size, accepted_qty, rejected_qty, rework_qty,
          overall_result, disposition_type, deviation_reason, approver_id, approval_date,
          is_capa_required, ncr_no, remarks, status, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24,
          $25, $26, $27, $28, TRUE,
          $29, $30, $31, $32
        ) RETURNING ipqc_id;
      `;

      const hParams = [
        ipqcNo,
        dto.ipqcDate,
        dto.woId,
        dto.jobCardId || null,
        dto.woRoutingOpId || null,
        dto.itemId,
        dto.workCenterId || null,
        dto.machineId || null,
        dto.assignedOperatorId || null,
        dto.inspectorId || userId,
        dto.inspectionStage || 'STAGE_COMPLETION',
        dto.shiftName || 'Shift A',
        dto.batchNo || null,
        dto.heatNo || null,
        dto.lotQty || 0,
        dto.sampleSize || 5,
        dto.acceptedQty || 0,
        dto.rejectedQty || 0,
        dto.reworkQty || 0,
        overall,
        dto.dispositionType || 'DIRECT_ACCEPT',
        dto.deviationReason || null,
        overall !== 'PENDING' ? userId : null,
        overall !== 'PENDING' ? new Date() : null,
        dto.isCapaRequired ?? false,
        dto.ncrNo || null,
        dto.remarks || null,
        status,
        compId,
        branchId,
        user.fyearId || null,
        userId,
      ];

      const hRes = await client.query(headerInsertSql, hParams);
      const ipqcId = Number(hRes.rows[0].ipqc_id);

      // Insert parameters
      if (dto.params && dto.params.length > 0) {
        for (let i = 0; i < dto.params.length; i++) {
          const p = dto.params[i];
          const pInsertSql = `
            INSERT INTO tbl_qc_in_process_param (
              ipqc_id, param_sequence, param_name, param_category, instrument_name,
              nominal_val, min_tolerance, max_tolerance, uom_code,
              obs_val_1, obs_val_2, obs_val_3, obs_val_4, obs_val_5, mean_val,
              visual_result, param_result, deviation_remarks, is_active,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9,
              $10, $11, $12, $13, $14, $15,
              $16, $17, $18, TRUE,
              $19, $20, $21, $22
            );
          `;
          await client.query(pInsertSql, [
            ipqcId,
            p.paramSequence || i + 1,
            p.paramName,
            p.paramCategory || 'DIMENSIONAL',
            p.instrumentName || null,
            p.nominalVal ?? null,
            p.minTolerance ?? null,
            p.maxTolerance ?? null,
            p.uomCode || 'mm',
            p.obsVal1 ?? null,
            p.obsVal2 ?? null,
            p.obsVal3 ?? null,
            p.obsVal4 ?? null,
            p.obsVal5 ?? null,
            p.meanVal ?? null,
            p.visualResult || 'PASS',
            p.paramResult || 'PASS',
            p.deviationRemarks || null,
            compId,
            branchId,
            user.fyearId || null,
            userId,
          ]);
        }
      }

      // If linked to job card and completed, update job card
      if (dto.jobCardId && (overall === 'ACCEPTED' || overall === 'ACCEPTED_UNDER_DEVIATION' || overall === 'REJECTED')) {
        const jcStatus = overall === 'ACCEPTED_UNDER_DEVIATION' ? 'DEVIATION_ACCEPTED' : overall;
        await client.query(
          `UPDATE tbl_mfg_job_card
           SET in_process_qc_status = $1,
               qc_inspector_id = $2,
               qc_inspected_at = CURRENT_TIMESTAMP,
               qc_sample_size = $3,
               qc_accepted_qty = $4,
               qc_rejected_qty = $5,
               qc_remarks = $6
           WHERE job_card_id = $7;`,
          [
            jcStatus,
            userId,
            dto.sampleSize || 5,
            dto.acceptedQty || 0,
            dto.rejectedQty || 0,
            dto.remarks || `In-process QC verdict: ${overall}`,
            dto.jobCardId,
          ],
        );
      }

      await client.query('COMMIT');

      // Record audit log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'IN_PROCESS_QC',
        actionType: 'ADD',
        entityTable: 'tbl_qc_in_process_header',
        recordId: ipqcId,
        newValue: { ipqcNo, overall, lotQty: dto.lotQty },
        compId,
        branchId,
        fyearId: user.fyearId || null,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      return this.findById(ipqcId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Update In-Process QC Inspection
  // --------------------------------------------------------------------------
  async update(
    id: number,
    dto: UpdateInProcessQcDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId;

    const existing = await this.findById(id, user);
    if (existing.status === 'COMPLETED' && existing.overallResult !== 'PENDING') {
      throw new BadRequestException(
        `Inspection #${existing.ipqcNo} is already completed. Use Concession/Deviation or Approval modal to record formal adjustments.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const updateHeaderSql = `
        UPDATE tbl_qc_in_process_header
        SET ipqc_date = COALESCE($1, ipqc_date),
            wo_id = COALESCE($2, wo_id),
            job_card_id = COALESCE($3, job_card_id),
            wo_routing_op_id = COALESCE($4, wo_routing_op_id),
            item_id = COALESCE($5, item_id),
            work_center_id = COALESCE($6, work_center_id),
            machine_id = COALESCE($7, machine_id),
            assigned_operator_id = COALESCE($8, assigned_operator_id),
            inspector_id = COALESCE($9, inspector_id),
            inspection_stage = COALESCE($10, inspection_stage),
            shift_name = COALESCE($11, shift_name),
            batch_no = COALESCE($12, batch_no),
            heat_no = COALESCE($13, heat_no),
            lot_qty = COALESCE($14, lot_qty),
            sample_size = COALESCE($15, sample_size),
            accepted_qty = COALESCE($16, accepted_qty),
            rejected_qty = COALESCE($17, rejected_qty),
            rework_qty = COALESCE($18, rework_qty),
            overall_result = COALESCE($19, overall_result),
            disposition_type = COALESCE($20, disposition_type),
            deviation_reason = COALESCE($21, deviation_reason),
            is_capa_required = COALESCE($22, is_capa_required),
            ncr_no = COALESCE($23, ncr_no),
            remarks = COALESCE($24, remarks),
            updated_by = $25,
            updated_date = CURRENT_TIMESTAMP
        WHERE ipqc_id = $26 AND comp_id = $27;
      `;

      await client.query(updateHeaderSql, [
        dto.ipqcDate || null,
        dto.woId || null,
        dto.jobCardId || null,
        dto.woRoutingOpId || null,
        dto.itemId || null,
        dto.workCenterId || null,
        dto.machineId || null,
        dto.assignedOperatorId || null,
        dto.inspectorId || null,
        dto.inspectionStage || null,
        dto.shiftName || null,
        dto.batchNo || null,
        dto.heatNo || null,
        dto.lotQty ?? null,
        dto.sampleSize ?? null,
        dto.acceptedQty ?? null,
        dto.rejectedQty ?? null,
        dto.reworkQty ?? null,
        dto.overallResult || null,
        dto.dispositionType || null,
        dto.deviationReason || null,
        dto.isCapaRequired ?? null,
        dto.ncrNo || null,
        dto.remarks || null,
        userId,
        id,
        compId,
      ]);

      // If params are passed, replace them
      if (dto.params && dto.params.length > 0) {
        await client.query(
          `DELETE FROM tbl_qc_in_process_param WHERE ipqc_id = $1;`,
          [id],
        );

        for (let i = 0; i < dto.params.length; i++) {
          const p = dto.params[i];
          const pInsertSql = `
            INSERT INTO tbl_qc_in_process_param (
              ipqc_id, param_sequence, param_name, param_category, instrument_name,
              nominal_val, min_tolerance, max_tolerance, uom_code,
              obs_val_1, obs_val_2, obs_val_3, obs_val_4, obs_val_5, mean_val,
              visual_result, param_result, deviation_remarks, is_active,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9,
              $10, $11, $12, $13, $14, $15,
              $16, $17, $18, TRUE,
              $19, $20, $21, $22
            );
          `;
          await client.query(pInsertSql, [
            id,
            p.paramSequence || i + 1,
            p.paramName,
            p.paramCategory || 'DIMENSIONAL',
            p.instrumentName || null,
            p.nominalVal ?? null,
            p.minTolerance ?? null,
            p.maxTolerance ?? null,
            p.uomCode || 'mm',
            p.obsVal1 ?? null,
            p.obsVal2 ?? null,
            p.obsVal3 ?? null,
            p.obsVal4 ?? null,
            p.obsVal5 ?? null,
            p.meanVal ?? null,
            p.visualResult || 'PASS',
            p.paramResult || 'PASS',
            p.deviationRemarks || null,
            compId,
            user.branchId || 1001,
            user.fyearId || null,
            userId,
          ]);
        }
      }

      await client.query('COMMIT');

      // Record audit log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'IN_PROCESS_QC',
        actionType: 'EDIT',
        entityTable: 'tbl_qc_in_process_header',
        recordId: id,
        oldValue: { status: existing.status, overallResult: existing.overallResult },
        newValue: dto,
        compId,
        branchId: user.branchId || 1001,
        fyearId: user.fyearId || null,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      return this.findById(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Approve / Reject Stage Inspection & Gating
  // --------------------------------------------------------------------------
  async approve(
    id: number,
    dto: ApproveInProcessQcDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId;

    const existing = await this.findById(id, user);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const updateSql = `
        UPDATE tbl_qc_in_process_header
        SET overall_result = $1,
            accepted_qty = $2,
            rejected_qty = $3,
            rework_qty = $4,
            disposition_type = $5,
            deviation_reason = $6,
            is_capa_required = $7,
            ncr_no = $8,
            remarks = COALESCE($9, remarks),
            approver_id = $10,
            approval_date = CURRENT_TIMESTAMP,
            status = 'COMPLETED',
            updated_by = $10,
            updated_date = CURRENT_TIMESTAMP
        WHERE ipqc_id = $11 AND comp_id = $12;
      `;

      await client.query(updateSql, [
        dto.overallResult,
        dto.acceptedQty,
        dto.rejectedQty,
        dto.reworkQty || 0,
        dto.dispositionType,
        dto.deviationReason || null,
        dto.isCapaRequired ?? false,
        dto.ncrNo || null,
        dto.remarks || null,
        userId,
        id,
        compId,
      ]);

      // Update linked Job Card
      if (existing.jobCardId) {
        const jcQcStatus =
          dto.overallResult === 'ACCEPTED_UNDER_DEVIATION'
            ? 'DEVIATION_ACCEPTED'
            : dto.overallResult;

        await client.query(
          `UPDATE tbl_mfg_job_card
           SET in_process_qc_status = $1,
               qc_inspector_id = $2,
               qc_inspected_at = CURRENT_TIMESTAMP,
               qc_sample_size = $3,
               qc_accepted_qty = $4,
               qc_rejected_qty = $5,
               qc_remarks = $6
           WHERE job_card_id = $7;`,
          [
            jcQcStatus,
            userId,
            existing.sampleSize,
            dto.acceptedQty,
            dto.rejectedQty,
            dto.remarks || dto.deviationReason || `Inspection Verdict: ${dto.overallResult}`,
            existing.jobCardId,
          ],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'IN_PROCESS_QC',
        actionType: 'APPROVE',
        entityTable: 'tbl_qc_in_process_header',
        recordId: id,
        oldValue: { overallResult: existing.overallResult, status: existing.status },
        newValue: { overallResult: dto.overallResult, acceptedQty: dto.acceptedQty, rejectedQty: dto.rejectedQty },
        compId,
        branchId: user.branchId || 1001,
        fyearId: user.fyearId || null,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      return this.findById(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Grant Concession / Deviation Clearance
  // --------------------------------------------------------------------------
  async grantDeviation(
    id: number,
    dto: GrantDeviationDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId;

    const existing = await this.findById(id, user);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const updateSql = `
        UPDATE tbl_qc_in_process_header
        SET overall_result = 'ACCEPTED_UNDER_DEVIATION',
            disposition_type = $1,
            deviation_reason = $2,
            remarks = COALESCE($3, remarks),
            approver_id = $4,
            approval_date = CURRENT_TIMESTAMP,
            status = 'COMPLETED',
            updated_by = $4,
            updated_date = CURRENT_TIMESTAMP
        WHERE ipqc_id = $5 AND comp_id = $6;
      `;

      await client.query(updateSql, [
        dto.dispositionType || 'CONCESSION_USE_AS_IS',
        dto.deviationReason,
        dto.remarks || null,
        userId,
        id,
        compId,
      ]);

      if (existing.jobCardId) {
        await client.query(
          `UPDATE tbl_mfg_job_card
           SET in_process_qc_status = 'DEVIATION_ACCEPTED',
               qc_inspector_id = $1,
               qc_inspected_at = CURRENT_TIMESTAMP,
               qc_remarks = $2
           WHERE job_card_id = $3;`,
          [
            userId,
            `Concession Approved: ${dto.deviationReason}`,
            existing.jobCardId,
          ],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'IN_PROCESS_QC',
        actionType: 'DEVIATION',
        entityTable: 'tbl_qc_in_process_header',
        recordId: id,
        oldValue: { overallResult: existing.overallResult },
        newValue: { overallResult: 'ACCEPTED_UNDER_DEVIATION', deviationReason: dto.deviationReason },
        compId,
        branchId: user.branchId || 1001,
        fyearId: user.fyearId || null,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      return this.findById(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Delete / Cancel Inspection
  // --------------------------------------------------------------------------
  async delete(id: number, user: AuthenticatedUserContext, meta?: any) {
    const compId = user.compId || 1001;
    const userId = user.userId;

    const existing = await this.findById(id, user);
    if (existing.status === 'COMPLETED' && existing.overallResult === 'ACCEPTED') {
      throw new BadRequestException(
        `Cannot delete a completed and approved inspection record (#${existing.ipqcNo}).`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Soft delete
      await client.query(
        `UPDATE tbl_qc_in_process_header
         SET is_active = FALSE, status = 'CANCELLED', updated_by = $1, updated_date = CURRENT_TIMESTAMP
         WHERE ipqc_id = $2 AND comp_id = $3;`,
        [userId, id, compId],
      );

      await client.query(
        `UPDATE tbl_qc_in_process_param
         SET is_active = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP
         WHERE ipqc_id = $2;`,
        [userId, id],
      );

      // Reset job card QC status if linked
      if (existing.jobCardId) {
        await client.query(
          `UPDATE tbl_mfg_job_card
           SET in_process_qc_status = 'PENDING'
           WHERE job_card_id = $1 AND in_process_qc_status != 'NA';`,
          [existing.jobCardId],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'IN_PROCESS_QC',
        actionType: 'DELETE',
        entityTable: 'tbl_qc_in_process_header',
        recordId: id,
        oldValue: { ipqcNo: existing.ipqcNo },
        compId,
        branchId: user.branchId || 1001,
        fyearId: user.fyearId || null,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      return { success: true, message: `Inspection #${existing.ipqcNo} cancelled successfully.` };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
