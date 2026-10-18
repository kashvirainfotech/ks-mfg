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
  CancelGateInwardDto,
  CreateGateInwardDto,
  ExitGateInwardDto,
  GateInwardFilterParams,
  UnloadGateInwardDto,
  UpdateGateInwardDto,
} from './gate-inward.dto';

@Injectable()
export class GateInwardService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // --------------------------------------------------------------------------
  // KPI Summary
  // --------------------------------------------------------------------------
  async getGateInwardSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const sql = `
      SELECT
        COUNT(*)::INT AS total_inwards,
        COUNT(CASE WHEN status = 'INWARDED' THEN 1 END)::INT AS inwarded_count,
        COUNT(CASE WHEN status = 'UNLOADED' THEN 1 END)::INT AS unloaded_count,
        COUNT(CASE WHEN status = 'GRN_PENDING' THEN 1 END)::INT AS grn_pending_count,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::INT AS completed_count,
        COUNT(CASE WHEN status IN ('INWARDED', 'UNLOADED') THEN 1 END)::INT AS in_plant_count
      FROM tbl_gate_inward_header
      WHERE comp_id = $1 AND is_active = TRUE
        AND ($2::BIGINT IS NULL OR branch_id = $2::BIGINT);
    `;

    const res = await this.pool.query(sql, [compId, branchId]);
    const r = res.rows[0] || {};
    return {
      totalInwards: Number(r.total_inwards || 0),
      inwardedCount: Number(r.inwarded_count || 0),
      unloadedCount: Number(r.unloaded_count || 0),
      grnPendingCount: Number(r.grn_pending_count || 0),
      completedCount: Number(r.completed_count || 0),
      inPlantCount: Number(r.in_plant_count || 0),
    };
  }

  // --------------------------------------------------------------------------
  // Document Number Generation (GIN-AHM-YYNextYY-XXXX)
  // --------------------------------------------------------------------------
  private async generateGateInwardNumber(
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
      `SELECT nextval('seq_gate_inward_id') AS next_val;`,
    );
    const seq = String(seqRes.rows[0].next_val).padStart(4, '0');
    return `GIN-${branchCode}-${fyearCode}-${seq}`;
  }

  // --------------------------------------------------------------------------
  // Find All (Register Listing)
  // --------------------------------------------------------------------------
  async findAllGateInwards(
    filters: GateInwardFilterParams,
    user: AuthenticatedUserContext,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const conditions: string[] = [
      `g.comp_id = $1`,
      `g.is_active = TRUE`,
      `($2::BIGINT IS NULL OR g.branch_id = $2::BIGINT)`,
    ];
    const params: any[] = [compId, branchId];
    let idx = 3;

    if (filters.status) {
      conditions.push(`g.status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.warehouseId) {
      conditions.push(`g.warehouse_id = $${idx++}`);
      params.push(filters.warehouseId);
    }
    if (filters.vendorId) {
      conditions.push(`g.vendor_id = $${idx++}`);
      params.push(filters.vendorId);
    }
    if (filters.poId) {
      conditions.push(`g.po_id = $${idx++}`);
      params.push(filters.poId);
    }
    if (filters.startDate) {
      conditions.push(`g.inward_date >= $${idx++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`g.inward_date <= $${idx++}`);
      params.push(filters.endDate);
    }
    if (filters.search) {
      const q = `%${filters.search.trim().toLowerCase()}%`;
      conditions.push(
        `(LOWER(g.gate_inward_no) LIKE $${idx} OR LOWER(g.vehicle_no) LIKE $${idx} OR LOWER(g.challan_no) LIKE $${idx} OR LOWER(p.party_name) LIKE $${idx} OR LOWER(g.transporter_name) LIKE $${idx})`,
      );
      params.push(q);
      idx++;
    }

    const sql = `
      SELECT
        g.gate_inward_id AS "gateInwardId",
        g.gate_inward_no AS "gateInwardNo",
        TO_CHAR(g.inward_date, 'YYYY-MM-DD') AS "inwardDate",
        g.inward_time AS "inwardTime",
        g.warehouse_id AS "warehouseId",
        w.warehouse_code AS "warehouseCode",
        w.warehouse_name AS "warehouseName",
        g.vendor_id AS "vendorId",
        p.party_code AS "vendorCode",
        p.party_name AS "vendorName",
        g.po_id AS "poId",
        po.po_no AS "poNo",
        g.challan_no AS "challanNo",
        TO_CHAR(g.challan_date, 'YYYY-MM-DD') AS "challanDate",
        g.vehicle_no AS "vehicleNo",
        g.transporter_name AS "transporterName",
        g.driver_name AS "driverName",
        g.driver_phone AS "driverPhone",
        g.eway_bill_no AS "ewayBillNo",
        g.lr_no AS "lrNo",
        TO_CHAR(g.lr_date, 'YYYY-MM-DD') AS "lrDate",
        ROUND(g.gross_weight, 3)::FLOAT AS "grossWeight",
        ROUND(g.tare_weight, 3)::FLOAT AS "tareWeight",
        ROUND(g.net_weight, 3)::FLOAT AS "netWeight",
        g.total_packages AS "totalPackages",
        g.status,
        g.security_remarks AS "securityRemarks",
        TO_CHAR(g.unloaded_date, 'YYYY-MM-DD HH24:MI:SS') AS "unloadedDate",
        g.unloaded_by AS "unloadedBy",
        u.full_name AS "unloadedByName",
        g.unloading_remarks AS "unloadingRemarks",
        TO_CHAR(g.exit_date, 'YYYY-MM-DD HH24:MI:SS') AS "exitDate",
        g.exit_remarks AS "exitRemarks",
        g.cancel_reason AS "cancelReason",
        g.is_active AS "isActive",
        TO_CHAR(g.created_date, 'YYYY-MM-DD HH24:MI:SS') AS "createdDate",
        (SELECT COUNT(*) FROM tbl_gate_inward_item WHERE gate_inward_id = g.gate_inward_id AND is_active = TRUE)::INT AS "itemsCount"
      FROM tbl_gate_inward_header g
      LEFT JOIN tbl_inv_warehouse w ON g.warehouse_id = w.warehouse_id
      LEFT JOIN tbl_crm_party p ON g.vendor_id = p.party_id
      LEFT JOIN tbl_po_header po ON g.po_id = po.po_id
      LEFT JOIN tbl_sec_user u ON g.unloaded_by = u.user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY g.gate_inward_id DESC;
    `;

    const res = await this.pool.query(sql, params);
    return res.rows;
  }

  // --------------------------------------------------------------------------
  // Find By ID (with Item Lines)
  // --------------------------------------------------------------------------
  async findGateInwardById(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const headSql = `
      SELECT
        g.gate_inward_id AS "gateInwardId",
        g.gate_inward_no AS "gateInwardNo",
        TO_CHAR(g.inward_date, 'YYYY-MM-DD') AS "inwardDate",
        g.inward_time AS "inwardTime",
        g.warehouse_id AS "warehouseId",
        w.warehouse_code AS "warehouseCode",
        w.warehouse_name AS "warehouseName",
        g.vendor_id AS "vendorId",
        p.party_code AS "vendorCode",
        p.party_name AS "vendorName",
        g.po_id AS "poId",
        po.po_no AS "poNo",
        g.challan_no AS "challanNo",
        TO_CHAR(g.challan_date, 'YYYY-MM-DD') AS "challanDate",
        g.vehicle_no AS "vehicleNo",
        g.transporter_name AS "transporterName",
        g.driver_name AS "driverName",
        g.driver_phone AS "driverPhone",
        g.eway_bill_no AS "ewayBillNo",
        g.lr_no AS "lrNo",
        TO_CHAR(g.lr_date, 'YYYY-MM-DD') AS "lrDate",
        ROUND(g.gross_weight, 3)::FLOAT AS "grossWeight",
        ROUND(g.tare_weight, 3)::FLOAT AS "tareWeight",
        ROUND(g.net_weight, 3)::FLOAT AS "netWeight",
        g.total_packages AS "totalPackages",
        g.status,
        g.security_remarks AS "securityRemarks",
        TO_CHAR(g.unloaded_date, 'YYYY-MM-DD HH24:MI:SS') AS "unloadedDate",
        g.unloaded_by AS "unloadedBy",
        u.full_name AS "unloadedByName",
        g.unloading_remarks AS "unloadingRemarks",
        TO_CHAR(g.exit_date, 'YYYY-MM-DD HH24:MI:SS') AS "exitDate",
        g.exit_remarks AS "exitRemarks",
        g.cancel_reason AS "cancelReason",
        g.is_active AS "isActive",
        TO_CHAR(g.created_date, 'YYYY-MM-DD HH24:MI:SS') AS "createdDate"
      FROM tbl_gate_inward_header g
      LEFT JOIN tbl_inv_warehouse w ON g.warehouse_id = w.warehouse_id
      LEFT JOIN tbl_crm_party p ON g.vendor_id = p.party_id
      LEFT JOIN tbl_po_header po ON g.po_id = po.po_id
      LEFT JOIN tbl_sec_user u ON g.unloaded_by = u.user_id
      WHERE g.gate_inward_id = $1 AND g.comp_id = $2;
    `;
    const hRes = await this.pool.query(headSql, [id, compId]);
    if (hRes.rows.length === 0) {
      throw new NotFoundException(`Gate inward record #${id} not found.`);
    }
    const header = hRes.rows[0];

    const itemsSql = `
      SELECT
        gi.gate_inward_item_id AS "gateInwardItemId",
        gi.gate_inward_id AS "gateInwardId",
        gi.po_item_id AS "poItemId",
        gi.item_id AS "itemId",
        i.item_code AS "itemCode",
        i.item_name AS "itemName",
        gi.item_description AS "itemDescription",
        gi.uom_id AS "uomId",
        u.uom_code AS "uomCode",
        u.uom_name AS "uomName",
        ROUND(gi.challan_qty, 3)::FLOAT AS "challanQty",
        gi.package_count AS "packageCount",
        gi.remarks,
        gi.is_active AS "isActive"
      FROM tbl_gate_inward_item gi
      LEFT JOIN tbl_inv_item i ON gi.item_id = i.item_id
      LEFT JOIN tbl_inv_uom u ON gi.uom_id = u.uom_id
      WHERE gi.gate_inward_id = $1 AND gi.is_active = TRUE
      ORDER BY gi.gate_inward_item_id ASC;
    `;
    const iRes = await this.pool.query(itemsSql, [id]);
    header.items = iRes.rows;
    return header;
  }

  // --------------------------------------------------------------------------
  // Create Gate Inward
  // --------------------------------------------------------------------------
  async createGateInward(
    dto: CreateGateInwardDto,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item must be recorded for gate inward.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const gateInwardNo =
        dto.gateInwardNo?.trim() ||
        (await this.generateGateInwardNumber(compId, branchId));

      const gross = Number(dto.grossWeight) || 0;
      const tare = Number(dto.tareWeight) || 0;
      const net = Math.max(0, gross - tare);

      const inTime =
        dto.inwardTime?.trim() ||
        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      const insHeadSql = `
        INSERT INTO tbl_gate_inward_header (
          gate_inward_no, inward_date, inward_time, warehouse_id, vendor_id, po_id,
          challan_no, challan_date, vehicle_no, transporter_name, driver_name, driver_phone,
          eway_bill_no, lr_no, lr_date, gross_weight, tare_weight, net_weight, total_packages,
          status, security_remarks, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, UPPER($9), $10, $11, $12,
          $13, $14, $15, $16, $17, $18, $19,
          'INWARDED', $20, TRUE,
          $21, $22, $23, $24
        ) RETURNING gate_inward_id;
      `;

      const headRes = await client.query(insHeadSql, [
        gateInwardNo,
        dto.inwardDate,
        inTime,
        dto.warehouseId,
        dto.vendorId,
        dto.poId || null,
        dto.challanNo.trim(),
        dto.challanDate,
        dto.vehicleNo.trim(),
        dto.transporterName?.trim() || null,
        dto.driverName?.trim() || null,
        dto.driverPhone?.trim() || null,
        dto.ewayBillNo?.trim() || null,
        dto.lrNo?.trim() || null,
        dto.lrDate || null,
        gross,
        tare,
        net,
        dto.totalPackages || 1,
        dto.securityRemarks?.trim() || null,
        compId,
        branchId,
        fyearId,
        userId,
      ]);

      const gateInwardId = headRes.rows[0].gate_inward_id;

      for (const item of dto.items) {
        const insItemSql = `
          INSERT INTO tbl_gate_inward_item (
            gate_inward_id, po_item_id, item_id, item_description, uom_id,
            challan_qty, package_count, remarks, is_active,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, TRUE,
            $9, $10, $11, $12
          );
        `;
        await client.query(insItemSql, [
          gateInwardId,
          item.poItemId || null,
          item.itemId,
          item.itemDescription?.trim() || null,
          item.uomId,
          Number(item.challanQty),
          item.packageCount || 1,
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
        screenCode: 'GATE_INWARD',
        actionType: 'ADD',
        entityTable: 'tbl_gate_inward_header',
        recordId: gateInwardId,
        newValue: { gateInwardNo, vehicleNo: dto.vehicleNo, challanNo: dto.challanNo },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findGateInwardById(gateInwardId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Update Gate Inward
  // --------------------------------------------------------------------------
  async updateGateInward(
    id: number,
    dto: UpdateGateInwardDto,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId;

    const old = await this.findGateInwardById(id, user);
    if (old.status === 'COMPLETED' || old.status === 'CANCELLED') {
      throw new BadRequestException(
        `Cannot edit Gate Inward #${id} because it is already ${old.status}.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const gross =
        dto.grossWeight !== undefined ? Number(dto.grossWeight) : old.grossWeight;
      const tare =
        dto.tareWeight !== undefined ? Number(dto.tareWeight) : old.tareWeight;
      const net = Math.max(0, gross - tare);

      const updSql = `
        UPDATE tbl_gate_inward_header
        SET
          inward_date = COALESCE($1, inward_date),
          inward_time = COALESCE($2, inward_time),
          warehouse_id = COALESCE($3, warehouse_id),
          vendor_id = COALESCE($4, vendor_id),
          po_id = COALESCE($5, po_id),
          challan_no = COALESCE($6, challan_no),
          challan_date = COALESCE($7, challan_date),
          vehicle_no = COALESCE(UPPER($8), vehicle_no),
          transporter_name = COALESCE($9, transporter_name),
          driver_name = COALESCE($10, driver_name),
          driver_phone = COALESCE($11, driver_phone),
          eway_bill_no = COALESCE($12, eway_bill_no),
          lr_no = COALESCE($13, lr_no),
          lr_date = COALESCE($14, lr_date),
          gross_weight = $15,
          tare_weight = $16,
          net_weight = $17,
          total_packages = COALESCE($18, total_packages),
          security_remarks = COALESCE($19, security_remarks),
          updated_by = $20,
          updated_date = CURRENT_TIMESTAMP
        WHERE gate_inward_id = $21 AND comp_id = $22;
      `;

      await client.query(updSql, [
        dto.inwardDate || null,
        dto.inwardTime || null,
        dto.warehouseId || null,
        dto.vendorId || null,
        dto.poId || null,
        dto.challanNo?.trim() || null,
        dto.challanDate || null,
        dto.vehicleNo?.trim() || null,
        dto.transporterName?.trim() || null,
        dto.driverName?.trim() || null,
        dto.driverPhone?.trim() || null,
        dto.ewayBillNo?.trim() || null,
        dto.lrNo?.trim() || null,
        dto.lrDate || null,
        gross,
        tare,
        net,
        dto.totalPackages || null,
        dto.securityRemarks?.trim() || null,
        userId,
        id,
        compId,
      ]);

      if (dto.items && dto.items.length > 0) {
        await client.query(
          `DELETE FROM tbl_gate_inward_item WHERE gate_inward_id = $1;`,
          [id],
        );

        for (const item of dto.items) {
          const insItemSql = `
            INSERT INTO tbl_gate_inward_item (
              gate_inward_id, po_item_id, item_id, item_description, uom_id,
              challan_qty, package_count, remarks, is_active,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, TRUE,
              $9, $10, $11, $12
            );
          `;
          await client.query(insItemSql, [
            id,
            item.poItemId || null,
            item.itemId,
            item.itemDescription?.trim() || null,
            item.uomId,
            Number(item.challanQty),
            item.packageCount || 1,
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
        screenCode: 'GATE_INWARD',
        actionType: 'EDIT',
        entityTable: 'tbl_gate_inward_header',
        recordId: id,
        oldValue: old,
        newValue: dto,
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findGateInwardById(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Mark Consignment Unloaded (Transition to UNLOADED / GRN_PENDING)
  // --------------------------------------------------------------------------
  async markUnloaded(
    id: number,
    dto: UnloadGateInwardDto,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId;

    const old = await this.findGateInwardById(id, user);
    if (old.status !== 'INWARDED') {
      throw new BadRequestException(
        `Gate Inward #${id} cannot be marked unloaded because it is in '${old.status}' status.`,
      );
    }

    const tare =
      dto.tareWeight !== undefined ? Number(dto.tareWeight) : old.tareWeight;
    const net = Math.max(0, old.grossWeight - tare);

    const sql = `
      UPDATE tbl_gate_inward_header
      SET
        status = 'GRN_PENDING',
        tare_weight = $1,
        net_weight = $2,
        unloaded_date = CURRENT_TIMESTAMP,
        unloaded_by = $3,
        unloading_remarks = $4,
        updated_by = $3,
        updated_date = CURRENT_TIMESTAMP
      WHERE gate_inward_id = $5 AND comp_id = $6
      RETURNING *;
    `;

    await this.pool.query(sql, [
      tare,
      net,
      userId,
      dto.unloadingRemarks?.trim() || 'Consignment physically unloaded at plant receiving bay.',
      id,
      compId,
    ]);

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'GATE_INWARD',
      actionType: 'UNLOAD',
      entityTable: 'tbl_gate_inward_header',
      recordId: id,
      oldValue: { status: old.status, tareWeight: old.tareWeight },
      newValue: {
        status: 'GRN_PENDING',
        tareWeight: tare,
        netWeight: net,
        unloadingRemarks: dto.unloadingRemarks,
      },
      compId,
      branchId: user.branchId || 1001,
      fyearId: user.fyearId || null,
      ...meta,
    });

    return this.findGateInwardById(id, user);
  }

  // --------------------------------------------------------------------------
  // Record Vehicle Exit / Outward (Transition to COMPLETED)
  // --------------------------------------------------------------------------
  async recordVehicleExit(
    id: number,
    dto: ExitGateInwardDto,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId;

    const old = await this.findGateInwardById(id, user);
    if (old.status === 'COMPLETED' || old.status === 'CANCELLED') {
      throw new BadRequestException(
        `Gate Inward #${id} is already ${old.status}.`,
      );
    }

    const sql = `
      UPDATE tbl_gate_inward_header
      SET
        status = 'COMPLETED',
        exit_date = CURRENT_TIMESTAMP,
        exit_remarks = $1,
        updated_by = $2,
        updated_date = CURRENT_TIMESTAMP
      WHERE gate_inward_id = $3 AND comp_id = $4;
    `;

    await this.pool.query(sql, [
      dto.exitRemarks?.trim() || 'Vehicle departure cleared by security.',
      userId,
      id,
      compId,
    ]);

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'GATE_INWARD',
      actionType: 'EXIT',
      entityTable: 'tbl_gate_inward_header',
      recordId: id,
      oldValue: { status: old.status },
      newValue: { status: 'COMPLETED', exitRemarks: dto.exitRemarks },
      compId,
      branchId: user.branchId || 1001,
      fyearId: user.fyearId || null,
      ...meta,
    });

    return this.findGateInwardById(id, user);
  }

  // --------------------------------------------------------------------------
  // Cancel Gate Inward
  // --------------------------------------------------------------------------
  async cancelGateInward(
    id: number,
    dto: CancelGateInwardDto,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId;

    const old = await this.findGateInwardById(id, user);
    if (old.status === 'COMPLETED') {
      throw new BadRequestException(
        `Completed Gate Inward #${id} cannot be cancelled once vehicle has departed.`,
      );
    }

    const sql = `
      UPDATE tbl_gate_inward_header
      SET
        status = 'CANCELLED',
        cancel_reason = $1,
        updated_by = $2,
        updated_date = CURRENT_TIMESTAMP
      WHERE gate_inward_id = $3 AND comp_id = $4;
    `;

    await this.pool.query(sql, [dto.cancelReason.trim(), userId, id, compId]);

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'GATE_INWARD',
      actionType: 'CANCEL',
      entityTable: 'tbl_gate_inward_header',
      recordId: id,
      oldValue: { status: old.status },
      newValue: { status: 'CANCELLED', cancelReason: dto.cancelReason },
      compId,
      branchId: user.branchId || 1001,
      fyearId: user.fyearId || null,
      ...meta,
    });

    return this.findGateInwardById(id, user);
  }

  // --------------------------------------------------------------------------
  // Delete Gate Inward (Draft / Cancelled only)
  // --------------------------------------------------------------------------
  async deleteGateInward(
    id: number,
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId;

    const old = await this.findGateInwardById(id, user);
    if (old.status !== 'INWARDED' && old.status !== 'CANCELLED') {
      throw new BadRequestException(
        `Cannot delete Gate Inward #${id} with status '${old.status}'. Only pending or cancelled records can be removed.`,
      );
    }

    // Verify relations against future GRN table if present
    await this.dependencyCheckService.verifyCanDelete({
      entity: 'tbl_gate_inward_header',
      entityId: id,
      relations: [
        {
          table: 'tbl_inv_grn_header',
          column: 'gate_inward_id',
          label: 'Goods Receipt Note (GRN)',
        },
      ],
    });

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM tbl_gate_inward_item WHERE gate_inward_id = $1;`,
        [id],
      );
      await client.query(
        `DELETE FROM tbl_gate_inward_header WHERE gate_inward_id = $1 AND comp_id = $2;`,
        [id, compId],
      );
      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'GATE_INWARD',
        actionType: 'DELETE',
        entityTable: 'tbl_gate_inward_header',
        recordId: id,
        oldValue: old,
        compId,
        branchId: user.branchId || 1001,
        fyearId: user.fyearId || null,
        ...meta,
      });

      return { success: true, message: `Gate Inward #${id} deleted.` };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Record Screen Action (PRINT / EXPORT)
  // --------------------------------------------------------------------------
  async recordScreenAction(
    actionType: 'PRINT' | 'EXPORT',
    user: AuthenticatedUserContext,
    meta: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'GATE_INWARD',
      actionType,
      entityTable: 'tbl_gate_inward_header',
      recordId: 0,
      newValue: { screenAction: actionType },
      compId: user.compId || 1001,
      branchId: user.branchId || 1001,
      fyearId: user.fyearId || null,
      ...meta,
    });
    return { success: true };
  }
}
