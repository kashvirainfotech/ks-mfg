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
import { DependencyCheckService } from '../../../common/services/dependency-check.service';
import type {
  ApproveQcInspectionDto,
  CancelQcInspectionDto,
  CreateQcInspectionDto,
  QcFilterParams,
  QcInspectionStatus,
  QcOverallResult,
  RejectQcInspectionDto,
  UpdateQcInspectionDto,
} from './inward-qc.dto';

@Injectable()
export class InwardQcService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // --------------------------------------------------------------------------
  // KPI Summary
  // --------------------------------------------------------------------------
  async getQcSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const sql = `
      SELECT
        COUNT(*)::INT AS total_inspections,
        COUNT(CASE WHEN status IN ('DRAFT', 'IN_PROGRESS') THEN 1 END)::INT AS pending_count,
        COUNT(CASE WHEN status = 'COMPLETED' AND overall_result = 'ACCEPTED' THEN 1 END)::INT AS accepted_count,
        COUNT(CASE WHEN overall_result IN ('REJECTED', 'ACCEPTED_UNDER_DEVIATION') THEN 1 END)::INT AS rejected_deviated_count
      FROM tbl_qc_inward_inspection_header
      WHERE comp_id = $1 AND is_active = TRUE
        AND ($2::BIGINT IS NULL OR branch_id = $2::BIGINT);
    `;

    const res = await this.pool.query(sql, [compId, branchId]);
    const r = res.rows[0] || {};
    return {
      totalInspections: Number(r.total_inspections || 0),
      pendingCount: Number(r.pending_count || 0),
      acceptedCount: Number(r.accepted_count || 0),
      rejectedDeviatedCount: Number(r.rejected_deviated_count || 0),
    };
  }

  // --------------------------------------------------------------------------
  // Document Number Generation (QC-AHM-YYNextYY-XXXX)
  // --------------------------------------------------------------------------
  private async generateQcNumber(
    compId: number,
    branchId: number,
  ): Promise<string> {
    const bRes = await this.pool.query(
      `SELECT branch_code FROM tbl_org_branch WHERE branch_id = $1 AND comp_id = $2;`,
      [branchId, compId],
    );
    const branchCode = bRes.rows[0]?.branch_code || 'HO';

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    let startYear = curYear;
    if (curMonth < 4) startYear = curYear - 1;
    const nextYear = startYear + 1;
    const fyearCode = `${String(startYear).slice(-2)}${String(nextYear).slice(-2)}`;

    const seqRes = await this.pool.query(
      `SELECT nextval('seq_qc_inward_id') AS next_val;`,
    );
    const seq = String(seqRes.rows[0].next_val).padStart(4, '0');
    return `QC-${branchCode}-${fyearCode}-${seq}`;
  }

  // --------------------------------------------------------------------------
  // Find All (Register Listing)
  // --------------------------------------------------------------------------
  async findAllInspections(
    filters: QcFilterParams,
    user: AuthenticatedUserContext,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const conditions: string[] = [
      `q.comp_id = $1`,
      `q.is_active = TRUE`,
      `($2::BIGINT IS NULL OR q.branch_id = $2::BIGINT)`,
    ];
    const params: any[] = [compId, branchId];
    let idx = 3;

    if (filters.status) {
      conditions.push(`q.status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.overallResult) {
      conditions.push(`q.overall_result = $${idx++}`);
      params.push(filters.overallResult);
    }
    if (filters.warehouseId) {
      conditions.push(`q.warehouse_id = $${idx++}`);
      params.push(filters.warehouseId);
    }
    if (filters.vendorId) {
      conditions.push(`q.vendor_id = $${idx++}`);
      params.push(filters.vendorId);
    }
    if (filters.grnId) {
      conditions.push(`q.grn_id = $${idx++}`);
      params.push(filters.grnId);
    }
    if (filters.startDate) {
      conditions.push(`q.qc_date >= $${idx++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`q.qc_date <= $${idx++}`);
      params.push(filters.endDate);
    }
    if (filters.search) {
      conditions.push(`(
        q.qc_no ILIKE $${idx} OR
        g.grn_no ILIKE $${idx} OR
        p.party_name ILIKE $${idx} OR
        q.test_cert_no ILIKE $${idx} OR
        w.warehouse_name ILIKE $${idx}
      )`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const sql = `
      SELECT
        q.qc_id AS "qcId",
        q.qc_no AS "qcNo",
        TO_CHAR(q.qc_date, 'YYYY-MM-DD') AS "qcDate",
        q.grn_id AS "grnId",
        g.grn_no AS "grnNo",
        TO_CHAR(g.grn_date, 'YYYY-MM-DD') AS "grnDate",
        g.challan_no AS "challanNo",
        g.vehicle_no AS "vehicleNo",
        q.warehouse_id AS "warehouseId",
        w.warehouse_code AS "warehouseCode",
        w.warehouse_name AS "warehouseName",
        q.vendor_id AS "vendorId",
        p.party_code AS "vendorCode",
        p.party_name AS "vendorName",
        q.po_id AS "poId",
        po.po_no AS "poNo",
        ROUND(q.sample_size, 3)::FLOAT AS "sampleSize",
        q.inspection_type AS "inspectionType",
        q.overall_result AS "overallResult",
        q.inspector_id AS "inspectorId",
        u_ins.full_name AS "inspectorName",
        TO_CHAR(q.inspection_date, 'YYYY-MM-DD HH24:MI:SS') AS "inspectionDate",
        q.approver_id AS "approverId",
        u_app.full_name AS "approverName",
        TO_CHAR(q.approval_date, 'YYYY-MM-DD HH24:MI:SS') AS "approvalDate",
        q.remarks,
        q.deviation_reason AS "deviationReason",
        q.test_cert_no AS "testCertNo",
        TO_CHAR(q.test_cert_date, 'YYYY-MM-DD') AS "testCertDate",
        q.status,
        q.is_active AS "isActive",
        TO_CHAR(q.created_date, 'YYYY-MM-DD HH24:MI:SS') AS "createdDate",
        COALESCE(items.item_count, 0)::INT AS "itemCount",
        ROUND(COALESCE(items.total_received_qty, 0), 3)::FLOAT AS "totalReceivedQty",
        ROUND(COALESCE(items.total_accepted_qty, 0), 3)::FLOAT AS "totalAcceptedQty",
        ROUND(COALESCE(items.total_rejected_qty, 0), 3)::FLOAT AS "totalRejectedQty"
      FROM tbl_qc_inward_inspection_header q
      LEFT JOIN tbl_inv_grn_header g ON q.grn_id = g.grn_id
      LEFT JOIN tbl_inv_warehouse w ON q.warehouse_id = w.warehouse_id
      LEFT JOIN tbl_crm_party p ON q.vendor_id = p.party_id
      LEFT JOIN tbl_po_header po ON q.po_id = po.po_id
      LEFT JOIN tbl_sec_user u_ins ON q.inspector_id = u_ins.user_id
      LEFT JOIN tbl_sec_user u_app ON q.approver_id = u_app.user_id
      LEFT JOIN (
        SELECT
          qc_id,
          COUNT(*) AS item_count,
          SUM(received_qty) AS total_received_qty,
          SUM(accepted_qty) AS total_accepted_qty,
          SUM(rejected_qty) AS total_rejected_qty
        FROM tbl_qc_inward_inspection_item
        WHERE is_active = TRUE
        GROUP BY qc_id
      ) items ON q.qc_id = items.qc_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY q.qc_date DESC, q.qc_id DESC;
    `;

    const res = await this.pool.query(sql, params);
    return res.rows;
  }

  // --------------------------------------------------------------------------
  // Find By ID (with Item Lines & Observed Parameters)
  // --------------------------------------------------------------------------
  async findInspectionById(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const headSql = `
      SELECT
        q.qc_id AS "qcId",
        q.qc_no AS "qcNo",
        TO_CHAR(q.qc_date, 'YYYY-MM-DD') AS "qcDate",
        q.grn_id AS "grnId",
        g.grn_no AS "grnNo",
        TO_CHAR(g.grn_date, 'YYYY-MM-DD') AS "grnDate",
        g.challan_no AS "challanNo",
        TO_CHAR(g.challan_date, 'YYYY-MM-DD') AS "challanDate",
        g.vehicle_no AS "vehicleNo",
        q.warehouse_id AS "warehouseId",
        w.warehouse_code AS "warehouseCode",
        w.warehouse_name AS "warehouseName",
        q.vendor_id AS "vendorId",
        p.party_code AS "vendorCode",
        p.party_name AS "vendorName",
        p.gstin AS "vendorGstin",
        p.address_line1 AS "vendorAddress",
        q.po_id AS "poId",
        po.po_no AS "poNo",
        q.gate_inward_id AS "gateInwardId",
        gin.gate_inward_no AS "gateInwardNo",
        ROUND(q.sample_size, 3)::FLOAT AS "sampleSize",
        q.inspection_type AS "inspectionType",
        q.overall_result AS "overallResult",
        q.inspector_id AS "inspectorId",
        u_ins.full_name AS "inspectorName",
        TO_CHAR(q.inspection_date, 'YYYY-MM-DD HH24:MI:SS') AS "inspectionDate",
        q.approver_id AS "approverId",
        u_app.full_name AS "approverName",
        TO_CHAR(q.approval_date, 'YYYY-MM-DD HH24:MI:SS') AS "approvalDate",
        q.remarks,
        q.deviation_reason AS "deviationReason",
        q.test_cert_no AS "testCertNo",
        TO_CHAR(q.test_cert_date, 'YYYY-MM-DD') AS "testCertDate",
        q.status,
        q.is_active AS "isActive",
        TO_CHAR(q.created_date, 'YYYY-MM-DD HH24:MI:SS') AS "createdDate"
      FROM tbl_qc_inward_inspection_header q
      LEFT JOIN tbl_inv_grn_header g ON q.grn_id = g.grn_id
      LEFT JOIN tbl_inv_warehouse w ON q.warehouse_id = w.warehouse_id
      LEFT JOIN tbl_crm_party p ON q.vendor_id = p.party_id
      LEFT JOIN tbl_po_header po ON q.po_id = po.po_id
      LEFT JOIN tbl_gate_inward_header gin ON q.gate_inward_id = gin.gate_inward_id
      LEFT JOIN tbl_sec_user u_ins ON q.inspector_id = u_ins.user_id
      LEFT JOIN tbl_sec_user u_app ON q.approver_id = u_app.user_id
      WHERE q.qc_id = $1 AND q.comp_id = $2;
    `;
    const hRes = await this.pool.query(headSql, [id, compId]);
    if (hRes.rows.length === 0) {
      throw new NotFoundException(`QC Inspection #${id} not found.`);
    }
    const header = hRes.rows[0];

    const itemsSql = `
      SELECT
        qi.qc_item_id AS "qcItemId",
        qi.qc_id AS "qcId",
        qi.grn_item_id AS "grnItemId",
        qi.item_id AS "itemId",
        i.item_code AS "itemCode",
        i.item_name AS "itemName",
        COALESCE(i.description, i.item_name) AS "itemDescription",
        qi.uom_id AS "uomId",
        u.uom_code AS "uomCode",
        u.uom_name AS "uomName",
        ROUND(qi.received_qty, 3)::FLOAT AS "receivedQty",
        ROUND(qi.sample_qty, 3)::FLOAT AS "sampleQty",
        ROUND(qi.accepted_qty, 3)::FLOAT AS "acceptedQty",
        ROUND(qi.rejected_qty, 3)::FLOAT AS "rejectedQty",
        qi.disposition,
        qi.defect_code AS "defectCode",
        qi.batch_no AS "batchNo",
        qi.heat_no AS "heatNo",
        TO_CHAR(qi.mfg_date, 'YYYY-MM-DD') AS "mfgDate",
        TO_CHAR(qi.expiry_date, 'YYYY-MM-DD') AS "expiryDate",
        qi.quarantine_bin_id AS "quarantineBinId",
        qb.bin_code AS "quarantineBinCode",
        qb.bin_name AS "quarantineBinName",
        qi.destination_bin_id AS "destinationBinId",
        db.bin_code AS "destinationBinCode",
        db.bin_name AS "destinationBinName",
        qi.visual_check AS "visualCheck",
        qi.dimension_check AS "dimensionCheck",
        qi.chemical_test AS "chemicalTest",
        qi.hardness_test AS "hardnessTest",
        qi.observed_parameters AS "observedParameters",
        qi.remarks,
        qi.is_active AS "isActive"
      FROM tbl_qc_inward_inspection_item qi
      LEFT JOIN tbl_inv_item i ON qi.item_id = i.item_id
      LEFT JOIN tbl_inv_uom u ON qi.uom_id = u.uom_id
      LEFT JOIN tbl_inv_storage_bin qb ON qi.quarantine_bin_id = qb.bin_id
      LEFT JOIN tbl_inv_storage_bin db ON qi.destination_bin_id = db.bin_id
      WHERE qi.qc_id = $1 AND qi.is_active = TRUE
      ORDER BY qi.qc_item_id ASC;
    `;
    const iRes = await this.pool.query(itemsSql, [id]);

    return {
      ...header,
      items: iRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // Create QC Inspection
  // --------------------------------------------------------------------------
  async createInspection(
    dto: CreateQcInspectionDto,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item line is required for QC inspection.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const qcNo =
        dto.qcNo || (await this.generateQcNumber(compId, branchId));

      const insHeadSql = `
        INSERT INTO tbl_qc_inward_inspection_header (
          qc_no, qc_date, grn_id, warehouse_id, vendor_id, po_id, gate_inward_id,
          sample_size, inspection_type, overall_result,
          remarks, deviation_reason, test_cert_no, test_cert_date,
          status, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10,
          $11, $12, $13, $14,
          'DRAFT', TRUE,
          $15, $16, $17, $18
        )
        RETURNING qc_id;
      `;
      const headRes = await client.query(insHeadSql, [
        qcNo,
        dto.qcDate,
        dto.grnId,
        dto.warehouseId,
        dto.vendorId,
        dto.poId || null,
        dto.gateInwardId || null,
        Number(dto.sampleSize || 1.0),
        dto.inspectionType || 'INCOMING_RAW_MATERIAL',
        dto.overallResult || 'PENDING',
        dto.remarks?.trim() || null,
        dto.deviationReason?.trim() || null,
        dto.testCertNo?.trim() || null,
        dto.testCertDate || null,
        compId,
        branchId,
        fyearId,
        userId,
      ]);

      const qcId = headRes.rows[0].qc_id;

      for (const item of dto.items) {
        const rQty = Number(item.receivedQty || 0);
        const sQty = Number(item.sampleQty || 1.0);
        const aQty = Number(item.acceptedQty || 0);
        const rejQty = Number(item.rejectedQty || 0);

        const insItemSql = `
          INSERT INTO tbl_qc_inward_inspection_item (
            qc_id, grn_item_id, item_id, uom_id,
            received_qty, sample_qty, accepted_qty, rejected_qty,
            disposition, defect_code, batch_no, heat_no,
            mfg_date, expiry_date, quarantine_bin_id, destination_bin_id,
            visual_check, dimension_check, chemical_test, hardness_test,
            observed_parameters, remarks, is_active,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15, $16,
            $17, $18, $19, $20,
            $21, $22, TRUE,
            $23, $24, $25, $26
          );
        `;
        await client.query(insItemSql, [
          qcId,
          item.grnItemId,
          item.itemId,
          item.uomId,
          rQty,
          sQty,
          aQty,
          rejQty,
          item.disposition || 'ACCEPTED',
          item.defectCode?.trim() || null,
          item.batchNo?.trim() || null,
          item.heatNo?.trim() || null,
          item.mfgDate || null,
          item.expiryDate || null,
          item.quarantineBinId || null,
          item.destinationBinId || null,
          item.visualCheck || 'PASS',
          item.dimensionCheck || 'PASS',
          item.chemicalTest || 'PASS',
          item.hardnessTest || 'PASS',
          item.observedParameters ? JSON.stringify(item.observedParameters) : null,
          item.remarks?.trim() || null,
          compId,
          branchId,
          fyearId,
          userId,
        ]);
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'INWARD_QC',
        actionType: 'ADD',
        entityTable: 'tbl_qc_inward_inspection_header',
        recordId: qcId,
        newValue: { qcNo, grnId: dto.grnId },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findInspectionById(qcId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Update QC Inspection (Draft or In-Progress only)
  // --------------------------------------------------------------------------
  async updateInspection(
    id: number,
    dto: UpdateQcInspectionDto,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const existing = await this.pool.query(
      `SELECT qc_id, qc_no, status FROM tbl_qc_inward_inspection_header WHERE qc_id = $1 AND comp_id = $2;`,
      [id, compId],
    );
    if (existing.rows.length === 0) {
      throw new NotFoundException(`QC Inspection #${id} not found.`);
    }
    if (['COMPLETED', 'CANCELLED'].includes(existing.rows[0].status)) {
      throw new BadRequestException(
        `Cannot edit inspection in '${existing.rows[0].status}' state.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const updHeadSql = `
        UPDATE tbl_qc_inward_inspection_header
        SET
          qc_date = COALESCE($1, qc_date),
          warehouse_id = COALESCE($2, warehouse_id),
          vendor_id = COALESCE($3, vendor_id),
          po_id = COALESCE($4, po_id),
          gate_inward_id = COALESCE($5, gate_inward_id),
          sample_size = COALESCE($6, sample_size),
          inspection_type = COALESCE($7, inspection_type),
          overall_result = COALESCE($8, overall_result),
          remarks = COALESCE($9, remarks),
          deviation_reason = COALESCE($10, deviation_reason),
          test_cert_no = COALESCE($11, test_cert_no),
          test_cert_date = COALESCE($12, test_cert_date),
          updated_by = $13,
          updated_date = CURRENT_TIMESTAMP
        WHERE qc_id = $14 AND comp_id = $15;
      `;
      await client.query(updHeadSql, [
        dto.qcDate || null,
        dto.warehouseId || null,
        dto.vendorId || null,
        dto.poId || null,
        dto.gateInwardId || null,
        dto.sampleSize !== undefined ? Number(dto.sampleSize) : null,
        dto.inspectionType || null,
        dto.overallResult || null,
        dto.remarks?.trim() || null,
        dto.deviationReason?.trim() || null,
        dto.testCertNo?.trim() || null,
        dto.testCertDate || null,
        userId,
        id,
        compId,
      ]);

      if (dto.items && dto.items.length > 0) {
        await client.query(
          `DELETE FROM tbl_qc_inward_inspection_item WHERE qc_id = $1;`,
          [id],
        );

        for (const item of dto.items) {
          const rQty = Number(item.receivedQty || 0);
          const sQty = Number(item.sampleQty || 1.0);
          const aQty = Number(item.acceptedQty || 0);
          const rejQty = Number(item.rejectedQty || 0);

          const insItemSql = `
            INSERT INTO tbl_qc_inward_inspection_item (
              qc_id, grn_item_id, item_id, uom_id,
              received_qty, sample_qty, accepted_qty, rejected_qty,
              disposition, defect_code, batch_no, heat_no,
              mfg_date, expiry_date, quarantine_bin_id, destination_bin_id,
              visual_check, dimension_check, chemical_test, hardness_test,
              observed_parameters, remarks, is_active,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, $3, $4,
              $5, $6, $7, $8,
              $9, $10, $11, $12,
              $13, $14, $15, $16,
              $17, $18, $19, $20,
              $21, $22, TRUE,
              $23, $24, $25, $26
            );
          `;
          await client.query(insItemSql, [
            id,
            item.grnItemId,
            item.itemId,
            item.uomId,
            rQty,
            sQty,
            aQty,
            rejQty,
            item.disposition || 'ACCEPTED',
            item.defectCode?.trim() || null,
            item.batchNo?.trim() || null,
            item.heatNo?.trim() || null,
            item.mfgDate || null,
            item.expiryDate || null,
            item.quarantineBinId || null,
            item.destinationBinId || null,
            item.visualCheck || 'PASS',
            item.dimensionCheck || 'PASS',
            item.chemicalTest || 'PASS',
            item.hardnessTest || 'PASS',
            item.observedParameters ? JSON.stringify(item.observedParameters) : null,
            item.remarks?.trim() || null,
            compId,
            branchId,
            fyearId,
            userId,
          ]);
        }
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'INWARD_QC',
        actionType: 'EDIT',
        entityTable: 'tbl_qc_inward_inspection_header',
        recordId: id,
        oldValue: existing.rows[0],
        newValue: dto,
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findInspectionById(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Submit Inspection (DRAFT -> IN_PROGRESS)
  // --------------------------------------------------------------------------
  async submitInspection(
    id: number,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    const existing = await this.pool.query(
      `SELECT qc_id, qc_no, status FROM tbl_qc_inward_inspection_header WHERE qc_id = $1 AND comp_id = $2;`,
      [id, compId],
    );
    if (existing.rows.length === 0) {
      throw new NotFoundException(`QC Inspection #${id} not found.`);
    }
    const current = existing.rows[0];
    if (current.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT inspections can be submitted. Current status: '${current.status}'.`,
      );
    }

    await this.pool.query(
      `UPDATE tbl_qc_inward_inspection_header
       SET
         status = 'IN_PROGRESS',
         inspector_id = $1,
         inspection_date = CURRENT_TIMESTAMP,
         updated_by = $1,
         updated_date = CURRENT_TIMESTAMP
       WHERE qc_id = $2;`,
      [userId, id],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'INWARD_QC',
      actionType: 'SUBMIT',
      entityTable: 'tbl_qc_inward_inspection_header',
      recordId: id,
      oldValue: { status: 'DRAFT' },
      newValue: { status: 'IN_PROGRESS' },
      compId,
      branchId,
      fyearId,
      ...meta,
    });

    return this.findInspectionById(id, user);
  }

  // --------------------------------------------------------------------------
  // Approve Inspection & Release Quarantine Stock (-> COMPLETED)
  // --------------------------------------------------------------------------
  async approveInspection(
    id: number,
    dto: ApproveQcInspectionDto,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    const existing = await this.pool.query(
      `SELECT qc_id, qc_no, grn_id, po_id, gate_inward_id, status FROM tbl_qc_inward_inspection_header WHERE qc_id = $1 AND comp_id = $2;`,
      [id, compId],
    );
    if (existing.rows.length === 0) {
      throw new NotFoundException(`QC Inspection #${id} not found.`);
    }
    const current = existing.rows[0];
    if (current.status === 'COMPLETED') {
      throw new BadRequestException(`Inspection #${id} is already approved and completed.`);
    }
    if (current.status === 'CANCELLED') {
      throw new BadRequestException(`Cancelled inspection cannot be approved.`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Update items
      if (dto.items && dto.items.length > 0) {
        for (const it of dto.items) {
          await client.query(
            `UPDATE tbl_qc_inward_inspection_item
             SET
               accepted_qty = $1,
               rejected_qty = $2,
               destination_bin_id = COALESCE($3, destination_bin_id),
               disposition = COALESCE($4, disposition),
               remarks = COALESCE($5, remarks),
               updated_by = $6,
               updated_date = CURRENT_TIMESTAMP
             WHERE qc_item_id = $7 AND qc_id = $8;`,
            [
              Number(it.acceptedQty),
              Number(it.rejectedQty),
              it.destinationBinId || null,
              it.disposition || 'ACCEPTED',
              it.remarks?.trim() || null,
              userId,
              it.qcItemId,
              id,
            ],
          );
        }
      } else {
        // Auto-accept all items: accepted_qty = received_qty - rejected_qty
        await client.query(
          `UPDATE tbl_qc_inward_inspection_item
           SET
             accepted_qty = GREATEST(0, received_qty - rejected_qty),
             disposition = 'ACCEPTED',
             updated_by = $1,
             updated_date = CURRENT_TIMESTAMP
           WHERE qc_id = $2 AND accepted_qty = 0 AND rejected_qty = 0;`,
          [userId, id],
        );
      }

      // 2. Mark QC Header as COMPLETED
      const finalResult = dto.overallResult || 'ACCEPTED';
      await client.query(
        `UPDATE tbl_qc_inward_inspection_header
         SET
           status = 'COMPLETED',
           overall_result = $1,
           approver_id = $2,
           approval_date = CURRENT_TIMESTAMP,
           remarks = COALESCE($3, remarks),
           updated_by = $2,
           updated_date = CURRENT_TIMESTAMP
         WHERE qc_id = $4;`,
        [finalResult, userId, dto.approvalRemarks?.trim() || null, id],
      );

      // 3. Upstream update to tbl_inv_grn_item: release quarantine_qty to accepted_qty & storage_bin_id
      const itemsRes = await client.query(
        `SELECT grn_item_id, accepted_qty, rejected_qty, destination_bin_id, batch_no
         FROM tbl_qc_inward_inspection_item
         WHERE qc_id = $1 AND is_active = TRUE;`,
        [id],
      );

      for (const it of itemsRes.rows) {
        await client.query(
          `UPDATE tbl_inv_grn_item
           SET
             accepted_qty = $1,
             rejected_qty = $2,
             quarantine_qty = 0,
             storage_bin_id = COALESCE($3, storage_bin_id),
             batch_no = COALESCE($4, batch_no),
             updated_by = $5,
             updated_date = CURRENT_TIMESTAMP
           WHERE grn_item_id = $6;`,
          [
            Number(it.accepted_qty),
            Number(it.rejected_qty),
            it.destination_bin_id || null,
            it.batch_no || null,
            userId,
            it.grn_item_id,
          ],
        );
      }

      // 4. Update GRN Header: mark as APPROVED if all items cleared
      await client.query(
        `UPDATE tbl_inv_grn_header
         SET
           status = 'APPROVED',
           inspected_by = COALESCE(inspected_by, $1),
           inspection_date = COALESCE(inspection_date, CURRENT_TIMESTAMP),
           approved_by = $1,
           approval_date = CURRENT_TIMESTAMP,
           approval_remarks = COALESCE($2, approval_remarks),
           updated_by = $1,
           updated_date = CURRENT_TIMESTAMP
         WHERE grn_id = $3 AND status != 'APPROVED';`,
        [userId, dto.approvalRemarks?.trim() || null, current.grn_id],
      );

      // 5. Update PO items received quantities if linked
      const poItemsRes = await client.query(
        `SELECT gi.po_item_id, qi.accepted_qty
         FROM tbl_qc_inward_inspection_item qi
         JOIN tbl_inv_grn_item gi ON qi.grn_item_id = gi.grn_item_id
         WHERE qi.qc_id = $1 AND gi.po_item_id IS NOT NULL AND qi.is_active = TRUE;`,
        [id],
      );

      for (const poi of poItemsRes.rows) {
        await client.query(
          `UPDATE tbl_po_item
           SET received_qty = COALESCE(received_qty, 0) + $1, updated_by = $2, updated_date = CURRENT_TIMESTAMP
           WHERE po_item_id = $3;`,
          [Number(poi.accepted_qty), userId, poi.po_item_id],
        );
      }

      if (current.po_id) {
        const poCheck = await client.query(
          `SELECT
             COUNT(*)::INT AS total_items,
             COUNT(CASE WHEN received_qty >= order_qty THEN 1 END)::INT AS fulfilled_items,
             COALESCE(SUM(received_qty), 0)::FLOAT AS total_rec
           FROM tbl_po_item
           WHERE po_id = $1 AND is_active = TRUE;`,
          [current.po_id],
        );
        const { total_items, fulfilled_items, total_rec } = poCheck.rows[0];
        if (total_items > 0 && fulfilled_items === total_items) {
          await client.query(
            `UPDATE tbl_po_header
             SET status = 'COMPLETED', updated_by = $1, updated_date = CURRENT_TIMESTAMP
             WHERE po_id = $2;`,
            [userId, current.po_id],
          );
        } else if (total_rec > 0) {
          await client.query(
            `UPDATE tbl_po_header
             SET status = 'PARTIALLY_RECEIVED', updated_by = $1, updated_date = CURRENT_TIMESTAMP
             WHERE po_id = $2 AND status != 'COMPLETED';`,
            [userId, current.po_id],
          );
        }
      }

      // 6. Update Gate Inward status to COMPLETED if linked
      if (current.gate_inward_id) {
        await client.query(
          `UPDATE tbl_gate_inward_header
           SET status = 'COMPLETED', updated_by = $1, updated_date = CURRENT_TIMESTAMP
           WHERE gate_inward_id = $2;`,
          [userId, current.gate_inward_id],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'INWARD_QC',
        actionType: 'APPROVE',
        entityTable: 'tbl_qc_inward_inspection_header',
        recordId: id,
        oldValue: { status: current.status },
        newValue: { status: 'COMPLETED', overallResult: finalResult },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findInspectionById(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Reject Inspection (-> COMPLETED / REJECTED)
  // --------------------------------------------------------------------------
  async rejectInspection(
    id: number,
    dto: RejectQcInspectionDto,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    if (!dto.rejectionReason || dto.rejectionReason.trim() === '') {
      throw new BadRequestException('Rejection reason is mandatory.');
    }

    const existing = await this.pool.query(
      `SELECT qc_id, qc_no, grn_id, status FROM tbl_qc_inward_inspection_header WHERE qc_id = $1 AND comp_id = $2;`,
      [id, compId],
    );
    if (existing.rows.length === 0) {
      throw new NotFoundException(`QC Inspection #${id} not found.`);
    }
    const current = existing.rows[0];

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE tbl_qc_inward_inspection_header
         SET
           status = 'COMPLETED',
           overall_result = 'REJECTED',
           approver_id = $1,
           approval_date = CURRENT_TIMESTAMP,
           remarks = $2,
           updated_by = $1,
           updated_date = CURRENT_TIMESTAMP
         WHERE qc_id = $3;`,
        [userId, dto.rejectionReason.trim(), id],
      );

      // Reject all items: accepted_qty = 0, rejected_qty = received_qty
      await client.query(
        `UPDATE tbl_qc_inward_inspection_item
         SET
           accepted_qty = 0,
           rejected_qty = received_qty,
           disposition = 'REJECTED',
           defect_code = COALESCE($1, defect_code),
           remarks = $2,
           updated_by = $3,
           updated_date = CURRENT_TIMESTAMP
         WHERE qc_id = $4;`,
        [dto.defectCode || 'QC_NON_CONFORMING', dto.rejectionReason.trim(), userId, id],
      );

      // Update GRN items
      await client.query(
        `UPDATE tbl_inv_grn_item gi
         SET
           accepted_qty = 0,
           rejected_qty = qi.received_qty,
           quarantine_qty = 0,
           remarks = $1,
           updated_by = $2,
           updated_date = CURRENT_TIMESTAMP
         FROM tbl_qc_inward_inspection_item qi
         WHERE qi.qc_id = $3 AND gi.grn_item_id = qi.grn_item_id;`,
        [dto.rejectionReason.trim(), userId, id],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'INWARD_QC',
        actionType: 'REJECT',
        entityTable: 'tbl_qc_inward_inspection_header',
        recordId: id,
        oldValue: { status: current.status },
        newValue: { status: 'COMPLETED', overallResult: 'REJECTED', reason: dto.rejectionReason },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findInspectionById(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Cancel Inspection (-> CANCELLED)
  // --------------------------------------------------------------------------
  async cancelInspection(
    id: number,
    dto: CancelQcInspectionDto,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    if (!dto.cancelReason || dto.cancelReason.trim() === '') {
      throw new BadRequestException('Cancellation reason is required.');
    }

    const existing = await this.pool.query(
      `SELECT qc_id, qc_no, status FROM tbl_qc_inward_inspection_header WHERE qc_id = $1 AND comp_id = $2;`,
      [id, compId],
    );
    if (existing.rows.length === 0) {
      throw new NotFoundException(`QC Inspection #${id} not found.`);
    }

    await this.pool.query(
      `UPDATE tbl_qc_inward_inspection_header
       SET
         status = 'CANCELLED',
         deviation_reason = $1,
         updated_by = $2,
         updated_date = CURRENT_TIMESTAMP
       WHERE qc_id = $3;`,
      [dto.cancelReason.trim(), userId, id],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'INWARD_QC',
      actionType: 'CANCEL',
      entityTable: 'tbl_qc_inward_inspection_header',
      recordId: id,
      oldValue: { status: existing.rows[0].status },
      newValue: { status: 'CANCELLED', cancelReason: dto.cancelReason },
      compId,
      branchId,
      fyearId,
      ...meta,
    });

    return this.findInspectionById(id, user);
  }

  // --------------------------------------------------------------------------
  // Delete Inspection (DRAFT only)
  // --------------------------------------------------------------------------
  async deleteInspection(
    id: number,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    const existing = await this.pool.query(
      `SELECT qc_id, qc_no, status FROM tbl_qc_inward_inspection_header WHERE qc_id = $1 AND comp_id = $2;`,
      [id, compId],
    );
    if (existing.rows.length === 0) {
      throw new NotFoundException(`QC Inspection #${id} not found.`);
    }
    const current = existing.rows[0];
    if (current.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT inspections can be permanently deleted. Current status: '${current.status}'.`,
      );
    }

    await this.dependencyCheckService.verifyCanDelete({
      entity: 'Inward QC Inspection',
      entityId: id,
      relations: [],
    });

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM tbl_qc_inward_inspection_item WHERE qc_id = $1;`, [id]);
      await client.query(`DELETE FROM tbl_qc_inward_inspection_header WHERE qc_id = $1;`, [id]);
      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'INWARD_QC',
        actionType: 'DELETE',
        entityTable: 'tbl_qc_inward_inspection_header',
        recordId: id,
        oldValue: current,
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return { success: true, message: `QC Inspection ${current.qc_no} deleted successfully.` };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Helpers: Pending GRNs for QC Inspection
  // --------------------------------------------------------------------------
  async getPendingGrns(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const sql = `
      SELECT
        g.grn_id AS "grnId",
        g.grn_no AS "grnNo",
        TO_CHAR(g.grn_date, 'YYYY-MM-DD') AS "grnDate",
        g.warehouse_id AS "warehouseId",
        w.warehouse_name AS "warehouseName",
        g.vendor_id AS "vendorId",
        p.party_name AS "vendorName",
        g.po_id AS "poId",
        po.po_no AS "poNo",
        g.gate_inward_id AS "gateInwardId",
        g.challan_no AS "challanNo",
        TO_CHAR(g.challan_date, 'YYYY-MM-DD') AS "challanDate",
        g.vehicle_no AS "vehicleNo",
        g.status
      FROM tbl_inv_grn_header g
      LEFT JOIN tbl_inv_warehouse w ON g.warehouse_id = w.warehouse_id
      LEFT JOIN tbl_crm_party p ON g.vendor_id = p.party_id
      LEFT JOIN tbl_po_header po ON g.po_id = po.po_id
      WHERE g.comp_id = $1 AND g.is_active = TRUE
        AND ($2::BIGINT IS NULL OR g.branch_id = $2::BIGINT)
        AND g.status IN ('SUBMITTED', 'QC_IN_PROGRESS')
      ORDER BY g.grn_date DESC, g.grn_id DESC;
    `;
    const res = await this.pool.query(sql, [compId, branchId]);
    return res.rows;
  }

  // --------------------------------------------------------------------------
  // Helpers: GRN Items by GRN ID
  // --------------------------------------------------------------------------
  async getGrnItems(grnId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const sql = `
      SELECT
        gi.grn_item_id AS "grnItemId",
        gi.grn_id AS "grnId",
        gi.item_id AS "itemId",
        i.item_code AS "itemCode",
        i.item_name AS "itemName",
        COALESCE(gi.item_description, i.description, i.item_name) AS "itemDescription",
        gi.uom_id AS "uomId",
        u.uom_code AS "uomCode",
        ROUND(gi.received_qty, 3)::FLOAT AS "receivedQty",
        ROUND(gi.quarantine_qty, 3)::FLOAT AS "quarantineQty",
        gi.batch_no AS "batchNo",
        TO_CHAR(gi.mfg_date, 'YYYY-MM-DD') AS "mfgDate",
        TO_CHAR(gi.expiry_date, 'YYYY-MM-DD') AS "expiryDate",
        gi.quarantine_bin_id AS "quarantineBinId",
        gi.storage_bin_id AS "storageBinId"
      FROM tbl_inv_grn_item gi
      LEFT JOIN tbl_inv_item i ON gi.item_id = i.item_id
      LEFT JOIN tbl_inv_uom u ON gi.uom_id = u.uom_id
      WHERE gi.grn_id = $1 AND gi.comp_id = $2 AND gi.is_active = TRUE
      ORDER BY gi.grn_item_id ASC;
    `;
    const res = await this.pool.query(sql, [grnId, compId]);
    return res.rows;
  }

  // --------------------------------------------------------------------------
  // Helpers: Storage Bins by Warehouse
  // --------------------------------------------------------------------------
  async getStorageBins(warehouseId?: number, user?: AuthenticatedUserContext) {
    const compId = user?.compId || 1001;

    const conditions: string[] = [`b.comp_id = $1`, `b.is_active = TRUE`];
    const params: any[] = [compId];

    if (warehouseId) {
      conditions.push(`b.warehouse_id = $2`);
      params.push(warehouseId);
    }

    const sql = `
      SELECT
        b.bin_id AS "binId",
        b.warehouse_id AS "warehouseId",
        w.warehouse_name AS "warehouseName",
        b.bin_code AS "binCode",
        b.bin_name AS "binName",
        b.bin_type AS "binType",
        b.is_receiving_staging AS "isReceivingStaging"
      FROM tbl_inv_storage_bin b
      LEFT JOIN tbl_inv_warehouse w ON b.warehouse_id = w.warehouse_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY b.warehouse_id ASC, b.bin_code ASC;
    `;
    const res = await this.pool.query(sql, params);
    return res.rows;
  }
}
