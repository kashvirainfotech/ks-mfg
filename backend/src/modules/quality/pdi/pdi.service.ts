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
  ApprovePdiDto,
  CreatePdiDto,
  PdiFilterDto,
  PdiOverallVerdict,
  PdiStatus,
  ReleaseCoaDto,
  UpdatePdiDto,
} from './pdi.dto';

@Injectable()
export class PdiService {
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
        COUNT(CASE WHEN overall_verdict = 'APPROVED_FOR_DISPATCH' THEN 1 END)::INT AS approved_for_dispatch,
        COUNT(CASE WHEN is_coa_released = TRUE THEN 1 END)::INT AS released_coas,
        COUNT(CASE WHEN overall_verdict = 'CONCESSION_ACCEPTED' THEN 1 END)::INT AS concession_count,
        COUNT(CASE WHEN overall_verdict = 'REJECTED_QUARANTINE' OR disposition = 'QUARANTINE_HOLD' THEN 1 END)::INT AS quarantine_hold_count,
        COUNT(CASE WHEN status IN ('DRAFT', 'IN_PROGRESS') OR overall_verdict = 'PENDING' THEN 1 END)::INT AS active_pending_count
      FROM tbl_qc_pdi_header
      WHERE comp_id = $1 AND is_active = TRUE
        AND ($2::BIGINT IS NULL OR branch_id = $2::BIGINT);
    `;

    const res = await this.pool.query(sql, [compId, branchId]);
    const r = res.rows[0] || {};
    return {
      totalInspections: Number(r.total_inspections || 0),
      approvedForDispatch: Number(r.approved_for_dispatch || 0),
      releasedCoas: Number(r.released_coas || 0),
      concessionCount: Number(r.concession_count || 0),
      quarantineHoldCount: Number(r.quarantine_hold_count || 0),
      activePendingCount: Number(r.active_pending_count || 0),
    };
  }

  // --------------------------------------------------------------------------
  // Lookups: Customers, Sales Orders, Work Orders, Delivery Challans, Items, Warehouses, Users
  // --------------------------------------------------------------------------
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const [custRes, soRes, woRes, dcRes, itemRes, whRes, userRes] =
      await Promise.all([
        // Customers
        this.pool.query(
          `SELECT party_id, party_code, party_name
           FROM tbl_crm_party
           WHERE comp_id = $1 AND is_active = TRUE AND is_customer = TRUE
           ORDER BY party_name ASC;`,
          [compId],
        ),
        // Sales Orders
        this.pool.query(
          `SELECT so.so_id, so.so_no, so.so_date, so.customer_id, so.customer_name, so.customer_po_no, so.status
           FROM tbl_sales_order_header so
           WHERE so.comp_id = $1 AND so.is_active = TRUE
           ORDER BY so.so_id DESC
           LIMIT 50;`,
          [compId],
        ),
        // Work Orders
        this.pool.query(
          `SELECT wo_id, wo_no, wo_date, item_id, batch_no, planned_qty, status
           FROM tbl_mfg_wo_header
           WHERE comp_id = $1 AND is_active = TRUE
           ORDER BY wo_id DESC
           LIMIT 50;`,
          [compId],
        ),
        // Delivery Challans
        this.pool.query(
          `SELECT challan_id, challan_no, challan_date, so_id, customer_id, customer_name, status
           FROM tbl_sales_delivery_challan_header
           WHERE comp_id = $1 AND is_active = TRUE
           ORDER BY challan_id DESC
           LIMIT 50;`,
          [compId],
        ),
        // Items
        this.pool.query(
          `SELECT item_id, item_code, item_name, uom_id
           FROM tbl_inv_item
           WHERE comp_id = $1 AND is_active = TRUE
           ORDER BY item_code ASC;`,
          [compId],
        ),
        // Warehouses
        this.pool.query(
          `SELECT warehouse_id, warehouse_code, warehouse_name
           FROM tbl_inv_warehouse
           WHERE comp_id = $1 AND is_active = TRUE
           ORDER BY warehouse_code ASC;`,
          [compId],
        ),
        // Users (Inspectors, Approvers, QA heads)
        this.pool.query(
          `SELECT user_id, username, full_name
           FROM tbl_sec_user
           WHERE is_active = TRUE
           ORDER BY full_name ASC;`,
        ),
      ]);

    return {
      customers: custRes.rows.map((r) => ({
        partyId: Number(r.party_id),
        partyCode: r.party_code,
        partyName: r.party_name,
      })),
      salesOrders: soRes.rows.map((r) => ({
        soId: Number(r.so_id),
        soNo: r.so_no,
        soDate: r.so_date,
        customerId: Number(r.customer_id),
        customerName: r.customer_name,
        customerPoNo: r.customer_po_no,
        status: r.status,
      })),
      workOrders: woRes.rows.map((r) => ({
        woId: Number(r.wo_id),
        woNo: r.wo_no,
        woDate: r.wo_date,
        itemId: Number(r.item_id),
        batchNo: r.batch_no,
        plannedQty: Number(r.planned_qty),
        status: r.status,
      })),
      deliveryChallans: dcRes.rows.map((r) => ({
        challanId: Number(r.challan_id),
        challanNo: r.challan_no,
        challanDate: r.challan_date,
        soId: r.so_id ? Number(r.so_id) : null,
        customerId: Number(r.customer_id),
        customerName: r.customer_name,
        status: r.status,
      })),
      items: itemRes.rows.map((r) => ({
        itemId: Number(r.item_id),
        itemCode: r.item_code,
        itemName: r.item_name,
        uomId: Number(r.uom_id),
      })),
      warehouses: whRes.rows.map((r) => ({
        warehouseId: Number(r.warehouse_id),
        warehouseCode: r.warehouse_code,
        warehouseName: r.warehouse_name,
      })),
      users: userRes.rows.map((r) => ({
        userId: Number(r.user_id),
        username: r.username,
        fullName: r.full_name,
      })),
    };
  }

  // --------------------------------------------------------------------------
  // List All Pre-Dispatch Inspections
  // --------------------------------------------------------------------------
  async findAll(filter: PdiFilterDto, user: AuthenticatedUserContext) {
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

    if (filter.overallVerdict) {
      conditions.push(`h.overall_verdict = $${paramIndex}`);
      params.push(filter.overallVerdict);
      paramIndex++;
    }

    if (filter.customerId) {
      conditions.push(`h.customer_id = $${paramIndex}`);
      params.push(filter.customerId);
      paramIndex++;
    }

    if (filter.itemId) {
      conditions.push(`h.item_id = $${paramIndex}`);
      params.push(filter.itemId);
      paramIndex++;
    }

    if (filter.warehouseId) {
      conditions.push(`h.warehouse_id = $${paramIndex}`);
      params.push(filter.warehouseId);
      paramIndex++;
    }

    if (filter.startDate) {
      conditions.push(`h.pdi_date >= $${paramIndex}`);
      params.push(filter.startDate);
      paramIndex++;
    }

    if (filter.endDate) {
      conditions.push(`h.pdi_date <= $${paramIndex}`);
      params.push(filter.endDate);
      paramIndex++;
    }

    if (filter.search && filter.search.trim()) {
      conditions.push(
        `(h.pdi_no ILIKE $${paramIndex} OR h.coa_no ILIKE $${paramIndex} OR h.mtc_no ILIKE $${paramIndex} OR h.batch_no ILIKE $${paramIndex} OR h.heat_no ILIKE $${paramIndex} OR cust.party_name ILIKE $${paramIndex} OR it.item_name ILIKE $${paramIndex} OR it.item_code ILIKE $${paramIndex} OR so.so_no ILIKE $${paramIndex} OR wo.wo_no ILIKE $${paramIndex})`,
      );
      params.push(`%${filter.search.trim()}%`);
      paramIndex++;
    }

    const sql = `
      SELECT
        h.pdi_id,
        h.pdi_no,
        h.pdi_date,
        h.sales_order_id,
        so.so_no,
        h.customer_id,
        cust.party_name AS customer_name,
        cust.party_code AS customer_code,
        h.wo_id,
        wo.wo_no,
        h.challan_id,
        dc.challan_no,
        h.item_id,
        it.item_code,
        it.item_name,
        h.warehouse_id,
        wh.warehouse_name,
        h.batch_no,
        h.heat_no,
        h.lot_qty,
        h.sample_size,
        h.accepted_qty,
        h.rejected_qty,
        h.rework_qty,
        h.overall_verdict,
        h.disposition,
        h.inspector_id,
        insp.full_name AS inspector_name,
        h.approver_id,
        appr.full_name AS approver_name,
        h.approval_date,
        h.coa_no,
        h.coa_date,
        h.mtc_no,
        h.standard_specification,
        h.packaging_condition,
        h.labeling_verification,
        h.preservation_coating,
        h.customer_witness_required,
        h.customer_witness_name,
        h.customer_witness_date,
        h.is_coa_released,
        h.coa_released_by,
        coa_u.full_name AS coa_released_by_name,
        h.coa_released_at,
        h.remarks,
        h.deviation_reason,
        h.status,
        h.created_date,
        COALESCE(p_agg.param_count, 0) AS param_count,
        COALESCE(p_agg.pass_count, 0) AS pass_count,
        COALESCE(p_agg.fail_count, 0) AS fail_count,
        COALESCE(p_agg.concession_count, 0) AS concession_count
      FROM tbl_qc_pdi_header h
      JOIN tbl_crm_party cust ON cust.party_id = h.customer_id
      JOIN tbl_inv_item it ON it.item_id = h.item_id
      JOIN tbl_inv_warehouse wh ON wh.warehouse_id = h.warehouse_id
      LEFT JOIN tbl_sales_order_header so ON so.so_id = h.sales_order_id
      LEFT JOIN tbl_mfg_wo_header wo ON wo.wo_id = h.wo_id
      LEFT JOIN tbl_sales_delivery_challan_header dc ON dc.challan_id = h.challan_id
      JOIN tbl_sec_user insp ON insp.user_id = h.inspector_id
      LEFT JOIN tbl_sec_user appr ON appr.user_id = h.approver_id
      LEFT JOIN tbl_sec_user coa_u ON coa_u.user_id = h.coa_released_by
      LEFT JOIN (
        SELECT
          pdi_id,
          COUNT(*) AS param_count,
          COUNT(CASE WHEN param_result = 'PASS' THEN 1 END) AS pass_count,
          COUNT(CASE WHEN param_result = 'FAIL' THEN 1 END) AS fail_count,
          COUNT(CASE WHEN param_result = 'CONCESSION' THEN 1 END) AS concession_count
        FROM tbl_qc_pdi_param
        WHERE is_active = TRUE
        GROUP BY pdi_id
      ) p_agg ON p_agg.pdi_id = h.pdi_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY h.pdi_id DESC;
    `;

    const res = await this.pool.query(sql, params);
    return res.rows.map((r) => ({
      pdiId: Number(r.pdi_id),
      pdiNo: r.pdi_no,
      pdiDate: r.pdi_date,
      salesOrderId: r.sales_order_id ? Number(r.sales_order_id) : null,
      soNo: r.so_no,
      customerId: Number(r.customer_id),
      customerName: r.customer_name,
      customerCode: r.customer_code,
      woId: r.wo_id ? Number(r.wo_id) : null,
      woNo: r.wo_no,
      challanId: r.challan_id ? Number(r.challan_id) : null,
      challanNo: r.challan_no,
      itemId: Number(r.item_id),
      itemCode: r.item_code,
      itemName: r.item_name,
      warehouseId: Number(r.warehouse_id),
      warehouseName: r.warehouse_name,
      batchNo: r.batch_no,
      heatNo: r.heat_no,
      lotQty: Number(r.lot_qty),
      sampleSize: Number(r.sample_size),
      acceptedQty: Number(r.accepted_qty),
      rejectedQty: Number(r.rejected_qty),
      reworkQty: Number(r.rework_qty),
      overallVerdict: r.overall_verdict,
      disposition: r.disposition,
      inspectorId: Number(r.inspector_id),
      inspectorName: r.inspector_name,
      approverId: r.approver_id ? Number(r.approver_id) : null,
      approverName: r.approver_name,
      approvalDate: r.approval_date,
      coaNo: r.coa_no,
      coaDate: r.coa_date,
      mtcNo: r.mtc_no,
      standardSpecification: r.standard_specification,
      packagingCondition: r.packaging_condition,
      labelingVerification: r.labeling_verification,
      preservationCoating: r.preservation_coating,
      customerWitnessRequired: Boolean(r.customer_witness_required),
      customerWitnessName: r.customer_witness_name,
      customerWitnessDate: r.customer_witness_date,
      isCoaReleased: Boolean(r.is_coa_released),
      coaReleasedBy: r.coa_released_by ? Number(r.coa_released_by) : null,
      coaReleasedByName: r.coa_released_by_name,
      coaReleasedAt: r.coa_released_at,
      remarks: r.remarks,
      deviationReason: r.deviation_reason,
      status: r.status,
      createdDate: r.created_date,
      paramCount: Number(r.param_count),
      passCount: Number(r.pass_count),
      failCount: Number(r.fail_count),
      concessionCount: Number(r.concession_count),
    }));
  }

  // --------------------------------------------------------------------------
  // Single PDI Details (Header + Characteristic Parameters + CoA Spec)
  // --------------------------------------------------------------------------
  async findById(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const headerSql = `
      SELECT
        h.*,
        cust.party_name AS customer_name,
        cust.party_code AS customer_code,
        it.item_code,
        it.item_name,
        wh.warehouse_name,
        wh.warehouse_code,
        so.so_no,
        wo.wo_no,
        dc.challan_no,
        insp.full_name AS inspector_name,
        appr.full_name AS approver_name,
        coa_u.full_name AS coa_released_by_name
      FROM tbl_qc_pdi_header h
      JOIN tbl_crm_party cust ON cust.party_id = h.customer_id
      JOIN tbl_inv_item it ON it.item_id = h.item_id
      JOIN tbl_inv_warehouse wh ON wh.warehouse_id = h.warehouse_id
      LEFT JOIN tbl_sales_order_header so ON so.so_id = h.sales_order_id
      LEFT JOIN tbl_mfg_wo_header wo ON wo.wo_id = h.wo_id
      LEFT JOIN tbl_sales_delivery_challan_header dc ON dc.challan_id = h.challan_id
      JOIN tbl_sec_user insp ON insp.user_id = h.inspector_id
      LEFT JOIN tbl_sec_user appr ON appr.user_id = h.approver_id
      LEFT JOIN tbl_sec_user coa_u ON coa_u.user_id = h.coa_released_by
      WHERE h.pdi_id = $1 AND h.comp_id = $2 AND h.is_active = TRUE;
    `;

    const hRes = await this.pool.query(headerSql, [id, compId]);
    if (hRes.rows.length === 0) {
      throw new NotFoundException(`Pre-dispatch inspection #${id} not found`);
    }
    const h = hRes.rows[0];

    const [pRes, cRes] = await Promise.all([
      this.pool.query(
        `SELECT *
         FROM tbl_qc_pdi_param
         WHERE pdi_id = $1 AND is_active = TRUE
         ORDER BY param_sequence ASC, pdi_param_id ASC;`,
        [id],
      ),
      this.pool.query(
        `SELECT *
         FROM tbl_qc_pdi_coa_spec
         WHERE pdi_id = $1 AND is_active = TRUE
         LIMIT 1;`,
        [id],
      ),
    ]);

    const c = cRes.rows[0] || null;

    return {
      pdiId: Number(h.pdi_id),
      pdiNo: h.pdi_no,
      pdiDate: h.pdi_date,
      salesOrderId: h.sales_order_id ? Number(h.sales_order_id) : null,
      soNo: h.so_no,
      customerId: Number(h.customer_id),
      customerName: h.customer_name,
      customerCode: h.customer_code,
      woId: h.wo_id ? Number(h.wo_id) : null,
      woNo: h.wo_no,
      challanId: h.challan_id ? Number(h.challan_id) : null,
      challanNo: h.challan_no,
      itemId: Number(h.item_id),
      itemCode: h.item_code,
      itemName: h.item_name,
      warehouseId: Number(h.warehouse_id),
      warehouseCode: h.warehouse_code,
      warehouseName: h.warehouse_name,
      batchNo: h.batch_no,
      heatNo: h.heat_no,
      lotQty: Number(h.lot_qty),
      sampleSize: Number(h.sample_size),
      acceptedQty: Number(h.accepted_qty),
      rejectedQty: Number(rRejectedOrZero(h.rejected_qty)),
      reworkQty: Number(h.rework_qty),
      overallVerdict: h.overall_verdict,
      disposition: h.disposition,
      inspectorId: Number(h.inspector_id),
      inspectorName: h.inspector_name,
      approverId: h.approver_id ? Number(h.approver_id) : null,
      approverName: h.approver_name,
      approvalDate: h.approval_date,
      coaNo: h.coa_no,
      coaDate: h.coa_date,
      mtcNo: h.mtc_no,
      standardSpecification: h.standard_specification,
      packagingCondition: h.packaging_condition,
      labelingVerification: h.labeling_verification,
      preservationCoating: h.preservation_coating,
      customerWitnessRequired: Boolean(h.customer_witness_required),
      customerWitnessName: h.customer_witness_name,
      customerWitnessDate: h.customer_witness_date,
      isCoaReleased: Boolean(h.is_coa_released),
      coaReleasedBy: h.coa_released_by ? Number(h.coa_released_by) : null,
      coaReleasedByName: h.coa_released_by_name,
      coaReleasedAt: h.coa_released_at,
      remarks: h.remarks,
      deviationReason: h.deviation_reason,
      status: h.status,
      createdDate: h.created_date,
      params: pRes.rows.map((p) => ({
        pdiParamId: Number(p.pdi_param_id),
        pdiId: Number(p.pdi_id),
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
        observedVal1:
          p.observed_val_1 !== null ? Number(p.observed_val_1) : null,
        observedVal2:
          p.observed_val_2 !== null ? Number(p.observed_val_2) : null,
        observedVal3:
          p.observed_val_3 !== null ? Number(p.observed_val_3) : null,
        observedVal4:
          p.observed_val_4 !== null ? Number(p.observed_val_4) : null,
        observedVal5:
          p.observed_val_5 !== null ? Number(p.observed_val_5) : null,
        meanVal: p.mean_val !== null ? Number(p.mean_val) : null,
        visualResult: p.visual_result,
        paramResult: p.param_result,
        notes: p.notes,
      })),
      coaSpec: c
        ? {
            coaSpecId: Number(c.coa_spec_id),
            pdiId: Number(c.pdi_id),
            elemCPct: c.elem_c_pct !== null ? Number(c.elem_c_pct) : null,
            elemMnPct: c.elem_mn_pct !== null ? Number(c.elem_mn_pct) : null,
            elemSiPct: c.elem_si_pct !== null ? Number(c.elem_si_pct) : null,
            elemPPct: c.elem_p_pct !== null ? Number(c.elem_p_pct) : null,
            elemSPct: c.elem_s_pct !== null ? Number(c.elem_s_pct) : null,
            elemCrPct: c.elem_cr_pct !== null ? Number(c.elem_cr_pct) : null,
            elemNiPct: c.elem_ni_pct !== null ? Number(c.elem_ni_pct) : null,
            elemMoPct: c.elem_mo_pct !== null ? Number(c.elem_mo_pct) : null,
            yieldStrengthMpa:
              c.yield_strength_mpa !== null
                ? Number(c.yield_strength_mpa)
                : null,
            tensileStrengthMpa:
              c.tensile_strength_mpa !== null
                ? Number(c.tensile_strength_mpa)
                : null,
            elongationPct:
              c.elongation_pct !== null ? Number(c.elongation_pct) : null,
            hardnessVal: c.hardness_val,
            impactEnergyJoules:
              c.impact_energy_joules !== null
                ? Number(c.impact_energy_joules)
                : null,
            hydroShellTestBar:
              c.hydro_shell_test_bar !== null
                ? Number(c.hydro_shell_test_bar)
                : null,
            hydroSeatTestBar:
              c.hydro_seat_test_bar !== null
                ? Number(c.hydro_seat_test_bar)
                : null,
            airSeatTestBar:
              c.air_seat_test_bar !== null
                ? Number(c.air_seat_test_bar)
                : null,
            ndeTestType: c.nde_test_type,
            ndeResult: c.nde_result,
            labName: c.lab_name,
            certifiedEngineer: c.certified_engineer,
            certificationStandard: c.certification_standard,
          }
        : null,
    };
  }

  // --------------------------------------------------------------------------
  // Create Pre-Dispatch Inspection
  // --------------------------------------------------------------------------
  async create(
    dto: CreatePdiDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Auto-generate PDI number if not provided
      let pdiNo = dto.pdiNo;
      if (!pdiNo || !pdiNo.trim()) {
        const countRes = await client.query(
          `SELECT nextval('seq_qc_pdi_id') AS next_val;`,
        );
        const seqVal = countRes.rows[0].next_val;
        pdiNo = `PDI-AHM-2627-${String(seqVal).padStart(4, '0')}`;
      }

      const overall = dto.overallVerdict || 'PENDING';
      let status: PdiStatus = 'IN_PROGRESS';
      if (overall === 'APPROVED_FOR_DISPATCH' || overall === 'CONCESSION_ACCEPTED') {
        status = 'APPROVED';
      } else if (overall === 'REJECTED_QUARANTINE') {
        status = 'REJECTED';
      }

      const headerInsertSql = `
        INSERT INTO tbl_qc_pdi_header (
          pdi_no, pdi_date, sales_order_id, customer_id, wo_id, challan_id,
          item_id, warehouse_id, batch_no, heat_no,
          lot_qty, sample_size, accepted_qty, rejected_qty, rework_qty,
          overall_verdict, disposition, inspector_id, approver_id, approval_date,
          coa_no, coa_date, mtc_no, standard_specification,
          packaging_condition, labeling_verification, preservation_coating,
          customer_witness_required, customer_witness_name, customer_witness_date,
          is_coa_released, coa_released_by, coa_released_at,
          remarks, deviation_reason, status, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20,
          $21, $22, $23, $24,
          $25, $26, $27,
          $28, $29, $30,
          $31, $32, $33,
          $34, $35, $36, TRUE,
          $37, $38, $39, $40
        ) RETURNING pdi_id;
      `;

      const hParams = [
        pdiNo,
        dto.pdiDate || new Date(),
        dto.salesOrderId || null,
        dto.customerId,
        dto.woId || null,
        dto.challanId || null,
        dto.itemId,
        dto.warehouseId,
        dto.batchNo || null,
        dto.heatNo || null,
        dto.lotQty || 0,
        dto.sampleSize || 5,
        dto.acceptedQty || 0,
        dto.rejectedQty || 0,
        dto.reworkQty || 0,
        overall,
        dto.disposition || 'CLEAR_FOR_INVOICE',
        userId,
        overall !== 'PENDING' ? userId : null,
        overall !== 'PENDING' ? new Date() : null,
        null, // coa_no assigned when released
        null, // coa_date
        dto.mtcNo || null,
        dto.standardSpecification || 'API 6D / ASME B16.34',
        dto.packagingCondition || 'ACCEPTABLE',
        dto.labelingVerification || 'PASS',
        dto.preservationCoating || 'Rust Preventive Oil VCI wrap',
        dto.customerWitnessRequired ?? false,
        dto.customerWitnessName || null,
        dto.customerWitnessDate || null,
        false, // is_coa_released
        null,  // coa_released_by
        null,  // coa_released_at
        dto.remarks || null,
        dto.deviationReason || null,
        status,
        compId,
        branchId,
        user.fyearId || null,
        userId,
      ];

      const hRes = await client.query(headerInsertSql, hParams);
      const pdiId = Number(hRes.rows[0].pdi_id);

      // Insert parameters
      if (dto.params && dto.params.length > 0) {
        for (let i = 0; i < dto.params.length; i++) {
          const p = dto.params[i];
          const pInsertSql = `
            INSERT INTO tbl_qc_pdi_param (
              pdi_id, param_sequence, param_name, param_category, instrument_name,
              nominal_val, min_tolerance, max_tolerance, uom_code,
              observed_val_1, observed_val_2, observed_val_3, observed_val_4, observed_val_5, mean_val,
              visual_result, param_result, notes, is_active,
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
            pdiId,
            p.paramSequence || i + 1,
            p.paramName,
            p.paramCategory || 'FUNCTIONAL_PRESSURE',
            p.instrumentName || null,
            p.nominalVal ?? null,
            p.minTolerance ?? null,
            p.maxTolerance ?? null,
            p.uomCode || 'mm',
            p.observedVal1 ?? null,
            p.observedVal2 ?? null,
            p.observedVal3 ?? null,
            p.observedVal4 ?? null,
            p.observedVal5 ?? null,
            p.meanVal ?? null,
            p.visualResult || 'PASS',
            p.paramResult || 'PASS',
            p.notes || null,
            compId,
            branchId,
            user.fyearId || null,
            userId,
          ]);
        }
      }

      // Insert CoA spec matrix if provided
      if (dto.coaSpec) {
        const c = dto.coaSpec;
        const cInsertSql = `
          INSERT INTO tbl_qc_pdi_coa_spec (
            pdi_id, elem_c_pct, elem_mn_pct, elem_si_pct, elem_p_pct, elem_s_pct,
            elem_cr_pct, elem_ni_pct, elem_mo_pct, yield_strength_mpa, tensile_strength_mpa,
            elongation_pct, hardness_val, impact_energy_joules,
            hydro_shell_test_bar, hydro_seat_test_bar, air_seat_test_bar,
            nde_test_type, nde_result, lab_name, certified_engineer, certification_standard,
            is_active, comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14,
            $15, $16, $17,
            $18, $19, $20, $21, $22,
            TRUE, $23, $24, $25, $26
          );
        `;
        await client.query(cInsertSql, [
          pdiId,
          c.elemCPct ?? 0.03,
          c.elemMnPct ?? 1.45,
          c.elemSiPct ?? 0.42,
          c.elemPPct ?? 0.025,
          c.elemSPct ?? 0.012,
          c.elemCrPct ?? 17.2,
          c.elemNiPct ?? 11.1,
          c.elemMoPct ?? 2.15,
          c.yieldStrengthMpa ?? 285.0,
          c.tensileStrengthMpa ?? 580.0,
          c.elongationPct ?? 42.0,
          c.hardnessVal || '185 HBW',
          c.impactEnergyJoules ?? 95.0,
          c.hydroShellTestBar ?? 31.0,
          c.hydroSeatTestBar ?? 22.0,
          c.airSeatTestBar ?? 6.0,
          c.ndeTestType || '100% Visual + Dye Penetrant (PT) Flange Faces',
          c.ndeResult || 'ACCEPTED',
          c.labName || 'Kashvira Metallurgical Testing Laboratory (NABL Accredited)',
          c.certifiedEngineer || 'Er. R. K. Patel (Level-II NDT / ASNT)',
          c.certificationStandard || 'EN 10204:2004 Type 3.1 / ISO 10474',
          compId,
          branchId,
          user.fyearId || null,
          userId,
        ]);
      }

      await client.query('COMMIT');

      // Audit log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PDI_QC',
        actionType: 'ADD',
        entityTable: 'tbl_qc_pdi_header',
        recordId: pdiId,
        newValue: { pdiNo, overallVerdict: overall, lotQty: dto.lotQty },
        compId,
        branchId,
        fyearId: user.fyearId || null,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      });

      return this.findById(pdiId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Update Pre-Dispatch Inspection
  // --------------------------------------------------------------------------
  async update(
    id: number,
    dto: UpdatePdiDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const existing = await this.findById(id, user);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const overall = dto.overallVerdict || existing.overallVerdict;
      let status = existing.status;
      if (overall === 'APPROVED_FOR_DISPATCH' || overall === 'CONCESSION_ACCEPTED') {
        status = 'APPROVED';
      } else if (overall === 'REJECTED_QUARANTINE') {
        status = 'REJECTED';
      }

      const updateHeaderSql = `
        UPDATE tbl_qc_pdi_header
        SET
          pdi_date = COALESCE($1, pdi_date),
          sales_order_id = COALESCE($2, sales_order_id),
          customer_id = COALESCE($3, customer_id),
          wo_id = COALESCE($4, wo_id),
          challan_id = COALESCE($5, challan_id),
          item_id = COALESCE($6, item_id),
          warehouse_id = COALESCE($7, warehouse_id),
          batch_no = COALESCE($8, batch_no),
          heat_no = COALESCE($9, heat_no),
          lot_qty = COALESCE($10, lot_qty),
          sample_size = COALESCE($11, sample_size),
          accepted_qty = COALESCE($12, accepted_qty),
          rejected_qty = COALESCE($13, rejected_qty),
          rework_qty = COALESCE($14, rework_qty),
          overall_verdict = $15,
          disposition = COALESCE($16, disposition),
          mtc_no = COALESCE($17, mtc_no),
          standard_specification = COALESCE($18, standard_specification),
          packaging_condition = COALESCE($19, packaging_condition),
          labeling_verification = COALESCE($20, labeling_verification),
          preservation_coating = COALESCE($21, preservation_coating),
          customer_witness_required = COALESCE($22, customer_witness_required),
          customer_witness_name = COALESCE($23, customer_witness_name),
          customer_witness_date = COALESCE($24, customer_witness_date),
          remarks = COALESCE($25, remarks),
          deviation_reason = COALESCE($26, deviation_reason),
          status = $27,
          updated_by = $28,
          updated_date = CURRENT_TIMESTAMP
        WHERE pdi_id = $29 AND comp_id = $30 AND is_active = TRUE;
      `;

      await client.query(updateHeaderSql, [
        dto.pdiDate || null,
        dto.salesOrderId || null,
        dto.customerId || null,
        dto.woId || null,
        dto.challanId || null,
        dto.itemId || null,
        dto.warehouseId || null,
        dto.batchNo || null,
        dto.heatNo || null,
        dto.lotQty ?? null,
        dto.sampleSize ?? null,
        dto.acceptedQty ?? null,
        dto.rejectedQty ?? null,
        dto.reworkQty ?? null,
        overall,
        dto.disposition || null,
        dto.mtcNo || null,
        dto.standardSpecification || null,
        dto.packagingCondition || null,
        dto.labelingVerification || null,
        dto.preservationCoating || null,
        dto.customerWitnessRequired ?? null,
        dto.customerWitnessName || null,
        dto.customerWitnessDate || null,
        dto.remarks || null,
        dto.deviationReason || null,
        status,
        userId,
        id,
        compId,
      ]);

      // If params are passed, replace them
      if (dto.params && dto.params.length > 0) {
        await client.query(
          `DELETE FROM tbl_qc_pdi_param WHERE pdi_id = $1;`,
          [id],
        );
        for (let i = 0; i < dto.params.length; i++) {
          const p = dto.params[i];
          const pInsertSql = `
            INSERT INTO tbl_qc_pdi_param (
              pdi_id, param_sequence, param_name, param_category, instrument_name,
              nominal_val, min_tolerance, max_tolerance, uom_code,
              observed_val_1, observed_val_2, observed_val_3, observed_val_4, observed_val_5, mean_val,
              visual_result, param_result, notes, is_active,
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
            p.paramCategory || 'FUNCTIONAL_PRESSURE',
            p.instrumentName || null,
            p.nominalVal ?? null,
            p.minTolerance ?? null,
            p.maxTolerance ?? null,
            p.uomCode || 'mm',
            p.observedVal1 ?? null,
            p.observedVal2 ?? null,
            p.observedVal3 ?? null,
            p.observedVal4 ?? null,
            p.observedVal5 ?? null,
            p.meanVal ?? null,
            p.visualResult || 'PASS',
            p.paramResult || 'PASS',
            p.notes || null,
            compId,
            branchId,
            user.fyearId || null,
            userId,
          ]);
        }
      }

      // Upsert CoA Spec if provided
      if (dto.coaSpec) {
        const c = dto.coaSpec;
        const cUpsertSql = `
          INSERT INTO tbl_qc_pdi_coa_spec (
            pdi_id, elem_c_pct, elem_mn_pct, elem_si_pct, elem_p_pct, elem_s_pct,
            elem_cr_pct, elem_ni_pct, elem_mo_pct, yield_strength_mpa, tensile_strength_mpa,
            elongation_pct, hardness_val, impact_energy_joules,
            hydro_shell_test_bar, hydro_seat_test_bar, air_seat_test_bar,
            nde_test_type, nde_result, lab_name, certified_engineer, certification_standard,
            is_active, comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14,
            $15, $16, $17,
            $18, $19, $20, $21, $22,
            TRUE, $23, $24, $25, $26
          )
          ON CONFLICT (pdi_id) DO UPDATE SET
            elem_c_pct = EXCLUDED.elem_c_pct,
            elem_mn_pct = EXCLUDED.elem_mn_pct,
            elem_si_pct = EXCLUDED.elem_si_pct,
            elem_p_pct = EXCLUDED.elem_p_pct,
            elem_s_pct = EXCLUDED.elem_s_pct,
            elem_cr_pct = EXCLUDED.elem_cr_pct,
            elem_ni_pct = EXCLUDED.elem_ni_pct,
            elem_mo_pct = EXCLUDED.elem_mo_pct,
            yield_strength_mpa = EXCLUDED.yield_strength_mpa,
            tensile_strength_mpa = EXCLUDED.tensile_strength_mpa,
            elongation_pct = EXCLUDED.elongation_pct,
            hardness_val = EXCLUDED.hardness_val,
            impact_energy_joules = EXCLUDED.impact_energy_joules,
            hydro_shell_test_bar = EXCLUDED.hydro_shell_test_bar,
            hydro_seat_test_bar = EXCLUDED.hydro_seat_test_bar,
            air_seat_test_bar = EXCLUDED.air_seat_test_bar,
            nde_test_type = EXCLUDED.nde_test_type,
            nde_result = EXCLUDED.nde_result,
            lab_name = EXCLUDED.lab_name,
            certified_engineer = EXCLUDED.certified_engineer,
            certification_standard = EXCLUDED.certification_standard,
            updated_by = EXCLUDED.created_by,
            updated_date = CURRENT_TIMESTAMP;
        `;
        await client.query(cUpsertSql, [
          id,
          c.elemCPct ?? 0.03,
          c.elemMnPct ?? 1.45,
          c.elemSiPct ?? 0.42,
          c.elemPPct ?? 0.025,
          c.elemSPct ?? 0.012,
          c.elemCrPct ?? 17.2,
          c.elemNiPct ?? 11.1,
          c.elemMoPct ?? 2.15,
          c.yieldStrengthMpa ?? 285.0,
          c.tensileStrengthMpa ?? 580.0,
          c.elongationPct ?? 42.0,
          c.hardnessVal || '185 HBW',
          c.impactEnergyJoules ?? 95.0,
          c.hydroShellTestBar ?? 31.0,
          c.hydroSeatTestBar ?? 22.0,
          c.airSeatTestBar ?? 6.0,
          c.ndeTestType || '100% Visual + Dye Penetrant (PT) Flange Faces',
          c.ndeResult || 'ACCEPTED',
          c.labName || 'Kashvira Metallurgical Testing Laboratory (NABL Accredited)',
          c.certifiedEngineer || 'Er. R. K. Patel (Level-II NDT / ASNT)',
          c.certificationStandard || 'EN 10204:2004 Type 3.1 / ISO 10474',
          compId,
          branchId,
          user.fyearId || null,
          userId,
        ]);
      }

      await client.query('COMMIT');

      // Audit log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PDI_QC',
        actionType: 'EDIT',
        entityTable: 'tbl_qc_pdi_header',
        recordId: id,
        oldValue: { status: existing.status, overallVerdict: existing.overallVerdict },
        newValue: { status, overallVerdict: overall },
        compId,
        branchId,
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
  // Approve Pre-Dispatch Inspection & Disposition
  // --------------------------------------------------------------------------
  async approve(
    id: number,
    dto: ApprovePdiDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId;

    const existing = await this.findById(id, user);

    let newStatus: PdiStatus = 'APPROVED';
    if (dto.overallVerdict === 'REJECTED_QUARANTINE') {
      newStatus = 'REJECTED';
    }

    let coaNo = existing.coaNo;
    let coaDate = existing.coaDate;
    let isCoaReleased = existing.isCoaReleased;
    let coaReleasedBy = existing.coaReleasedBy;
    let coaReleasedAt = existing.coaReleasedAt;

    if (dto.isReleaseCoa && !isCoaReleased) {
      isCoaReleased = true;
      coaReleasedBy = userId;
      coaReleasedAt = new Date().toISOString();
      coaDate = new Date().toISOString().split('T')[0];
      if (!coaNo) {
        coaNo = `COA-AHM-2627-${String(id).padStart(4, '0')}`;
      }
    }

    const sql = `
      UPDATE tbl_qc_pdi_header
      SET
        overall_verdict = $1,
        disposition = $2,
        accepted_qty = $3,
        rejected_qty = $4,
        rework_qty = $5,
        deviation_reason = COALESCE($6, deviation_reason),
        remarks = COALESCE($7, remarks),
        approver_id = $8,
        approval_date = CURRENT_TIMESTAMP,
        is_coa_released = $9,
        coa_no = COALESCE($10, coa_no),
        coa_date = COALESCE($11::DATE, coa_date),
        coa_released_by = COALESCE($12, coa_released_by),
        coa_released_at = CASE WHEN $9 = TRUE AND coa_released_at IS NULL THEN CURRENT_TIMESTAMP ELSE coa_released_at END,
        status = $13,
        updated_by = $8,
        updated_date = CURRENT_TIMESTAMP
      WHERE pdi_id = $14 AND comp_id = $15 AND is_active = TRUE;
    `;

    await this.pool.query(sql, [
      dto.overallVerdict,
      dto.disposition,
      dto.acceptedQty,
      dto.rejectedQty,
      dto.reworkQty || 0,
      dto.deviationReason || null,
      dto.remarks || null,
      userId,
      isCoaReleased,
      coaNo,
      coaDate,
      coaReleasedBy,
      newStatus,
      id,
      compId,
    ]);

    // Record audit log
    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'PDI_QC',
      actionType: 'APPROVE',
      entityTable: 'tbl_qc_pdi_header',
      recordId: id,
      oldValue: { verdict: existing.overallVerdict, status: existing.status },
      newValue: {
        verdict: dto.overallVerdict,
        disposition: dto.disposition,
        acceptedQty: dto.acceptedQty,
        rejectedQty: dto.rejectedQty,
        isCoaReleased,
        coaNo,
      },
      compId,
      branchId: user.branchId || 1001,
      fyearId: user.fyearId || null,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return this.findById(id, user);
  }

  // --------------------------------------------------------------------------
  // Release Certificate of Analysis (CoA)
  // --------------------------------------------------------------------------
  async releaseCoa(
    id: number,
    dto: ReleaseCoaDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId;

    const existing = await this.findById(id, user);

    if (existing.overallVerdict === 'REJECTED_QUARANTINE') {
      throw new BadRequestException(
        'Cannot release Certificate of Analysis for a rejected quarantine lot.',
      );
    }

    const coaNo =
      dto.coaNo ||
      existing.coaNo ||
      `COA-AHM-2627-${String(id).padStart(4, '0')}`;

    const updateHeaderSql = `
      UPDATE tbl_qc_pdi_header
      SET
        is_coa_released = TRUE,
        coa_no = $1,
        coa_date = CURRENT_DATE,
        coa_released_by = $2,
        coa_released_at = CURRENT_TIMESTAMP,
        standard_specification = COALESCE($3, standard_specification),
        remarks = COALESCE($4, remarks),
        updated_by = $2,
        updated_date = CURRENT_TIMESTAMP
      WHERE pdi_id = $5 AND comp_id = $6 AND is_active = TRUE;
    `;

    await this.pool.query(updateHeaderSql, [
      coaNo,
      userId,
      dto.standardSpecification || null,
      dto.remarks || null,
      id,
      compId,
    ]);

    // If certifiedEngineer provided, update coa_spec
    if (dto.certifiedEngineer || dto.standardSpecification) {
      await this.pool.query(
        `UPDATE tbl_qc_pdi_coa_spec
         SET
           certified_engineer = COALESCE($1, certified_engineer),
           certification_standard = COALESCE($2, certification_standard),
           updated_by = $3,
           updated_date = CURRENT_TIMESTAMP
         WHERE pdi_id = $4;`,
        [dto.certifiedEngineer || null, dto.standardSpecification || null, userId, id],
      );
    }

    // Audit log
    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'PDI_QC',
      actionType: 'RELEASE',
      entityTable: 'tbl_qc_pdi_header',
      recordId: id,
      newValue: { coaNo, releasedBy: userId, coaDate: new Date().toISOString() },
      compId,
      branchId: user.branchId || 1001,
      fyearId: user.fyearId || null,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return this.findById(id, user);
  }

  // --------------------------------------------------------------------------
  // Delete / Soft-Cancel Pre-Dispatch Inspection
  // --------------------------------------------------------------------------
  async delete(id: number, user: AuthenticatedUserContext, meta?: any) {
    const compId = user.compId || 1001;
    const userId = user.userId;

    const existing = await this.findById(id, user);

    if (existing.isCoaReleased) {
      throw new BadRequestException(
        `Cannot cancel PDI #${existing.pdiNo} because Certificate of Analysis (${existing.coaNo}) has already been officially released.`,
      );
    }

    await this.pool.query(
      `UPDATE tbl_qc_pdi_header
       SET is_active = FALSE, status = 'CANCELLED', updated_by = $1, updated_date = CURRENT_TIMESTAMP
       WHERE pdi_id = $2 AND comp_id = $3;`,
      [userId, id, compId],
    );

    // Audit log
    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'PDI_QC',
      actionType: 'DELETE',
      entityTable: 'tbl_qc_pdi_header',
      recordId: id,
      oldValue: { pdiNo: existing.pdiNo, status: existing.status },
      compId,
      branchId: user.branchId || 1001,
      fyearId: user.fyearId || null,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: `PDI ${existing.pdiNo} successfully cancelled.` };
  }
}

function rRejectedOrZero(val: any): number {
  return val !== null && val !== undefined ? Number(val) : 0;
}
