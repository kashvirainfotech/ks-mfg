import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { DependencyCheckService } from '../../../common/services/dependency-check.service';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import {
  AuthorizeRequisitionDto,
  CreateRequisitionDto,
  RequisitionFilterDto,
  UpdateRequisitionDto,
} from './requisition.dto';

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

@Injectable()
export class RequisitionService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // ==========================================================================
  // KPI SUMMARY
  // ==========================================================================

  async getRequisitionSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const { rows } = await this.pool.query(
      `
      SELECT
        COUNT(*)::int AS "totalRequisitions",
        COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END)::int AS "pendingCount",
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END)::int AS "approvedCount",
        COUNT(CASE WHEN priority IN ('CRITICAL_URGENT', 'HIGH') AND status NOT IN ('REJECTED', 'CANCELLED') THEN 1 END)::int AS "criticalCount",
        COUNT(CASE WHEN status = 'DRAFT' THEN 1 END)::int AS "draftCount"
      FROM tbl_pr_header
      WHERE comp_id = $1 AND is_active = true
      `,
      [compId],
    );

    const r = rows[0] || {};
    return {
      totalRequisitions: Number(r.totalRequisitions) || 0,
      pendingCount: Number(r.pendingCount) || 0,
      approvedCount: Number(r.approvedCount) || 0,
      criticalCount: Number(r.criticalCount) || 0,
      draftCount: Number(r.draftCount) || 0,
    };
  }

  // ==========================================================================
  // RETRIEVAL & LISTING
  // ==========================================================================

  async findAllRequisitions(
    filters: RequisitionFilterDto,
    user: AuthenticatedUserContext,
  ) {
    const compId = user.compId || 1001;
    const conditions: string[] = ['pr.comp_id = $1', 'pr.is_active = true'];
    const params: unknown[] = [compId];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`pr.status = $${params.length}`);
    }

    if (filters.priority) {
      params.push(filters.priority);
      conditions.push(`pr.priority = $${params.length}`);
    }

    if (filters.prType) {
      params.push(filters.prType);
      conditions.push(`pr.pr_type = $${params.length}`);
    }

    if (filters.departmentId) {
      params.push(filters.departmentId);
      conditions.push(`pr.department_id = $${params.length}`);
    }

    if (filters.warehouseId) {
      params.push(filters.warehouseId);
      conditions.push(`pr.warehouse_id = $${params.length}`);
    }

    if (filters.search) {
      params.push(`%${filters.search.trim().toLowerCase()}%`);
      conditions.push(
        `(LOWER(pr.pr_no) LIKE $${params.length} OR LOWER(pr.purpose) LIKE $${params.length} OR LOWER(d.dept_name) LIKE $${params.length} OR LOWER(w.warehouse_name) LIKE $${params.length})`,
      );
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT
        pr.pr_id                      AS "prId",
        pr.pr_no                      AS "prNo",
        TO_CHAR(pr.pr_date, 'YYYY-MM-DD')          AS "prDate",
        TO_CHAR(pr.required_by_date, 'YYYY-MM-DD') AS "requiredByDate",
        pr.department_id              AS "departmentId",
        d.dept_code                   AS "departmentCode",
        d.dept_name                   AS "departmentName",
        pr.requester_user_id          AS "requesterUserId",
        u.full_name                   AS "requesterName",
        pr.warehouse_id               AS "warehouseId",
        w.warehouse_code              AS "warehouseCode",
        w.warehouse_name              AS "warehouseName",
        pr.priority                   AS "priority",
        pr.pr_type                    AS "prType",
        pr.status                     AS "status",
        pr.total_estimated_amount::float AS "totalEstimatedAmount",
        pr.purpose                    AS "purpose",
        pr.approval_remarks           AS "approvalRemarks",
        pr.approved_by                AS "approvedBy",
        app_u.full_name               AS "approvedByName",
        pr.approved_date              AS "approvedDate",
        pr.is_active                  AS "isActive",
        pr.created_date               AS "createdDate",
        COUNT(pri.pr_item_id)::int    AS "itemsCount"
      FROM tbl_pr_header pr
      JOIN tbl_hr_department d ON d.dept_id = pr.department_id
      JOIN tbl_sec_user u ON u.user_id = pr.requester_user_id
      JOIN tbl_inv_warehouse w ON w.warehouse_id = pr.warehouse_id
      LEFT JOIN tbl_sec_user app_u ON app_u.user_id = pr.approved_by
      LEFT JOIN tbl_pr_item pri ON pri.pr_id = pr.pr_id
      WHERE ${whereClause}
      GROUP BY pr.pr_id, d.dept_code, d.dept_name, u.full_name, w.warehouse_code, w.warehouse_name, app_u.full_name
      ORDER BY
        CASE pr.priority
          WHEN 'CRITICAL_URGENT' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          ELSE 4
        END ASC,
        pr.pr_date DESC,
        pr.pr_id DESC
    `;

    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async findRequisitionById(prId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const { rows } = await this.pool.query(
      `
      SELECT
        pr.pr_id                      AS "prId",
        pr.pr_no                      AS "prNo",
        TO_CHAR(pr.pr_date, 'YYYY-MM-DD')          AS "prDate",
        TO_CHAR(pr.required_by_date, 'YYYY-MM-DD') AS "requiredByDate",
        pr.department_id              AS "departmentId",
        d.dept_code                   AS "departmentCode",
        d.dept_name                   AS "departmentName",
        pr.requester_user_id          AS "requesterUserId",
        u.full_name                   AS "requesterName",
        pr.warehouse_id               AS "warehouseId",
        w.warehouse_code              AS "warehouseCode",
        w.warehouse_name              AS "warehouseName",
        pr.priority                   AS "priority",
        pr.pr_type                    AS "prType",
        pr.status                     AS "status",
        pr.total_estimated_amount::float AS "totalEstimatedAmount",
        pr.purpose                    AS "purpose",
        pr.approval_remarks           AS "approvalRemarks",
        pr.approved_by                AS "approvedBy",
        app_u.full_name               AS "approvedByName",
        pr.approved_date              AS "approvedDate",
        pr.rejected_by                AS "rejectedBy",
        rej_u.full_name               AS "rejectedByName",
        pr.rejected_date              AS "rejectedDate",
        pr.is_active                  AS "isActive",
        pr.created_date               AS "createdDate",
        pr.updated_date               AS "updatedDate"
      FROM tbl_pr_header pr
      JOIN tbl_hr_department d ON d.dept_id = pr.department_id
      JOIN tbl_sec_user u ON u.user_id = pr.requester_user_id
      JOIN tbl_inv_warehouse w ON w.warehouse_id = pr.warehouse_id
      LEFT JOIN tbl_sec_user app_u ON app_u.user_id = pr.approved_by
      LEFT JOIN tbl_sec_user rej_u ON rej_u.user_id = pr.rejected_by
      WHERE pr.pr_id = $1 AND pr.comp_id = $2
      `,
      [prId, compId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Purchase Requisition with ID ${prId} not found`);
    }

    const header = rows[0];

    // Fetch line items with item, uom, and suggested vendor details
    const itemsRes = await this.pool.query(
      `
      SELECT
        pri.pr_item_id            AS "prItemId",
        pri.pr_id                 AS "prId",
        pri.item_id               AS "itemId",
        i.item_code               AS "itemCode",
        i.item_name               AS "itemName",
        i.item_type               AS "itemType",
        pri.uom_id                AS "uomId",
        u.uom_code                AS "uomCode",
        u.uom_name                AS "uomName",
        pri.required_qty::float   AS "requiredQty",
        pri.approved_qty::float   AS "approvedQty",
        pri.ordered_qty::float    AS "orderedQty",
        pri.estimated_rate::float AS "estimatedRate",
        pri.estimated_amount::float AS "estimatedAmount",
        pri.suggested_vendor_id   AS "suggestedVendorId",
        p.party_name              AS "suggestedVendorName",
        pri.remarks               AS "remarks",
        pri.is_active             AS "isActive"
      FROM tbl_pr_item pri
      JOIN tbl_inv_item i ON i.item_id = pri.item_id
      JOIN tbl_inv_uom u ON u.uom_id = pri.uom_id
      LEFT JOIN tbl_crm_party p ON p.party_id = pri.suggested_vendor_id
      WHERE pri.pr_id = $1
      ORDER BY pri.pr_item_id ASC
      `,
      [prId],
    );

    return {
      ...header,
      items: itemsRes.rows,
    };
  }

  // ==========================================================================
  // CREATE
  // ==========================================================================

  async createRequisition(
    dto: CreateRequisitionDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Requisition must have at least one line item');
    }

    // Auto-generate PR number if blank or AUTO
    let prNo = dto.prNo?.trim().toUpperCase();
    if (!prNo || prNo === 'AUTO') {
      const yearStr = new Date().getFullYear().toString().slice(-2);
      const nextYearStr = (new Date().getFullYear() + 1).toString().slice(-2);
      const { rows: countRes } = await this.pool.query(
        `SELECT COUNT(*)::int AS count FROM tbl_pr_header WHERE comp_id = $1`,
        [compId],
      );
      const seq = (Number(countRes[0]?.count) || 0) + 1;
      prNo = `PR-AHM-${yearStr}${nextYearStr}-${seq.toString().padStart(4, '0')}`;
    }

    // Check duplicate PR No
    const { rows: existing } = await this.pool.query(
      `SELECT pr_id FROM tbl_pr_header WHERE comp_id = $1 AND LOWER(pr_no) = LOWER($2)`,
      [compId, prNo],
    );
    if (existing.length > 0) {
      throw new ConflictException(`Requisition number "${prNo}" already exists for this company.`);
    }

    // Calculate total estimated amount
    let totalEst = 0;
    for (const it of dto.items) {
      const amount = (Number(it.requiredQty) || 0) * (Number(it.estimatedRate) || 0);
      totalEst += amount;
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const insertHeaderSql = `
        INSERT INTO tbl_pr_header (
          pr_no, pr_date, required_by_date, department_id, requester_user_id,
          warehouse_id, priority, pr_type, status, total_estimated_amount,
          purpose, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, COALESCE($2, CURRENT_DATE), $3, $4, $5,
          $6, $7, $8, 'DRAFT', $9,
          $10, true,
          $11, $12, $13, $14
        ) RETURNING pr_id
      `;

      const headerRes = await client.query(insertHeaderSql, [
        prNo,
        dto.prDate || null,
        dto.requiredByDate,
        dto.departmentId,
        userId,
        dto.warehouseId,
        dto.priority || 'MEDIUM',
        dto.prType || 'RAW_MATERIAL',
        totalEst.toFixed(2),
        dto.purpose.trim(),
        compId,
        branchId,
        fyearId,
        userId,
      ]);

      const prId = headerRes.rows[0].pr_id;

      for (const it of dto.items) {
        const requiredQty = Number(it.requiredQty) || 0;
        const estimatedRate = Number(it.estimatedRate) || 0;
        const estimatedAmount = Number((requiredQty * estimatedRate).toFixed(2));

        await client.query(
          `
          INSERT INTO tbl_pr_item (
            pr_id, item_id, uom_id, required_qty, approved_qty, ordered_qty,
            estimated_rate, estimated_amount, suggested_vendor_id, remarks, is_active,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4, 0.000, 0.000,
            $5, $6, $7, $8, true,
            $9, $10, $11, $12
          )
          `,
          [
            prId,
            it.itemId,
            it.uomId,
            requiredQty,
            estimatedRate,
            estimatedAmount,
            it.suggestedVendorId || null,
            it.remarks?.trim() || null,
            compId,
            branchId,
            fyearId,
            userId,
          ],
        );
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PURCHASE_REQ',
        actionType: 'ADD',
        entityTable: 'tbl_pr_header',
        recordId: prId,
        oldValue: null,
        newValue: {
          prId,
          prNo,
          requiredByDate: dto.requiredByDate,
          priority: dto.priority,
          totalEstimatedAmount: totalEst,
          itemsCount: dto.items.length,
        },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findRequisitionById(prId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  async updateRequisition(
    prId: number,
    dto: UpdateRequisitionDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const existing = await this.findRequisitionById(prId, user);

    if (existing.status !== 'DRAFT' && existing.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Cannot edit a requisition with status "${existing.status}". Only DRAFT or SUBMITTED requisitions can be modified.`,
      );
    }

    if (dto.prNo && dto.prNo.trim().toUpperCase() !== existing.prNo) {
      const cleanPrNo = dto.prNo.trim().toUpperCase();
      const { rows: conflict } = await this.pool.query(
        `SELECT pr_id FROM tbl_pr_header WHERE comp_id = $1 AND LOWER(pr_no) = LOWER($2) AND pr_id <> $3`,
        [compId, cleanPrNo, prId],
      );
      if (conflict.length > 0) {
        throw new ConflictException(`Requisition number "${cleanPrNo}" is already in use.`);
      }
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let totalEst = existing.totalEstimatedAmount;
      if (Array.isArray(dto.items)) {
        totalEst = dto.items.reduce(
          (acc, it) =>
            acc + (Number(it.requiredQty) || 0) * (Number(it.estimatedRate) || 0),
          0,
        );
      }

      const updateHeaderSql = `
        UPDATE tbl_pr_header
        SET
          pr_no                  = COALESCE($1, pr_no),
          pr_date                = COALESCE($2, pr_date),
          required_by_date       = COALESCE($3, required_by_date),
          department_id          = COALESCE($4, department_id),
          warehouse_id           = COALESCE($5, warehouse_id),
          priority               = COALESCE($6, priority),
          pr_type                = COALESCE($7, pr_type),
          purpose                = COALESCE($8, purpose),
          total_estimated_amount = $9,
          updated_by             = $10,
          updated_date           = CURRENT_TIMESTAMP
        WHERE pr_id = $11 AND comp_id = $12
      `;

      await client.query(updateHeaderSql, [
        dto.prNo ? dto.prNo.trim().toUpperCase() : null,
        dto.prDate || null,
        dto.requiredByDate || null,
        dto.departmentId || null,
        dto.warehouseId || null,
        dto.priority || null,
        dto.prType || null,
        dto.purpose ? dto.purpose.trim() : null,
        totalEst.toFixed(2),
        userId,
        prId,
        compId,
      ]);

      if (Array.isArray(dto.items)) {
        await client.query(`DELETE FROM tbl_pr_item WHERE pr_id = $1`, [prId]);

        for (const it of dto.items) {
          const requiredQty = Number(it.requiredQty) || 0;
          const estimatedRate = Number(it.estimatedRate) || 0;
          const estimatedAmount = Number((requiredQty * estimatedRate).toFixed(2));

          await client.query(
            `
            INSERT INTO tbl_pr_item (
              pr_id, item_id, uom_id, required_qty, approved_qty, ordered_qty,
              estimated_rate, estimated_amount, suggested_vendor_id, remarks, is_active,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, $3, $4, 0.000, 0.000,
              $5, $6, $7, $8, true,
              $9, $10, $11, $12
            )
            `,
            [
              prId,
              it.itemId,
              it.uomId,
              requiredQty,
              estimatedRate,
              estimatedAmount,
              it.suggestedVendorId || null,
              it.remarks?.trim() || null,
              compId,
              branchId,
              fyearId,
              userId,
            ],
          );
        }
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PURCHASE_REQ',
        actionType: 'EDIT',
        entityTable: 'tbl_pr_header',
        recordId: prId,
        oldValue: {
          prNo: existing.prNo,
          status: existing.status,
          totalEstimatedAmount: existing.totalEstimatedAmount,
        },
        newValue: {
          prNo: dto.prNo || existing.prNo,
          totalEstimatedAmount: totalEst,
        },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findRequisitionById(prId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // SUBMIT FOR APPROVAL
  // ==========================================================================

  async submitRequisition(
    prId: number,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const existing = await this.findRequisitionById(prId, user);

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT requisitions can be submitted. Current status: ${existing.status}`,
      );
    }

    await this.pool.query(
      `
      UPDATE tbl_pr_header
      SET status = 'SUBMITTED', updated_by = $1, updated_date = CURRENT_TIMESTAMP
      WHERE pr_id = $2 AND comp_id = $3
      `,
      [user.userId, prId, compId],
    );

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'PURCHASE_REQ',
      actionType: 'EDIT',
      entityTable: 'tbl_pr_header',
      recordId: prId,
      oldValue: { status: 'DRAFT' },
      newValue: { status: 'SUBMITTED' },
      compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return this.findRequisitionById(prId, user);
  }

  // ==========================================================================
  // AUTHORIZE (APPROVE / REJECT)
  // ==========================================================================

  async authorizeRequisition(
    prId: number,
    dto: AuthorizeRequisitionDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;
    const existing = await this.findRequisitionById(prId, user);

    if (existing.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Only SUBMITTED requisitions can be authorized. Current status: ${existing.status}`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      if (dto.action === 'APPROVE') {
        // If line item approved quantities passed, update them
        if (Array.isArray(dto.items) && dto.items.length > 0) {
          for (const itemAuth of dto.items) {
            await client.query(
              `
              UPDATE tbl_pr_item
              SET
                approved_qty = $1,
                estimated_amount = ($1 * estimated_rate)
              WHERE pr_item_id = $2 AND pr_id = $3
              `,
              [itemAuth.approvedQty, itemAuth.prItemId, prId],
            );
          }
        } else {
          // Default: set approved_qty = required_qty for all items
          await client.query(
            `
            UPDATE tbl_pr_item
            SET
              approved_qty = required_qty,
              estimated_amount = (required_qty * estimated_rate)
            WHERE pr_id = $1
            `,
            [prId],
          );
        }

        // Recalculate total estimated amount based on approved_qty
        const { rows: sumRes } = await client.query(
          `SELECT SUM(estimated_amount)::numeric(14,2) AS total FROM tbl_pr_item WHERE pr_id = $1`,
          [prId],
        );
        const newTotal = Number(sumRes[0]?.total) || 0;

        await client.query(
          `
          UPDATE tbl_pr_header
          SET
            status = 'APPROVED',
            approved_by = $1,
            approved_date = CURRENT_TIMESTAMP,
            approval_remarks = $2,
            total_estimated_amount = $3,
            updated_by = $1,
            updated_date = CURRENT_TIMESTAMP
          WHERE pr_id = $4 AND comp_id = $5
          `,
          [userId, dto.remarks?.trim() || 'Approved', newTotal, prId, compId],
        );
      } else {
        // REJECT
        if (!dto.remarks?.trim()) {
          throw new BadRequestException('Rejection remarks are mandatory when rejecting a requisition');
        }

        await client.query(
          `
          UPDATE tbl_pr_header
          SET
            status = 'REJECTED',
            rejected_by = $1,
            rejected_date = CURRENT_TIMESTAMP,
            approval_remarks = $2,
            updated_by = $1,
            updated_date = CURRENT_TIMESTAMP
          WHERE pr_id = $3 AND comp_id = $4
          `,
          [userId, dto.remarks.trim(), prId, compId],
        );
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PURCHASE_REQ',
        actionType: 'AUTHORIZE',
        entityTable: 'tbl_pr_header',
        recordId: prId,
        oldValue: { status: 'SUBMITTED' },
        newValue: {
          status: dto.action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          approvalRemarks: dto.remarks,
        },
        compId,
        branchId: user.branchId,
        fyearId: user.fyearId,
        ...meta,
      });

      return this.findRequisitionById(prId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // DELETE
  // ==========================================================================

  async deleteRequisition(
    prId: number,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const existing = await this.findRequisitionById(prId, user);

    if (existing.status !== 'DRAFT' && existing.status !== 'CANCELLED') {
      throw new BadRequestException(
        `Cannot delete a requisition with status "${existing.status}". Only DRAFT or CANCELLED requisitions can be deleted.`,
      );
    }

    // Verify dependencies before deletion
    await this.dependencyCheckService.verifyCanDelete({
      entity: 'tbl_pr_header',
      entityId: prId,
      relations: [
        {
          table: 'tbl_rfq_item',
          column: 'pr_id',
          label: 'Request for Quotations (RFQ)',
        },
        {
          table: 'tbl_po_item',
          column: 'pr_id',
          label: 'Purchase Orders',
        },
      ],
    });

    await this.pool.query(
      `DELETE FROM tbl_pr_header WHERE pr_id = $1 AND comp_id = $2`,
      [prId, compId],
    );

    // Audit Log
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'PURCHASE_REQ',
      actionType: 'DELETE',
      entityTable: 'tbl_pr_header',
      recordId: prId,
      oldValue: {
        prId,
        prNo: existing.prNo,
        status: existing.status,
      },
      newValue: null,
      compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return {
      success: true,
      message: `Purchase Requisition ${existing.prNo} deleted successfully`,
    };
  }

  // ==========================================================================
  // SCREEN ACTION AUDIT
  // ==========================================================================

  async recordScreenAction(
    actionType: 'PRINT' | 'EXPORT',
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'PURCHASE_REQ',
      actionType,
      entityTable: 'tbl_pr_header',
      recordId: 0,
      oldValue: null,
      newValue: { actionType, screenCode: 'PURCHASE_REQ' },
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });
    return { logged: true };
  }
}
