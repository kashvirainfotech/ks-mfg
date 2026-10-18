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
import {
  AssignPutAwayDto,
  CancelPutAwayDto,
  ConfirmPutAwayDto,
  CreatePutAwayDto,
  PutAwayFilterDto,
  UpdatePutAwayDto,
} from './put-away.dto';

@Injectable()
export class PutAwayService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  private async generatePutAwayNo(
    compId: number,
    branchId: number,
  ): Promise<string> {
    const branchRes = await this.pool.query(
      `SELECT branch_code FROM tbl_org_branch WHERE branch_id = $1`,
      [branchId],
    );
    const branchCode = branchRes.rows[0]?.branch_code || 'MAIN';

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const fyStart = currentMonth >= 4 ? currentYear : currentYear - 1;
    const fyEnd = (fyStart + 1) % 100;
    const fyCode = `${String(fyStart).slice(-2)}${String(fyEnd).padStart(2, '0')}`;

    const seqRes = await this.pool.query(
      `SELECT COUNT(*)::int as count FROM tbl_inv_putaway_header 
       WHERE comp_id = $1 AND branch_id = $2 
       AND putaway_no LIKE $3`,
      [compId, branchId, `PUT-${branchCode}-${fyCode}-%`],
    );
    const nextSeq = (seqRes.rows[0]?.count || 0) + 1;
    return `PUT-${branchCode}-${fyCode}-${String(nextSeq).padStart(4, '0')}`;
  }

  async getSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const res = await this.pool.query(
      `SELECT 
        COUNT(*)::int as "totalTasks",
        COUNT(CASE WHEN status IN ('DRAFT', 'ASSIGNED') THEN 1 END)::int as "pendingCount",
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END)::int as "inProgressCount",
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int as "completedCount",
        COALESCE(SUM(total_qty), 0)::numeric as "totalPutawayQty"
       FROM tbl_inv_putaway_header
       WHERE comp_id = $1 AND is_active = TRUE
         AND ($2::BIGINT IS NULL OR branch_id = $2::BIGINT)`,
      [compId, branchId],
    );
    return (
      res.rows[0] || {
        totalTasks: 0,
        pendingCount: 0,
        inProgressCount: 0,
        completedCount: 0,
        totalPutawayQty: 0,
      }
    );
  }

  async findAll(user: AuthenticatedUserContext, filters: PutAwayFilterDto) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const conditions: string[] = [
      `p.comp_id = $1`,
      `p.is_active = TRUE`,
    ];
    const params: any[] = [compId];
    let pIdx = 2;

    if (branchId) {
      conditions.push(`p.branch_id = $${pIdx++}`);
      params.push(branchId);
    }
    if (filters.status && filters.status !== 'ALL') {
      conditions.push(`p.status = $${pIdx++}`);
      params.push(filters.status);
    }
    if (filters.putawayType && filters.putawayType !== 'ALL') {
      conditions.push(`p.putaway_type = $${pIdx++}`);
      params.push(filters.putawayType);
    }
    if (filters.warehouseId) {
      conditions.push(`p.warehouse_id = $${pIdx++}`);
      params.push(filters.warehouseId);
    }
    if (filters.assignedTo) {
      conditions.push(`p.assigned_to = $${pIdx++}`);
      params.push(filters.assignedTo);
    }
    if (filters.fromDate) {
      conditions.push(`p.putaway_date >= $${pIdx++}`);
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      conditions.push(`p.putaway_date <= $${pIdx++}`);
      params.push(filters.toDate);
    }
    if (filters.search) {
      conditions.push(
        `(p.putaway_no ILIKE $${pIdx} OR w.warehouse_name ILIKE $${pIdx} OR g.grn_no ILIKE $${pIdx} OR q.qc_no ILIKE $${pIdx} OR u.full_name ILIKE $${pIdx})`,
      );
      params.push(`%${filters.search}%`);
      pIdx++;
    }

    const query = `
      SELECT 
        p.putaway_id as "putawayId",
        p.putaway_no as "putawayNo",
        TO_CHAR(p.putaway_date, 'YYYY-MM-DD') as "putawayDate",
        p.warehouse_id as "warehouseId",
        w.warehouse_name as "warehouseName",
        w.warehouse_code as "warehouseCode",
        p.grn_id as "grnId",
        g.grn_no as "grnNo",
        p.qc_id as "qcId",
        q.qc_no as "qcNo",
        p.assigned_to as "assignedTo",
        u.full_name as "assignedToName",
        p.putaway_type as "putawayType",
        p.status,
        p.total_items as "totalItems",
        ROUND(p.total_qty, 3)::float as "totalQty",
        TO_CHAR(p.completed_date, 'YYYY-MM-DD HH24:MI:SS') as "completedDate",
        p.completed_by as "completedBy",
        cu.full_name as "completedByName",
        p.remarks,
        p.cancel_reason as "cancelReason",
        p.created_date as "createdDate"
      FROM tbl_inv_putaway_header p
      JOIN tbl_inv_warehouse w ON p.warehouse_id = w.warehouse_id
      LEFT JOIN tbl_inv_grn_header g ON p.grn_id = g.grn_id
      LEFT JOIN tbl_qc_inward_inspection_header q ON p.qc_id = q.qc_id
      LEFT JOIN tbl_sec_user u ON p.assigned_to = u.user_id
      LEFT JOIN tbl_sec_user cu ON p.completed_by = cu.user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY p.putaway_date DESC, p.putaway_id DESC
    `;

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async findById(putawayId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const hRes = await this.pool.query(
      `SELECT 
        p.putaway_id as "putawayId",
        p.putaway_no as "putawayNo",
        TO_CHAR(p.putaway_date, 'YYYY-MM-DD') as "putawayDate",
        p.warehouse_id as "warehouseId",
        w.warehouse_name as "warehouseName",
        w.warehouse_code as "warehouseCode",
        p.grn_id as "grnId",
        g.grn_no as "grnNo",
        p.qc_id as "qcId",
        q.qc_no as "qcNo",
        p.assigned_to as "assignedTo",
        u.full_name as "assignedToName",
        p.putaway_type as "putawayType",
        p.status,
        p.total_items as "totalItems",
        ROUND(p.total_qty, 3)::float as "totalQty",
        TO_CHAR(p.completed_date, 'YYYY-MM-DD HH24:MI:SS') as "completedDate",
        p.completed_by as "completedBy",
        cu.full_name as "completedByName",
        p.remarks,
        p.cancel_reason as "cancelReason",
        p.created_date as "createdDate",
        p.created_by as "createdBy"
      FROM tbl_inv_putaway_header p
      JOIN tbl_inv_warehouse w ON p.warehouse_id = w.warehouse_id
      LEFT JOIN tbl_inv_grn_header g ON p.grn_id = g.grn_id
      LEFT JOIN tbl_qc_inward_inspection_header q ON p.qc_id = q.qc_id
      LEFT JOIN tbl_sec_user u ON p.assigned_to = u.user_id
      LEFT JOIN tbl_sec_user cu ON p.completed_by = cu.user_id
      WHERE p.putaway_id = $1 AND p.comp_id = $2 AND p.is_active = TRUE`,
      [putawayId, compId],
    );

    if (hRes.rows.length === 0) {
      throw new NotFoundException(`Put-away task #${putawayId} not found`);
    }

    const header = hRes.rows[0];

    const iRes = await this.pool.query(
      `SELECT 
        pi.putaway_item_id as "putawayItemId",
        pi.putaway_id as "putawayId",
        pi.grn_item_id as "grnItemId",
        pi.qc_item_id as "qcItemId",
        pi.item_id as "itemId",
        i.item_code as "itemCode",
        i.item_name as "itemName",
        pi.item_description as "itemDescription",
        pi.uom_id as "uomId",
        u.uom_code as "uomCode",
        u.uom_name as "uomName",
        pi.source_bin_id as "sourceBinId",
        sb.bin_code as "sourceBinCode",
        sb.bin_name as "sourceBinName",
        pi.destination_bin_id as "destinationBinId",
        db.bin_code as "destinationBinCode",
        db.bin_name as "destinationBinName",
        ROUND(pi.allocated_qty, 3)::float as "allocatedQty",
        ROUND(pi.putaway_qty, 3)::float as "putawayQty",
        pi.batch_no as "batchNo",
        pi.heat_no as "heatNo",
        TO_CHAR(pi.mfg_date, 'YYYY-MM-DD') as "mfgDate",
        TO_CHAR(pi.expiry_date, 'YYYY-MM-DD') as "expiryDate",
        pi.status,
        pi.remarks
      FROM tbl_inv_putaway_item pi
      JOIN tbl_inv_item i ON pi.item_id = i.item_id
      JOIN tbl_inv_uom u ON pi.uom_id = u.uom_id
      LEFT JOIN tbl_inv_storage_bin sb ON pi.source_bin_id = sb.bin_id
      JOIN tbl_inv_storage_bin db ON pi.destination_bin_id = db.bin_id
      WHERE pi.putaway_id = $1 AND pi.is_active = TRUE
      ORDER BY pi.putaway_item_id ASC`,
      [putawayId],
    );

    return {
      ...header,
      items: iRes.rows,
    };
  }

  async create(
    dto: CreatePutAwayDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one line item is required');
    }

    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const putawayNo = await this.generatePutAwayNo(compId, branchId);
    const totalItems = dto.items.length;
    const totalQty = dto.items.reduce(
      (sum, item) => sum + Number(item.allocatedQty || 0),
      0,
    );

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const hRes = await client.query(
        `INSERT INTO tbl_inv_putaway_header (
          comp_id, branch_id, fyear_id, putaway_no, putaway_date,
          warehouse_id, grn_id, qc_id, assigned_to, putaway_type,
          status, total_items, total_qty, remarks, created_by
        ) VALUES (
          $1, $2, $3, $4, COALESCE($5, CURRENT_DATE),
          $6, $7, $8, $9, COALESCE($10, 'GRN_INWARD'),
          $11, $12, $13, $14, $15
        ) RETURNING putaway_id`,
        [
          compId,
          branchId,
          fyearId,
          putawayNo,
          dto.putawayDate || null,
          dto.warehouseId,
          dto.grnId || null,
          dto.qcId || null,
          dto.assignedTo || null,
          dto.putawayType || 'GRN_INWARD',
          dto.assignedTo ? 'ASSIGNED' : 'DRAFT',
          totalItems,
          totalQty,
          dto.remarks || null,
          userId,
        ],
      );

      const putawayId = hRes.rows[0].putaway_id;

      for (const item of dto.items) {
        await client.query(
          `INSERT INTO tbl_inv_putaway_item (
            putaway_id, grn_item_id, qc_item_id, item_id, item_description,
            uom_id, source_bin_id, destination_bin_id, allocated_qty, putaway_qty,
            batch_no, heat_no, mfg_date, expiry_date, status, remarks,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16,
            $17, $18, $19, $20
          )`,
          [
            putawayId,
            item.grnItemId || null,
            item.qcItemId || null,
            item.itemId,
            item.itemDescription || null,
            item.uomId,
            item.sourceBinId || null,
            item.destinationBinId,
            item.allocatedQty,
            item.putawayQty || 0,
            item.batchNo || null,
            item.heatNo || null,
            item.mfgDate || null,
            item.expiryDate || null,
            'PENDING',
            item.remarks || null,
            compId,
            branchId,
            fyearId,
            userId,
          ],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'BIN_PUTAWAY',
        actionType: 'ADD',
        entityTable: 'tbl_inv_putaway_header',
        recordId: putawayId,
        newValue: { putawayNo, totalItems, totalQty },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findById(putawayId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async update(
    putawayId: number,
    dto: UpdatePutAwayDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const existing: any = await this.findById(putawayId, user);
    if (!['DRAFT', 'ASSIGNED'].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot edit put-away task in '${existing.status}' status`,
      );
    }

    const totalItems = dto.items ? dto.items.length : existing.totalItems;
    const totalQty = dto.items
      ? dto.items.reduce((s, it) => s + Number(it.allocatedQty || 0), 0)
      : existing.totalQty;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE tbl_inv_putaway_header SET
          warehouse_id = COALESCE($1, warehouse_id),
          grn_id = COALESCE($2, grn_id),
          qc_id = COALESCE($3, qc_id),
          assigned_to = COALESCE($4, assigned_to),
          putaway_type = COALESCE($5, putaway_type),
          putaway_date = COALESCE($6, putaway_date),
          total_items = $7,
          total_qty = $8,
          remarks = COALESCE($9, remarks),
          updated_by = $10,
          updated_date = CURRENT_TIMESTAMP
        WHERE putaway_id = $11 AND comp_id = $12`,
        [
          dto.warehouseId || null,
          dto.grnId || null,
          dto.qcId || null,
          dto.assignedTo || null,
          dto.putawayType || null,
          dto.putawayDate || null,
          totalItems,
          totalQty,
          dto.remarks || null,
          userId,
          putawayId,
          compId,
        ],
      );

      if (dto.items && dto.items.length > 0) {
        await client.query(
          `DELETE FROM tbl_inv_putaway_item WHERE putaway_id = $1`,
          [putawayId],
        );

        for (const item of dto.items) {
          await client.query(
            `INSERT INTO tbl_inv_putaway_item (
              putaway_id, grn_item_id, qc_item_id, item_id, item_description,
              uom_id, source_bin_id, destination_bin_id, allocated_qty, putaway_qty,
              batch_no, heat_no, mfg_date, expiry_date, status, remarks,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9, $10,
              $11, $12, $13, $14, $15, $16,
              $17, $18, $19, $20
            )`,
            [
              putawayId,
              item.grnItemId || null,
              item.qcItemId || null,
              item.itemId,
              item.itemDescription || null,
              item.uomId,
              item.sourceBinId || null,
              item.destinationBinId,
              item.allocatedQty,
              item.putawayQty || 0,
              item.batchNo || null,
              item.heatNo || null,
              item.mfgDate || null,
              item.expiryDate || null,
              'PENDING',
              item.remarks || null,
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
        screenCode: 'BIN_PUTAWAY',
        actionType: 'EDIT',
        entityTable: 'tbl_inv_putaway_header',
        recordId: putawayId,
        oldValue: existing,
        newValue: dto,
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findById(putawayId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async assignOperator(
    putawayId: number,
    dto: AssignPutAwayDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const existing: any = await this.findById(putawayId, user);
    if (!['DRAFT', 'ASSIGNED'].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot assign task in '${existing.status}' status`,
      );
    }

    await this.pool.query(
      `UPDATE tbl_inv_putaway_header SET
        assigned_to = $1,
        status = 'ASSIGNED',
        remarks = COALESCE($2, remarks),
        updated_by = $3,
        updated_date = CURRENT_TIMESTAMP
       WHERE putaway_id = $4 AND comp_id = $5`,
      [dto.assignedTo, dto.remarks || null, userId, putawayId, compId],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'BIN_PUTAWAY',
      actionType: 'ASSIGN',
      entityTable: 'tbl_inv_putaway_header',
      recordId: putawayId,
      newValue: { assignedTo: dto.assignedTo, status: 'ASSIGNED' },
      compId,
      branchId,
      fyearId,
      ...meta,
    });

    return this.findById(putawayId, user);
  }

  async startPutAway(
    putawayId: number,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const existing: any = await this.findById(putawayId, user);
    if (!['DRAFT', 'ASSIGNED'].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot start put-away for task in '${existing.status}' status`,
      );
    }

    await this.pool.query(
      `UPDATE tbl_inv_putaway_header SET
        status = 'IN_PROGRESS',
        updated_by = $1,
        updated_date = CURRENT_TIMESTAMP
       WHERE putaway_id = $2 AND comp_id = $3`,
      [userId, putawayId, compId],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'BIN_PUTAWAY',
      actionType: 'EDIT',
      entityTable: 'tbl_inv_putaway_header',
      recordId: putawayId,
      newValue: { status: 'IN_PROGRESS' },
      compId,
      branchId,
      fyearId,
      ...meta,
    });

    return this.findById(putawayId, user);
  }

  async confirmPutAway(
    putawayId: number,
    dto: ConfirmPutAwayDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const existing: any = await this.findById(putawayId, user);
    if (existing.status === 'COMPLETED') {
      throw new BadRequestException('Task is already completed');
    }
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cannot confirm a cancelled task');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Update header status
      await client.query(
        `UPDATE tbl_inv_putaway_header SET
          status = 'COMPLETED',
          completed_date = COALESCE($1, CURRENT_TIMESTAMP),
          completed_by = $2,
          remarks = COALESCE($3, remarks),
          updated_by = $2,
          updated_date = CURRENT_TIMESTAMP
        WHERE putaway_id = $4 AND comp_id = $5`,
        [dto.completedDate || null, userId, dto.remarks || null, putawayId, compId],
      );

      // 2. Process each item, update item status, upsert tbl_inv_bin_stock, and post tbl_inv_stock_ledger
      for (const item of existing.items) {
        const itemOverride = dto.items?.find(
          (o) => o.putawayItemId === item.putawayItemId,
        );
        const finalPutawayQty = itemOverride
          ? Number(itemOverride.putawayQty)
          : Number(item.allocatedQty);
        const finalDestBinId = itemOverride
          ? itemOverride.destinationBinId
          : item.destinationBinId;

        // Mark putaway item completed
        await client.query(
          `UPDATE tbl_inv_putaway_item SET
            putaway_qty = $1,
            destination_bin_id = $2,
            status = 'COMPLETED',
            remarks = COALESCE($3, remarks),
            updated_by = $4,
            updated_date = CURRENT_TIMESTAMP
          WHERE putaway_item_id = $5`,
          [
            finalPutawayQty,
            finalDestBinId,
            itemOverride?.remarks || null,
            userId,
            item.putawayItemId,
          ],
        );

        // Fetch unit cost from item master
        let unitCost = 0;
        const costRes = await client.query(
          `SELECT standard_rate FROM tbl_inv_item WHERE item_id = $1`,
          [item.itemId],
        );
        if (costRes.rows.length > 0) {
          unitCost = Number(costRes.rows[0].standard_rate || 0);
        }

        // Upsert destination bin stock
        const totalValuation = finalPutawayQty * unitCost;

        const stockRes = await client.query(
          `INSERT INTO tbl_inv_bin_stock (
            comp_id, branch_id, fyear_id, warehouse_id, bin_id, item_id, uom_id,
            batch_no, heat_no, on_hand_qty, reserved_qty, available_qty,
            unit_cost, total_valuation, last_stock_date, created_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, 0, $10,
            $11, $12, CURRENT_TIMESTAMP, $13
          )
          ON CONFLICT (warehouse_id, bin_id, item_id, batch_no)
          DO UPDATE SET
            on_hand_qty = tbl_inv_bin_stock.on_hand_qty + EXCLUDED.on_hand_qty,
            available_qty = tbl_inv_bin_stock.available_qty + EXCLUDED.on_hand_qty,
            total_valuation = (tbl_inv_bin_stock.on_hand_qty + EXCLUDED.on_hand_qty) * EXCLUDED.unit_cost,
            last_stock_date = CURRENT_TIMESTAMP,
            updated_by = EXCLUDED.created_by,
            updated_date = CURRENT_TIMESTAMP
          RETURNING on_hand_qty`,
          [
            compId,
            branchId,
            fyearId,
            existing.warehouseId,
            finalDestBinId,
            item.itemId,
            item.uomId,
            item.batchNo || null,
            item.heatNo || null,
            finalPutawayQty,
            unitCost,
            totalValuation,
            userId,
          ],
        );

        const newClosingBalance = Number(stockRes.rows[0]?.on_hand_qty || finalPutawayQty);

        // Insert into immutable stock ledger
        await client.query(
          `INSERT INTO tbl_inv_stock_ledger (
            comp_id, branch_id, fyear_id, transaction_date, transaction_type,
            reference_doc_type, reference_doc_id, reference_doc_no,
            warehouse_id, from_bin_id, to_bin_id, item_id, uom_id,
            batch_no, heat_no, qty_in, qty_out, unit_cost, total_cost,
            closing_balance, remarks, created_by
          ) VALUES (
            $1, $2, $3, CURRENT_TIMESTAMP, 'PUTAWAY_INWARD',
            'PUTAWAY', $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13, 0, $14, $15,
            $16, $17, $18
          )`,
          [
            compId,
            branchId,
            fyearId,
            putawayId,
            existing.putawayNo,
            existing.warehouseId,
            item.sourceBinId || null,
            finalDestBinId,
            item.itemId,
            item.uomId,
            item.batchNo || null,
            item.heatNo || null,
            finalPutawayQty,
            unitCost,
            totalValuation,
            newClosingBalance,
            `Put-away confirmed into destination bin`,
            userId,
          ],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'BIN_PUTAWAY',
        actionType: 'CONFIRM',
        entityTable: 'tbl_inv_putaway_header',
        recordId: putawayId,
        newValue: { status: 'COMPLETED', completedBy: userId },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findById(putawayId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async cancelPutAway(
    putawayId: number,
    dto: CancelPutAwayDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const existing: any = await this.findById(putawayId, user);
    if (existing.status === 'COMPLETED') {
      throw new BadRequestException('Cannot cancel an already completed put-away task');
    }

    await this.pool.query(
      `UPDATE tbl_inv_putaway_header SET
        status = 'CANCELLED',
        cancel_reason = $1,
        updated_by = $2,
        updated_date = CURRENT_TIMESTAMP
       WHERE putaway_id = $3 AND comp_id = $4`,
      [dto.cancelReason, userId, putawayId, compId],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'BIN_PUTAWAY',
      actionType: 'CANCEL',
      entityTable: 'tbl_inv_putaway_header',
      recordId: putawayId,
      newValue: { status: 'CANCELLED', cancelReason: dto.cancelReason },
      compId,
      branchId,
      fyearId,
      ...meta,
    });

    return this.findById(putawayId, user);
  }

  async delete(
    putawayId: number,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const existing: any = await this.findById(putawayId, user);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT put-away tasks can be deleted');
    }

    await this.dependencyCheckService.verifyCanDelete({
      entity: 'Put-Away Task',
      entityId: putawayId,
      relations: [],
    });

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM tbl_inv_putaway_item WHERE putaway_id = $1`, [putawayId]);
      await client.query(`DELETE FROM tbl_inv_putaway_header WHERE putaway_id = $1 AND comp_id = $2`, [putawayId, compId]);
      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'BIN_PUTAWAY',
        actionType: 'DELETE',
        entityTable: 'tbl_inv_putaway_header',
        recordId: putawayId,
        oldValue: existing,
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return { success: true, message: `Put-away task #${putawayId} deleted` };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --- Sourcing Accelerators & Lookups ---
  async getPendingQcInspections(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const res = await this.pool.query(
      `SELECT 
        q.qc_id as "qcId",
        q.qc_no as "qcNo",
        TO_CHAR(q.qc_date, 'YYYY-MM-DD') as "qcDate",
        q.grn_id as "grnId",
        g.grn_no as "grnNo",
        g.warehouse_id as "warehouseId",
        w.warehouse_name as "warehouseName",
        q.vendor_id as "vendorId",
        p.party_name as "vendorName",
        q.overall_result as "overallResult"
      FROM tbl_qc_inward_inspection_header q
      JOIN tbl_inv_grn_header g ON q.grn_id = g.grn_id
      JOIN tbl_inv_warehouse w ON g.warehouse_id = w.warehouse_id
      JOIN tbl_crm_party p ON q.vendor_id = p.party_id
      WHERE q.comp_id = $1 AND q.is_active = TRUE
        AND ($2::BIGINT IS NULL OR q.branch_id = $2::BIGINT)
        AND q.status = 'COMPLETED' 
        AND q.overall_result IN ('ACCEPTED', 'ACCEPTED_UNDER_DEVIATION')
      ORDER BY q.qc_date DESC`,
      [compId, branchId],
    );
    return res.rows;
  }

  async getQcItems(qcId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const res = await this.pool.query(
      `SELECT 
        qi.qc_item_id as "qcItemId",
        qi.qc_id as "qcId",
        qi.grn_item_id as "grnItemId",
        qi.item_id as "itemId",
        i.item_code as "itemCode",
        i.item_name as "itemName",
        qi.uom_id as "uomId",
        u.uom_code as "uomCode",
        ROUND(qi.accepted_qty, 3)::float as "allocatedQty",
        ROUND(qi.accepted_qty, 3)::float as "putawayQty",
        qi.batch_no as "batchNo",
        qi.heat_no as "heatNo",
        qi.quarantine_bin_id as "sourceBinId",
        sb.bin_code as "sourceBinCode",
        qi.destination_bin_id as "destinationBinId",
        db.bin_code as "destinationBinCode"
      FROM tbl_qc_inward_inspection_item qi
      JOIN tbl_inv_item i ON qi.item_id = i.item_id
      JOIN tbl_inv_uom u ON qi.uom_id = u.uom_id
      LEFT JOIN tbl_inv_storage_bin sb ON qi.quarantine_bin_id = sb.bin_id
      LEFT JOIN tbl_inv_storage_bin db ON qi.destination_bin_id = db.bin_id
      WHERE qi.qc_id = $1 AND qi.comp_id = $2 AND qi.is_active = TRUE AND qi.accepted_qty > 0`,
      [qcId, compId],
    );
    return res.rows;
  }

  async getStorageBins(warehouseId: number, user: AuthenticatedUserContext) {
    const res = await this.pool.query(
      `SELECT 
        bin_id as "binId",
        bin_code as "binCode",
        bin_name as "binName",
        zone_code as "zoneCode",
        rack_code as "rackCode",
        shelf_level as "shelfLevel",
        bin_position as "binPosition",
        bin_type as "binType",
        is_receiving_staging as "isReceivingStaging",
        is_blocked_for_putaway as "isBlockedForPutaway"
      FROM tbl_inv_storage_bin
      WHERE warehouse_id = $1 AND is_active = TRUE
      ORDER BY zone_code, rack_code, shelf_level, bin_position`,
      [warehouseId],
    );
    return res.rows;
  }

  async getOperators(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const res = await this.pool.query(
      `SELECT 
        u.user_id as "userId",
        u.username,
        u.full_name as "fullName",
        u.email
      FROM tbl_sec_user u
      JOIN tbl_sec_user_branch_role ubr ON u.user_id = ubr.user_id
      WHERE ubr.comp_id = $1 AND ubr.is_active = TRUE AND u.is_active = TRUE
        AND ($2::BIGINT IS NULL OR ubr.branch_id = $2::BIGINT)
      GROUP BY u.user_id, u.username, u.full_name, u.email
      ORDER BY u.full_name`,
      [compId, branchId],
    );
    return res.rows;
  }
}
