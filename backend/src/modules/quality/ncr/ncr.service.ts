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
  AuthorizeDispositionDto,
  CastMrbVoteDto,
  CloseCapaActionDto,
  CreateCapaActionDto,
  CreateNcrDto,
  NcrFilterDto,
  UpdateNcrDto,
} from './ncr.dto';

@Injectable()
export class NcrService {
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
        COUNT(*)::INT AS total_ncrs,
        COUNT(CASE WHEN status = 'UNDER_MRB_REVIEW' OR (status = 'DRAFT' AND mrb_disposition = 'PENDING') THEN 1 END)::INT AS under_mrb_review,
        COUNT(CASE WHEN status = 'CAPA_ASSIGNED' OR capa_status IN ('INITIATED', 'UNDER_INVESTIGATION') THEN 1 END)::INT AS capa_active,
        COUNT(CASE WHEN status = 'CLOSED' THEN 1 END)::INT AS closed_count,
        COUNT(CASE WHEN mrb_disposition = 'SCRAP' THEN 1 END)::INT AS scrap_count,
        COUNT(CASE WHEN mrb_disposition IN ('REWORK_SAME_OP', 'REWORK_NEW_OP') THEN 1 END)::INT AS rework_count,
        COUNT(CASE WHEN mrb_disposition = 'RETURN_TO_VENDOR' THEN 1 END)::INT AS return_to_vendor_count
      FROM tbl_qc_ncr_header
      WHERE comp_id = $1 AND is_active = TRUE
        AND ($2::BIGINT IS NULL OR branch_id = $2::BIGINT);
    `;

    const res = await this.pool.query(sql, [compId, branchId]);
    const r = res.rows[0] || {};
    return {
      totalNcrs: Number(r.total_ncrs || 0),
      underMrbReview: Number(r.under_mrb_review || 0),
      capaActive: Number(r.capa_active || 0),
      closedCount: Number(r.closed_count || 0),
      scrapCount: Number(r.scrap_count || 0),
      reworkCount: Number(r.rework_count || 0),
      returnToVendorCount: Number(r.return_to_vendor_count || 0),
    };
  }

  // --------------------------------------------------------------------------
  // Lookups
  // --------------------------------------------------------------------------
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const [itemsRes, uomsRes, usersRes] = await Promise.all([
      this.pool.query(
        `SELECT item_id, item_code, item_name, uom_id
         FROM tbl_inv_item
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY item_name ASC LIMIT 200`,
        [compId],
      ),
      this.pool.query(
        `SELECT uom_id, uom_code, uom_name
         FROM tbl_inv_uom
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY uom_code ASC`,
        [compId],
      ),
      this.pool.query(
        `SELECT user_id, user_name, full_name, role_id
         FROM tbl_sec_user
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY full_name ASC`,
        [compId],
      ),
    ]);

    return {
      items: itemsRes.rows.map((r) => ({
        itemId: Number(r.item_id),
        itemCode: r.item_code,
        itemName: r.item_name,
        uomId: Number(r.uom_id),
      })),
      uoms: uomsRes.rows.map((r) => ({
        uomId: Number(r.uom_id),
        uomCode: r.uom_code,
        uomName: r.uom_name,
      })),
      users: usersRes.rows.map((r) => ({
        userId: Number(r.user_id),
        userName: r.user_name,
        fullName: r.full_name,
        roleId: Number(r.role_id),
      })),
      ncrTypes: [
        { value: 'INWARD_REJECTION', label: 'Inward Material Rejection (IQC)' },
        { value: 'IN_PROCESS_DEFECT', label: 'In-Process Line Defect (IPQC)' },
        { value: 'PDI_FAILURE', label: 'Pre-Dispatch Final Inspection Failure (PDI)' },
        { value: 'CUSTOMER_RMA_RETURN', label: 'Customer RMA / Warranty Rejection' },
        { value: 'INTERNAL_AUDIT', label: 'Internal Quality System Audit Finding' },
      ],
      defectSeverities: [
        { value: 'CRITICAL', label: 'Critical (Safety/Function Failure - Immediate Halt)' },
        { value: 'MAJOR', label: 'Major (Significant Drawing Out-of-Tolerance)' },
        { value: 'MINOR', label: 'Minor (Cosmetic / Packaging Non-Conformance)' },
      ],
      defectCategories: [
        { value: 'DIMENSIONAL', label: 'Dimensional Out of Tolerance' },
        { value: 'METALLURGICAL', label: 'Metallurgical / Material Property Flaw' },
        { value: 'SURFACE_FINISH', label: 'Surface Finish / Coating Imperfection' },
        { value: 'PRESSURE_LEAK', label: 'Pressure Test / Sealing Leakage' },
        { value: 'VISUAL_PACKAGING', label: 'Visual Defect / Marking / Packaging' },
        { value: 'DOCUMENTATION', label: 'Documentation / MTC Certificate Error' },
        { value: 'ASSEMBLY_FIT', label: 'Assembly Interference / Fitment' },
      ],
      mrbDispositions: [
        { value: 'PENDING', label: 'Pending MRB Review' },
        { value: 'RETURN_TO_VENDOR', label: 'Return to Vendor (RTV / Debit Note)' },
        { value: 'REWORK_SAME_OP', label: 'Rework (Standard Line Operation)' },
        { value: 'REWORK_NEW_OP', label: 'Rework (Special Salvage Routing)' },
        { value: 'USE_AS_IS_CONCESSION', label: 'Use As-Is Under Engineering Concession' },
        { value: 'SCRAP', label: 'Scrap & Condemn (Total Write-Off)' },
      ],
      ncrStatuses: [
        { value: 'DRAFT', label: 'Draft / Logged' },
        { value: 'UNDER_MRB_REVIEW', label: 'Under MRB Review' },
        { value: 'DISPOSITIONED', label: 'Disposition Finalized' },
        { value: 'CAPA_ASSIGNED', label: '8D CAPA Action Assigned' },
        { value: 'CLOSED', label: 'Closed & Verified' },
        { value: 'CANCELLED', label: 'Cancelled' },
      ],
    };
  }

  // --------------------------------------------------------------------------
  // List NCRs
  // --------------------------------------------------------------------------
  async findAll(filter: NcrFilterDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filter.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['h.comp_id = $1', 'h.is_active = TRUE'];
    const params: any[] = [compId];
    let pIdx = 2;

    if (branchId) {
      conditions.push(`h.branch_id = $${pIdx}`);
      params.push(branchId);
      pIdx++;
    }

    if (filter.status) {
      conditions.push(`h.status = $${pIdx}`);
      params.push(filter.status);
      pIdx++;
    }

    if (filter.ncrType) {
      conditions.push(`h.ncr_type = $${pIdx}`);
      params.push(filter.ncrType);
      pIdx++;
    }

    if (filter.defectSeverity) {
      conditions.push(`h.defect_severity = $${pIdx}`);
      params.push(filter.defectSeverity);
      pIdx++;
    }

    if (filter.defectCategory) {
      conditions.push(`h.defect_category = $${pIdx}`);
      params.push(filter.defectCategory);
      pIdx++;
    }

    if (filter.mrbDisposition) {
      conditions.push(`h.mrb_disposition = $${pIdx}`);
      params.push(filter.mrbDisposition);
      pIdx++;
    }

    if (filter.search) {
      conditions.push(
        `(h.ncr_no ILIKE $${pIdx} OR h.item_code ILIKE $${pIdx} OR h.item_name ILIKE $${pIdx} OR h.red_tag_no ILIKE $${pIdx} OR h.defect_description ILIKE $${pIdx})`,
      );
      params.push(`%${filter.search}%`);
      pIdx++;
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `
      SELECT COUNT(*)::INT AS total
      FROM tbl_qc_ncr_header h
      WHERE ${whereClause};
    `;
    const countRes = await this.pool.query(countSql, params);
    const total = Number(countRes.rows[0]?.total || 0);

    const dataSql = `
      SELECT
        h.ncr_id,
        h.ncr_no,
        h.ncr_date,
        h.ncr_type,
        h.source_doc_type,
        h.source_doc_id,
        h.source_doc_no,
        h.source_doc_date,
        h.item_id,
        h.item_code,
        h.item_name,
        h.batch_no,
        h.heat_no,
        h.defect_severity,
        h.defect_category,
        h.defect_description,
        h.inspected_qty,
        h.rejected_qty,
        h.uom_id,
        h.uom_code,
        h.containment_action,
        h.quarantine_location,
        h.red_tag_no,
        h.mrb_disposition,
        h.mrb_approver_id,
        h.mrb_approver_name,
        h.mrb_approval_date,
        h.mrb_notes,
        h.is_capa_required,
        h.capa_status,
        h.status,
        h.created_by,
        h.created_date,
        (SELECT COUNT(*)::INT FROM tbl_qc_ncr_mrb_vote v WHERE v.ncr_id = h.ncr_id AND v.is_active = TRUE) AS vote_count,
        (SELECT c.capa_no FROM tbl_qc_capa_action c WHERE c.ncr_id = h.ncr_id AND c.is_active = TRUE ORDER BY c.capa_id DESC LIMIT 1) AS linked_capa_no
      FROM tbl_qc_ncr_header h
      WHERE ${whereClause}
      ORDER BY h.ncr_id DESC
      LIMIT $${pIdx} OFFSET $${pIdx + 1};
    `;
    params.push(limit, offset);

    const dataRes = await this.pool.query(dataSql, params);

    return {
      items: dataRes.rows.map((r) => this.mapNcrRow(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // --------------------------------------------------------------------------
  // Find by ID
  // --------------------------------------------------------------------------
  async findById(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const ncrRes = await this.pool.query(
      `SELECT h.*
       FROM tbl_qc_ncr_header h
       WHERE h.ncr_id = $1 AND h.comp_id = $2 AND h.is_active = TRUE`,
      [id, compId],
    );

    if (ncrRes.rowCount === 0) {
      throw new NotFoundException(`NCR #${id} not found.`);
    }

    const ncr = this.mapNcrRow(ncrRes.rows[0]);

    // Fetch MRB votes
    const votesRes = await this.pool.query(
      `SELECT vote_id, ncr_id, voter_id, voter_name, voter_role,
              recommended_disposition, vote_comments, voted_at
       FROM tbl_qc_ncr_mrb_vote
       WHERE ncr_id = $1 AND is_active = TRUE
       ORDER BY vote_id ASC`,
      [id],
    );

    // Fetch CAPA action(s)
    const capaRes = await this.pool.query(
      `SELECT capa_id, capa_no, ncr_id, initiation_date, target_completion_date, actual_closure_date,
              root_cause_method, root_cause_analysis, containment_action_plan, corrective_action_plan,
              preventive_action_plan, assigned_to_id, assigned_to_name, verifier_id, verifier_name,
              verification_remarks, effectiveness_status, status
       FROM tbl_qc_capa_action
       WHERE ncr_id = $1 AND is_active = TRUE
       ORDER BY capa_id DESC`,
      [id],
    );

    return {
      ...ncr,
      mrbVotes: votesRes.rows.map((v) => ({
        voteId: Number(v.vote_id),
        ncrId: Number(v.ncr_id),
        voterId: Number(v.voter_id),
        voterName: v.voter_name,
        voterRole: v.voter_role,
        recommendedDisposition: v.recommended_disposition,
        voteComments: v.vote_comments,
        votedAt: v.voted_at,
      })),
      capaActions: capaRes.rows.map((c) => ({
        capaId: Number(c.capa_id),
        capaNo: c.capa_no,
        ncrId: Number(c.ncr_id),
        initiationDate: c.initiation_date,
        targetCompletionDate: c.target_completion_date,
        actualClosureDate: c.actual_closure_date,
        rootCauseMethod: c.root_cause_method,
        rootCauseAnalysis: c.root_cause_analysis,
        containmentActionPlan: c.containment_action_plan,
        correctiveActionPlan: c.corrective_action_plan,
        preventiveActionPlan: c.preventive_action_plan,
        assignedToId: Number(c.assigned_to_id),
        assignedToName: c.assigned_to_name,
        verifierId: c.verifier_id ? Number(c.verifier_id) : null,
        verifierName: c.verifier_name,
        verificationRemarks: c.verification_remarks,
        effectivenessStatus: c.effectiveness_status,
        status: c.status,
      })),
    };
  }

  // --------------------------------------------------------------------------
  // Create NCR
  // --------------------------------------------------------------------------
  async create(dto: CreateNcrDto, user: AuthenticatedUserContext, meta?: any) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    // Validate Item
    const itemRes = await this.pool.query(
      `SELECT item_code, item_name, uom_id FROM tbl_inv_item WHERE item_id = $1 AND comp_id = $2`,
      [dto.itemId, compId],
    );
    if (itemRes.rowCount === 0) {
      throw new BadRequestException(`Item #${dto.itemId} does not exist.`);
    }
    const item = itemRes.rows[0];

    // Validate UOM
    const uomId = dto.uomId || item.uom_id;
    const uomRes = await this.pool.query(
      `SELECT uom_code FROM tbl_inv_uom WHERE uom_id = $1`,
      [uomId],
    );
    const uomCode = uomRes.rows[0]?.uom_code || 'NOS';

    // Generate NCR No
    const countRes = await this.pool.query(
      `SELECT COUNT(*)::INT AS seq FROM tbl_qc_ncr_header WHERE comp_id = $1`,
      [compId],
    );
    const nextSeq = Number(countRes.rows[0]?.seq || 0) + 1;
    const ncrNo = `NCR-AHM-2627-${String(nextSeq).padStart(4, '0')}`;
    const ncrDate = dto.ncrDate || new Date().toISOString().slice(0, 10);
    const redTagNo = dto.redTagNo || `TAG-RED-${String(nextSeq).padStart(4, '0')}`;

    const insertSql = `
      INSERT INTO tbl_qc_ncr_header (
        ncr_no, ncr_date, ncr_type, source_doc_type, source_doc_id, source_doc_no, source_doc_date,
        item_id, item_code, item_name, batch_no, heat_no, defect_severity, defect_category,
        defect_description, inspected_qty, rejected_qty, uom_id, uom_code, containment_action,
        quarantine_location, red_tag_no, mrb_disposition, is_capa_required, capa_status, status,
        comp_id, branch_id, fyear_id, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21, $22, 'PENDING', $23, 'NOT_INITIATED', 'DRAFT',
        $24, $25, 1001, $26
      )
      RETURNING ncr_id;
    `;

    const insertRes = await this.pool.query(insertSql, [
      ncrNo,
      ncrDate,
      dto.ncrType,
      dto.sourceDocType || 'IN_PROCESS_QC',
      dto.sourceDocId || null,
      dto.sourceDocNo || null,
      dto.sourceDocDate || null,
      dto.itemId,
      item.item_code,
      item.item_name,
      dto.batchNo || null,
      dto.heatNo || null,
      dto.defectSeverity,
      dto.defectCategory,
      dto.defectDescription,
      dto.inspectedQty,
      dto.rejectedQty,
      uomId,
      uomCode,
      dto.containmentAction || 'Immediate quarantine hold in inspection bay',
      dto.quarantineLocation || 'Quarantine Bay A1 (Red Tagged)',
      redTagNo,
      dto.isCapaRequired ?? true,
      compId,
      branchId,
      userId,
    ]);

    const ncrId = Number(insertRes.rows[0].ncr_id);

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'NCR_QC',
      actionType: 'ADD',
      entityTable: 'tbl_qc_ncr_header',
      recordId: ncrId,
      newValue: { ncrId, ncrNo, ...dto },
      compId,
      branchId,
      fyearId: user.fyearId || null,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    return this.findById(ncrId, user);
  }

  // --------------------------------------------------------------------------
  // Update NCR
  // --------------------------------------------------------------------------
  async update(id: number, dto: UpdateNcrDto, user: AuthenticatedUserContext, meta?: any) {
    const existing = await this.findById(id, user);
    if (existing.status === 'CLOSED' || existing.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot edit NCR #${existing.ncrNo} in ${existing.status} status.`);
    }

    const userId = user.userId || 1001;
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    let itemCode = existing.itemCode;
    let itemName = existing.itemName;
    let uomCode = existing.uomCode;

    if (dto.itemId && dto.itemId !== existing.itemId) {
      const itemRes = await this.pool.query(
        `SELECT item_code, item_name, uom_id FROM tbl_inv_item WHERE item_id = $1`,
        [dto.itemId],
      );
      if (itemRes.rowCount > 0) {
        itemCode = itemRes.rows[0].item_code;
        itemName = itemRes.rows[0].item_name;
      }
    }

    if (dto.uomId && dto.uomId !== existing.uomId) {
      const uomRes = await this.pool.query(
        `SELECT uom_code FROM tbl_inv_uom WHERE uom_id = $1`,
        [dto.uomId],
      );
      if (uomRes.rowCount > 0) {
        uomCode = uomRes.rows[0].uom_code;
      }
    }

    const updateSql = `
      UPDATE tbl_qc_ncr_header
      SET
        ncr_date = COALESCE($1, ncr_date),
        ncr_type = COALESCE($2, ncr_type),
        source_doc_type = COALESCE($3, source_doc_type),
        source_doc_id = COALESCE($4, source_doc_id),
        source_doc_no = COALESCE($5, source_doc_no),
        source_doc_date = COALESCE($6, source_doc_date),
        item_id = COALESCE($7, item_id),
        item_code = $8,
        item_name = $9,
        batch_no = COALESCE($10, batch_no),
        heat_no = COALESCE($11, heat_no),
        defect_severity = COALESCE($12, defect_severity),
        defect_category = COALESCE($13, defect_category),
        defect_description = COALESCE($14, defect_description),
        inspected_qty = COALESCE($15, inspected_qty),
        rejected_qty = COALESCE($16, rejected_qty),
        uom_id = COALESCE($17, uom_id),
        uom_code = $18,
        containment_action = COALESCE($19, containment_action),
        quarantine_location = COALESCE($20, quarantine_location),
        red_tag_no = COALESCE($21, red_tag_no),
        is_capa_required = COALESCE($22, is_capa_required),
        status = COALESCE($23, status),
        updated_by = $24,
        updated_date = CURRENT_TIMESTAMP
      WHERE ncr_id = $25;
    `;

    await this.pool.query(updateSql, [
      dto.ncrDate || null,
      dto.ncrType || null,
      dto.sourceDocType || null,
      dto.sourceDocId || null,
      dto.sourceDocNo || null,
      dto.sourceDocDate || null,
      dto.itemId || null,
      itemCode,
      itemName,
      dto.batchNo || null,
      dto.heatNo || null,
      dto.defectSeverity || null,
      dto.defectCategory || null,
      dto.defectDescription || null,
      dto.inspectedQty ?? null,
      dto.rejectedQty ?? null,
      dto.uomId || null,
      uomCode,
      dto.containmentAction || null,
      dto.quarantineLocation || null,
      dto.redTagNo || null,
      dto.isCapaRequired ?? null,
      dto.status || null,
      userId,
      id,
    ]);

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'NCR_QC',
      actionType: 'EDIT',
      entityTable: 'tbl_qc_ncr_header',
      recordId: id,
      oldValue: existing,
      newValue: dto,
      compId,
      branchId,
      fyearId: user.fyearId || null,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    return this.findById(id, user);
  }

  // --------------------------------------------------------------------------
  // Cast MRB Vote
  // --------------------------------------------------------------------------
  async castMrbVote(id: number, dto: CastMrbVoteDto, user: AuthenticatedUserContext, meta?: any) {
    const existing = await this.findById(id, user);
    const userId = user.userId || 1001;
    const voterName = user.username || 'Reviewer';
    const voterRole = 'MRB Member';

    // Insert or update vote
    const voteSql = `
      INSERT INTO tbl_qc_ncr_mrb_vote (
        ncr_id, voter_id, voter_name, voter_role,
        recommended_disposition, vote_comments,
        comp_id, branch_id, fyear_id, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 1001, $9
      )
      RETURNING vote_id;
    `;

    await this.pool.query(voteSql, [
      id,
      userId,
      voterName,
      voterRole,
      dto.recommendedDisposition,
      dto.voteComments || null,
      user.compId || 1001,
      user.branchId || 1001,
      userId,
    ]);

    // Advance status to UNDER_MRB_REVIEW if currently DRAFT
    if (existing.status === 'DRAFT') {
      await this.pool.query(
        `UPDATE tbl_qc_ncr_header SET status = 'UNDER_MRB_REVIEW', updated_by = $1, updated_date = CURRENT_TIMESTAMP WHERE ncr_id = $2`,
        [userId, id],
      );
    }

    return this.findById(id, user);
  }

  // --------------------------------------------------------------------------
  // Authorize Final MRB Disposition
  // --------------------------------------------------------------------------
  async authorizeDisposition(
    id: number,
    dto: AuthorizeDispositionDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const existing = await this.findById(id, user);
    const userId = user.userId || 1001;
    const approverName = user.username || 'Authorized Approver';
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const isCapaRequired = dto.isCapaRequired ?? existing.isCapaRequired;
    let nextStatus = 'DISPOSITIONED';
    let capaStatus = existing.capaStatus;

    if (isCapaRequired) {
      nextStatus = 'CAPA_ASSIGNED';
      if (capaStatus === 'NOT_INITIATED') {
        capaStatus = 'INITIATED';
      }
    } else if (dto.mrbDisposition === 'USE_AS_IS_CONCESSION') {
      nextStatus = 'CLOSED';
    }

    const sql = `
      UPDATE tbl_qc_ncr_header
      SET
        mrb_disposition = $1,
        mrb_approver_id = $2,
        mrb_approver_name = $3,
        mrb_approval_date = CURRENT_TIMESTAMP,
        mrb_notes = $4,
        is_capa_required = $5,
        capa_status = $6,
        status = $7,
        updated_by = $8,
        updated_date = CURRENT_TIMESTAMP
      WHERE ncr_id = $9;
    `;

    await this.pool.query(sql, [
      dto.mrbDisposition,
      userId,
      approverName,
      dto.mrbNotes || null,
      isCapaRequired,
      capaStatus,
      nextStatus,
      userId,
      id,
    ]);

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'NCR_QC',
      actionType: 'DISPOSITION',
      entityTable: 'tbl_qc_ncr_header',
      recordId: id,
      oldValue: { mrbDisposition: existing.mrbDisposition, status: existing.status },
      newValue: { ...dto, nextStatus },
      compId,
      branchId,
      fyearId: user.fyearId || null,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    return this.findById(id, user);
  }

  // --------------------------------------------------------------------------
  // Create / Update 8D CAPA Action
  // --------------------------------------------------------------------------
  async createOrUpdateCapa(
    ncrId: number,
    dto: CreateCapaActionDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const ncr = await this.findById(ncrId, user);
    const userId = user.userId || 1001;
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // Get assigned user details
    const userRes = await this.pool.query(
      `SELECT full_name, user_name FROM tbl_sec_user WHERE user_id = $1`,
      [dto.assignedToId],
    );
    const assignedName = userRes.rows[0]?.full_name || userRes.rows[0]?.user_name || 'QA Engineer';

    // Check if CAPA already exists for this NCR
    const existingCapa = ncr.capaActions && ncr.capaActions.length > 0 ? ncr.capaActions[0] : null;

    if (existingCapa) {
      // Update existing
      const updateSql = `
        UPDATE tbl_qc_capa_action
        SET
          target_completion_date = $1,
          root_cause_method = COALESCE($2, root_cause_method),
          root_cause_analysis = $3,
          containment_action_plan = $4,
          corrective_action_plan = $5,
          preventive_action_plan = $6,
          assigned_to_id = $7,
          assigned_to_name = $8,
          status = 'IN_PROGRESS',
          effectiveness_status = 'PENDING',
          updated_by = $9,
          updated_date = CURRENT_TIMESTAMP
        WHERE capa_id = $10;
      `;
      await this.pool.query(updateSql, [
        dto.targetCompletionDate,
        dto.rootCauseMethod || '5_WHY',
        dto.rootCauseAnalysis,
        dto.containmentActionPlan || null,
        dto.correctiveActionPlan,
        dto.preventiveActionPlan,
        dto.assignedToId,
        assignedName,
        userId,
        existingCapa.capaId,
      ]);

      await this.pool.query(
        `UPDATE tbl_qc_ncr_header SET capa_status = 'UNDER_INVESTIGATION', status = 'CAPA_ASSIGNED', updated_by = $1, updated_date = CURRENT_TIMESTAMP WHERE ncr_id = $2`,
        [userId, ncrId],
      );

      return this.findById(ncrId, user);
    } else {
      // Create new
      const countRes = await this.pool.query(
        `SELECT COUNT(*)::INT AS seq FROM tbl_qc_capa_action WHERE comp_id = $1`,
        [compId],
      );
      const nextSeq = Number(countRes.rows[0]?.seq || 0) + 1;
      const capaNo = `CAPA-AHM-2627-${String(nextSeq).padStart(4, '0')}`;

      const insertSql = `
        INSERT INTO tbl_qc_capa_action (
          capa_no, ncr_id, initiation_date, target_completion_date,
          root_cause_method, root_cause_analysis, containment_action_plan,
          corrective_action_plan, preventive_action_plan, assigned_to_id, assigned_to_name,
          effectiveness_status, status, comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, CURRENT_DATE, $3,
          $4, $5, $6,
          $7, $8, $9, $10,
          'PENDING', 'IN_PROGRESS', $11, $12, 1001, $13
        );
      `;
      await this.pool.query(insertSql, [
        capaNo,
        ncrId,
        dto.targetCompletionDate,
        dto.rootCauseMethod || '5_WHY',
        dto.rootCauseAnalysis,
        dto.containmentActionPlan || null,
        dto.correctiveActionPlan,
        dto.preventiveActionPlan,
        dto.assignedToId,
        assignedName,
        compId,
        branchId,
        userId,
      ]);

      await this.pool.query(
        `UPDATE tbl_qc_ncr_header SET capa_status = 'UNDER_INVESTIGATION', status = 'CAPA_ASSIGNED', updated_by = $1, updated_date = CURRENT_TIMESTAMP WHERE ncr_id = $2`,
        [userId, ncrId],
      );

      return this.findById(ncrId, user);
    }
  }

  // --------------------------------------------------------------------------
  // Close / Verify CAPA Action
  // --------------------------------------------------------------------------
  async closeCapa(
    capaId: number,
    dto: CloseCapaActionDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const userId = user.userId || 1001;
    const verifierName = user.username || 'Quality Lead';
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const capaRes = await this.pool.query(
      `SELECT ncr_id, capa_no FROM tbl_qc_capa_action WHERE capa_id = $1 AND is_active = TRUE`,
      [capaId],
    );
    if (capaRes.rowCount === 0) {
      throw new NotFoundException(`CAPA #${capaId} not found.`);
    }
    const ncrId = Number(capaRes.rows[0].ncr_id);

    const updateSql = `
      UPDATE tbl_qc_capa_action
      SET
        actual_closure_date = CURRENT_DATE,
        verifier_id = $1,
        verifier_name = $2,
        verification_remarks = $3,
        effectiveness_status = $4,
        status = 'CLOSED',
        updated_by = $5,
        updated_date = CURRENT_TIMESTAMP
      WHERE capa_id = $6;
    `;
    await this.pool.query(updateSql, [
      userId,
      verifierName,
      dto.verificationRemarks,
      dto.effectivenessStatus || 'VERIFIED_EFFECTIVE',
      userId,
      capaId,
    ]);

    // Close parent NCR if requested or if verified effective
    if (dto.closeParentNcr || dto.effectivenessStatus === 'VERIFIED_EFFECTIVE') {
      await this.pool.query(
        `UPDATE tbl_qc_ncr_header
         SET capa_status = 'VERIFIED_CLOSED',
             status = 'CLOSED',
             updated_by = $1,
             updated_date = CURRENT_TIMESTAMP
         WHERE ncr_id = $2;`,
        [userId, ncrId],
      );
    }

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'NCR_QC',
      actionType: 'CLOSE_CAPA',
      entityTable: 'tbl_qc_capa_action',
      recordId: capaId,
      oldValue: null,
      newValue: dto,
      compId,
      branchId,
      fyearId: user.fyearId || null,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    return this.findById(ncrId, user);
  }

  // --------------------------------------------------------------------------
  // Delete NCR
  // --------------------------------------------------------------------------
  async delete(id: number, user: AuthenticatedUserContext, meta?: any) {
    const existing = await this.findById(id, user);
    if (existing.status === 'CLOSED') {
      throw new BadRequestException(`Cannot delete closed NCR #${existing.ncrNo}.`);
    }

    const userId = user.userId || 1001;
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    await this.pool.query(
      `UPDATE tbl_qc_ncr_header SET is_active = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP WHERE ncr_id = $2`,
      [userId, id],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'NCR_QC',
      actionType: 'DELETE',
      entityTable: 'tbl_qc_ncr_header',
      recordId: id,
      oldValue: existing,
      newValue: { isActive: false },
      compId,
      branchId,
      fyearId: user.fyearId || null,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    return { success: true, message: `NCR #${existing.ncrNo} deleted successfully.` };
  }

  // --------------------------------------------------------------------------
  // Row Mapper
  // --------------------------------------------------------------------------
  private mapNcrRow(r: any) {
    return {
      ncrId: Number(r.ncr_id),
      ncrNo: r.ncr_no,
      ncrDate: r.ncr_date,
      ncrType: r.ncr_type,
      sourceDocType: r.source_doc_type,
      sourceDocId: r.source_doc_id ? Number(r.source_doc_id) : null,
      sourceDocNo: r.source_doc_no,
      sourceDocDate: r.source_doc_date,
      itemId: Number(r.item_id),
      itemCode: r.item_code,
      itemName: r.item_name,
      batchNo: r.batch_no,
      heatNo: r.heat_no,
      defectSeverity: r.defect_severity,
      defectCategory: r.defect_category,
      defectDescription: r.defect_description,
      inspectedQty: Number(r.inspected_qty || 0),
      rejectedQty: Number(r.rejected_qty || 0),
      uomId: Number(r.uom_id),
      uomCode: r.uom_code,
      containmentAction: r.containment_action,
      quarantineLocation: r.quarantine_location,
      redTagNo: r.red_tag_no,
      mrbDisposition: r.mrb_disposition,
      mrbApproverId: r.mrb_approver_id ? Number(r.mrb_approver_id) : null,
      mrbApproverName: r.mrb_approver_name,
      mrbApprovalDate: r.mrb_approval_date,
      mrbNotes: r.mrb_notes,
      isCapaRequired: Boolean(r.is_capa_required),
      capaStatus: r.capa_status,
      status: r.status,
      createdBy: Number(r.created_by),
      createdDate: r.created_date,
      voteCount: r.vote_count !== undefined ? Number(r.vote_count) : 0,
      linkedCapaNo: r.linked_capa_no || null,
    };
  }
}
