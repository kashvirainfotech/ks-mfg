import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Pool } from 'pg';
import { DRIZZLE_DB } from '../../../database/database.module';
import type { DrizzleDb } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';
import {
  CreateChallanDto,
  UpdateChallanDto,
  PickChallanDto,
  PackChallanDto,
  DispatchChallanDto,
  ChallanItemDto,
} from './challan.dto';

interface AuthenticatedUserContext {
  userId: number;
  username?: string;
  compId: number;
  branchId: number;
  fyearId?: number;
}

@Injectable()
export class DeliveryChallanService {
  private readonly logger = new Logger(DeliveryChallanService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly drizzle: DrizzleDb,
    @Inject('DATABASE_POOL') private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
  ) {}

  // --------------------------------------------------------------------------
  // 1. Executive Summary & KPI Metrics
  // --------------------------------------------------------------------------
  async getSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const res = await this.pool.query(
      `SELECT
         COUNT(*)::INT AS total_challans,
         COUNT(CASE WHEN status = 'DISPATCHED' THEN 1 END)::INT AS dispatched_count,
         COALESCE(SUM(CASE WHEN status = 'DISPATCHED' THEN total_value ELSE 0 END), 0)::FLOAT AS dispatched_value,
         COUNT(CASE WHEN status IN ('DRAFT', 'PICKED', 'PACKED') THEN 1 END)::INT AS pending_dispatch_count,
         COUNT(CASE WHEN status = 'PACKED' THEN 1 END)::INT AS packed_count,
         COUNT(CASE WHEN status = 'PICKED' THEN 1 END)::INT AS picked_count,
         COUNT(CASE WHEN status = 'DELIVERED' THEN 1 END)::INT AS delivered_count,
         COALESCE(SUM(CASE WHEN is_active = TRUE AND status != 'CANCELLED' THEN total_value ELSE 0 END), 0)::FLOAT AS total_challan_value
       FROM tbl_sales_delivery_challan_header
       WHERE comp_id = $1 AND is_active = TRUE;`,
      [compId],
    );

    const row = res.rows[0];
    return {
      totalChallans: Number(row?.total_challans || 0),
      dispatchedCount: Number(row?.dispatched_count || 0),
      dispatchedValue: Number(row?.dispatched_value || 0),
      pendingDispatchCount: Number(row?.pending_dispatch_count || 0),
      packedCount: Number(row?.packed_count || 0),
      pickedCount: Number(row?.picked_count || 0),
      deliveredCount: Number(row?.delivered_count || 0),
      totalChallanValue: Number(row?.total_challan_value || 0),
    };
  }

  // --------------------------------------------------------------------------
  // 2. Comprehensive Lookups
  // --------------------------------------------------------------------------
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // 1. Active Customers
    const custRes = await this.pool.query(
      `SELECT
         party_id,
         party_code,
         party_name,
         trade_name,
         credit_limit::FLOAT AS credit_limit,
         credit_days,
         payment_terms,
         pan_no,
         primary_contact_name,
         primary_email,
         primary_phone
       FROM tbl_crm_party
       WHERE comp_id = $1 AND party_type IN ('CUSTOMER', 'BOTH') AND is_active = TRUE
       ORDER BY party_name ASC;`,
      [compId],
    );

    // 2. Addresses
    const addrRes = await this.pool.query(
      `SELECT
         address_id,
         party_id,
         address_type,
         address_line1,
         address_line2,
         city,
         state_code,
         state_name,
         pin_code,
         gstin,
         is_default
       FROM tbl_crm_party_address
       WHERE is_active = TRUE
       ORDER BY party_id, is_default DESC;`,
    );

    // 3. Transporters
    const transRes = await this.pool.query(
      `SELECT
         party_id,
         party_code,
         party_name,
         primary_contact_name,
         primary_phone
       FROM tbl_crm_party
       WHERE comp_id = $1 AND (party_type IN ('TRANSPORTER', 'VENDOR') OR party_name ILIKE '%Logistics%' OR party_name ILIKE '%Trans%') AND is_active = TRUE
       ORDER BY party_name ASC;`,
      [compId],
    );

    // 4. Warehouses
    const whRes = await this.pool.query(
      `SELECT
         warehouse_id,
         warehouse_code,
         warehouse_name,
         warehouse_type
       FROM tbl_inv_warehouse
       WHERE comp_id = $1 AND is_active = TRUE
       ORDER BY warehouse_name ASC;`,
      [compId],
    );

    // 5. Storage Bins with On-Hand Stock
    const binRes = await this.pool.query(
      `SELECT
         b.bin_id,
         b.bin_code,
         b.bin_name,
         b.warehouse_id,
         w.warehouse_name,
         COALESCE(bs.item_id, 0) AS item_id,
         COALESCE(bs.on_hand_qty, 0)::FLOAT AS on_hand_qty,
         COALESCE(bs.reserved_qty, 0)::FLOAT AS reserved_qty,
         COALESCE(bs.available_qty, 0)::FLOAT AS available_qty,
         bs.batch_no,
         bs.heat_no
       FROM tbl_inv_storage_bin b
       JOIN tbl_inv_warehouse w ON b.warehouse_id = w.warehouse_id
       LEFT JOIN tbl_inv_bin_stock bs ON b.bin_id = bs.bin_id AND bs.on_hand_qty > 0
       WHERE b.comp_id = $1 AND b.is_active = TRUE
       ORDER BY b.bin_code ASC;`,
      [compId],
    );

    // 6. Sellable Items
    const itemRes = await this.pool.query(
      `SELECT
         i.item_id,
         i.item_code,
         i.item_name,
         i.description,
         i.hsn_or_sac_code AS hsn_sac_code,
         i.base_uom_id AS uom_id,
         u.uom_code,
         i.standard_rate::FLOAT AS standard_rate,
         COALESCE(SUM(bs.on_hand_qty), 0)::FLOAT AS total_on_hand,
         COALESCE(SUM(bs.reserved_qty), 0)::FLOAT AS total_reserved,
         COALESCE(SUM(bs.available_qty), 0)::FLOAT AS total_available
       FROM tbl_inv_item i
       JOIN tbl_inv_uom u ON i.base_uom_id = u.uom_id
       LEFT JOIN tbl_inv_bin_stock bs ON i.item_id = bs.item_id
       WHERE i.comp_id = $1 AND i.is_active = TRUE AND i.item_type IN ('FG', 'SEMI_FG')
       GROUP BY i.item_id, i.item_code, i.item_name, i.description, i.hsn_or_sac_code, i.base_uom_id, u.uom_code, i.standard_rate
       ORDER BY i.item_name ASC;`,
      [compId],
    );

    // 7. Active Sales Orders Available for Dispatch
    const soRes = await this.pool.query(
      `SELECT
         so.so_id,
         so.so_no,
         so.so_date,
         so.customer_id,
         so.customer_name,
         so.customer_po_no,
         so.customer_po_date,
         so.shipping_address_id,
         so.shipping_address,
         so.shipping_state_code,
         so.shipping_state_name,
         so.delivery_terms,
         so.status,
         so.atp_reservation_status
       FROM tbl_sales_order_header so
       WHERE so.comp_id = $1
         AND so.status IN ('CONFIRMED', 'READY_FOR_DISPATCH', 'PARTIALLY_DELIVERED')
         AND so.is_active = TRUE
       ORDER BY so.so_id DESC;`,
      [compId],
    );

    // 8. Sales Order Items with Pending Quantities
    const soItemsRes = await this.pool.query(
      `SELECT
         soi.so_item_id,
         soi.so_id,
         soi.item_sequence,
         soi.item_id,
         soi.item_code,
         soi.item_name,
         soi.description,
         soi.hsn_sac_code,
         soi.uom_id,
         u.uom_code,
         soi.ordered_qty::FLOAT AS ordered_qty,
         soi.reserved_qty::FLOAT AS reserved_qty,
         soi.delivered_qty::FLOAT AS delivered_qty,
         (soi.ordered_qty - soi.delivered_qty)::FLOAT AS pending_qty,
         soi.unit_rate::FLOAT AS unit_rate,
         soi.reservation_status
       FROM tbl_sales_order_item soi
       JOIN tbl_inv_uom u ON soi.uom_id = u.uom_id
       WHERE soi.comp_id = $1
         AND (soi.ordered_qty - soi.delivered_qty) > 0
         AND soi.is_active = TRUE
       ORDER BY soi.so_id, soi.item_sequence;`,
      [compId],
    );

    // 9. Plant branch state
    const branchRes = await this.pool.query(
      `SELECT branch_id, branch_code, branch_name, state_code, state_name, gstin
       FROM tbl_org_branch
       WHERE branch_id = $1;`,
      [branchId],
    );

    return {
      customers: custRes.rows,
      addresses: addrRes.rows,
      transporters: transRes.rows,
      warehouses: whRes.rows,
      storageBins: binRes.rows,
      items: itemRes.rows,
      salesOrders: soRes.rows,
      salesOrderItems: soItemsRes.rows,
      branch: branchRes.rows[0] || null,
    };
  }

  // --------------------------------------------------------------------------
  // 3. Find All Delivery Challans (Filtered & Paginated)
  // --------------------------------------------------------------------------
  async findAll(user: AuthenticatedUserContext, query: any) {
    const compId = user.compId || 1001;
    const {
      status,
      customerId,
      transporterId,
      dateFrom,
      dateTo,
      search,
      page = 1,
      limit = 50,
    } = query;

    const conditions: string[] = ['dc.comp_id = $1', 'dc.is_active = TRUE'];
    const params: any[] = [compId];
    let paramIdx = 2;

    if (status && status !== 'ALL') {
      conditions.push(`dc.status = $${paramIdx++}`);
      params.push(status);
    }

    if (customerId) {
      conditions.push(`dc.customer_id = $${paramIdx++}`);
      params.push(customerId);
    }

    if (transporterId) {
      conditions.push(`dc.transporter_id = $${paramIdx++}`);
      params.push(transporterId);
    }

    if (dateFrom) {
      conditions.push(`dc.challan_date >= $${paramIdx++}`);
      params.push(dateFrom);
    }

    if (dateTo) {
      conditions.push(`dc.challan_date <= $${paramIdx++}`);
      params.push(dateTo);
    }

    if (search && search.trim() !== '') {
      conditions.push(
        `(dc.challan_no ILIKE $${paramIdx} OR dc.so_no ILIKE $${paramIdx} OR dc.customer_name ILIKE $${paramIdx} OR dc.vehicle_no ILIKE $${paramIdx} OR dc.e_way_bill_no ILIKE $${paramIdx})`,
      );
      params.push(`%${search.trim()}%`);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');
    const countSql = `SELECT COUNT(*)::INT AS total FROM tbl_sales_delivery_challan_header dc WHERE ${whereClause};`;
    const countRes = await this.pool.query(countSql, params);
    const total = Number(countRes.rows[0]?.total || 0);

    const offset = (Number(page) - 1) * Number(limit);
    const dataSql = `
      SELECT
        dc.challan_id,
        dc.challan_no,
        dc.challan_date,
        dc.so_id,
        dc.so_no,
        dc.customer_id,
        dc.customer_name,
        dc.contact_person,
        dc.contact_phone,
        dc.shipping_state_code,
        dc.shipping_state_name,
        dc.customer_gstin,
        dc.dispatch_purpose,
        dc.transporter_id,
        dc.transporter_name,
        dc.vehicle_no,
        dc.lr_rr_no,
        dc.lr_rr_date,
        dc.e_way_bill_no,
        dc.e_way_bill_date,
        dc.delivery_terms,
        dc.total_packages,
        dc.package_type,
        dc.gross_weight_kg::FLOAT AS gross_weight_kg,
        dc.net_weight_kg::FLOAT AS net_weight_kg,
        dc.warehouse_id,
        w.warehouse_name,
        dc.total_quantity::FLOAT AS total_quantity,
        dc.total_value::FLOAT AS total_value,
        dc.status,
        dc.picked_by,
        dc.picked_at,
        dc.packed_by,
        dc.packed_at,
        dc.dispatched_by,
        dc.dispatched_at,
        dc.delivered_at,
        dc.remarks,
        dc.terms_and_conditions,
        (SELECT COUNT(*)::INT FROM tbl_sales_delivery_challan_item dci WHERE dci.challan_id = dc.challan_id AND dci.is_active = TRUE) AS item_count
      FROM tbl_sales_delivery_challan_header dc
      LEFT JOIN tbl_inv_warehouse w ON dc.warehouse_id = w.warehouse_id
      WHERE ${whereClause}
      ORDER BY dc.challan_date DESC, dc.challan_id DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++};
    `;

    params.push(Number(limit), Number(offset));
    const dataRes = await this.pool.query(dataSql, params);

    return {
      data: dataRes.rows,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  // --------------------------------------------------------------------------
  // 4. Find One Delivery Challan with Line Items
  // --------------------------------------------------------------------------
  async findOne(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const headerRes = await this.pool.query(
      `SELECT
         dc.*,
         dc.gross_weight_kg::FLOAT AS gross_weight_kg,
         dc.net_weight_kg::FLOAT AS net_weight_kg,
         dc.total_quantity::FLOAT AS total_quantity,
         dc.total_value::FLOAT AS total_value,
         w.warehouse_code,
         w.warehouse_name,
         u1.full_name AS picked_by_name,
         u2.full_name AS packed_by_name,
         u3.full_name AS dispatched_by_name,
         so.customer_po_no,
         so.customer_po_date
       FROM tbl_sales_delivery_challan_header dc
       LEFT JOIN tbl_inv_warehouse w ON dc.warehouse_id = w.warehouse_id
       LEFT JOIN tbl_sec_user u1 ON dc.picked_by = u1.user_id
       LEFT JOIN tbl_sec_user u2 ON dc.packed_by = u2.user_id
       LEFT JOIN tbl_sec_user u3 ON dc.dispatched_by = u3.user_id
       LEFT JOIN tbl_sales_order_header so ON dc.so_id = so.so_id
       WHERE dc.challan_id = $1 AND dc.comp_id = $2 AND dc.is_active = TRUE;`,
      [id, compId],
    );

    if (headerRes.rows.length === 0) {
      throw new NotFoundException(`Delivery Challan #${id} not found.`);
    }

    const header = headerRes.rows[0];

    const itemsRes = await this.pool.query(
      `SELECT
         dci.challan_item_id,
         dci.challan_id,
         dci.so_item_id,
         dci.item_sequence,
         dci.item_id,
         dci.item_code,
         dci.item_name,
         dci.description,
         dci.hsn_sac_code,
         dci.uom_id,
         u.uom_code,
         dci.ordered_qty::FLOAT AS ordered_qty,
         dci.dispatched_qty::FLOAT AS dispatched_qty,
         dci.warehouse_id,
         w.warehouse_name,
         dci.bin_id,
         b.bin_code,
         b.bin_name,
         dci.batch_no,
         dci.heat_no,
         dci.unit_rate::FLOAT AS unit_rate,
         dci.total_amount::FLOAT AS total_amount,
         dci.remarks,
         soi.ordered_qty::FLOAT AS original_so_ordered_qty,
         soi.delivered_qty::FLOAT AS original_so_delivered_qty
       FROM tbl_sales_delivery_challan_item dci
       JOIN tbl_inv_uom u ON dci.uom_id = u.uom_id
       LEFT JOIN tbl_inv_warehouse w ON dci.warehouse_id = w.warehouse_id
       LEFT JOIN tbl_inv_storage_bin b ON dci.bin_id = b.bin_id
       LEFT JOIN tbl_sales_order_item soi ON dci.so_item_id = soi.so_item_id
       WHERE dci.challan_id = $1 AND dci.is_active = TRUE
       ORDER BY dci.item_sequence ASC;`,
      [id],
    );

    return {
      ...header,
      items: itemsRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // 5. Create Delivery Challan
  // --------------------------------------------------------------------------
  async create(dto: CreateChallanDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one line item is required.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Generate Challan Number if not provided
      let challanNo = dto.challanNo;
      if (!challanNo) {
        const branchRes = await client.query(
          `SELECT branch_code FROM tbl_org_branch WHERE branch_id = $1;`,
          [branchId],
        );
        const branchCode = branchRes.rows[0]?.branch_code || 'AHM';

        const seqRes = await client.query(
          `SELECT COALESCE(MAX(challan_id), 1000) + 1 AS next_val FROM tbl_sales_delivery_challan_header;`,
        );
        const nextVal = seqRes.rows[0]?.next_val || 1001;
        const seqStr = String(nextVal).slice(-4).padStart(4, '0');
        challanNo = `DC-${branchCode}-2627-${seqStr}`;
      }

      // 2. Fetch Customer Info if missing
      let customerName = dto.customerName;
      if (!customerName) {
        const cRes = await client.query(
          `SELECT party_name, primary_contact_name, primary_phone FROM tbl_crm_party WHERE party_id = $1;`,
          [dto.customerId],
        );
        customerName = cRes.rows[0]?.party_name || 'Customer';
        if (!dto.contactPerson) dto.contactPerson = cRes.rows[0]?.primary_contact_name;
        if (!dto.contactPhone) dto.contactPhone = cRes.rows[0]?.primary_phone;
      }

      // 3. Rollup Line Items
      let totalQty = 0;
      let totalVal = 0;
      for (const itm of dto.items) {
        const qty = Number(itm.dispatchedQty || 0);
        const rate = Number(itm.unitRate || 0);
        const amt = Number(itm.totalAmount || (qty * rate).toFixed(2));
        totalQty += qty;
        totalVal += amt;
      }

      // 4. Insert Header
      const headerSql = `
        INSERT INTO tbl_sales_delivery_challan_header (
          challan_no, challan_date, so_id, so_no, customer_id, customer_name,
          contact_person, contact_phone, billing_address_id, billing_address,
          shipping_address_id, shipping_address, shipping_state_code, shipping_state_name, customer_gstin,
          dispatch_purpose, transporter_id, transporter_name, vehicle_no, lr_rr_no, lr_rr_date,
          e_way_bill_no, e_way_bill_date, delivery_terms, total_packages, package_type,
          gross_weight_kg, net_weight_kg, warehouse_id, total_quantity, total_value,
          status, remarks, terms_and_conditions, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21,
          $22, $23, $24, $25, $26,
          $27, $28, $29, $30, $31,
          'DRAFT', $32, $33, TRUE,
          $34, $35, $36, $37
        ) RETURNING challan_id;
      `;

      const headerParams = [
        challanNo,
        dto.challanDate || new Date().toISOString().split('T')[0],
        dto.soId || null,
        dto.soNo || null,
        dto.customerId,
        customerName,
        dto.contactPerson || null,
        dto.contactPhone || null,
        dto.billingAddressId || null,
        dto.billingAddress || null,
        dto.shippingAddressId || null,
        dto.shippingAddress || null,
        dto.shippingStateCode || '24',
        dto.shippingStateName || 'Gujarat',
        dto.customerGstin || null,
        dto.dispatchPurpose || 'SUPPLY_ON_SALE',
        dto.transporterId || null,
        dto.transporterName || null,
        dto.vehicleNo || null,
        dto.lrRrNo || null,
        dto.lrRrDate || null,
        dto.eWayBillNo || null,
        dto.eWayBillDate || null,
        dto.deliveryTerms || 'EX_WORKS',
        dto.totalPackages || 1,
        dto.packageType || 'Corrugated Boxes',
        dto.grossWeightKg || 0,
        dto.netWeightKg || 0,
        dto.warehouseId,
        totalQty,
        totalVal,
        dto.remarks || null,
        dto.termsAndConditions || null,
        compId,
        branchId,
        fyearId,
        user.userId,
      ];

      const headerRes = await client.query(headerSql, headerParams);
      const challanId = headerRes.rows[0]?.challan_id;

      // 5. Insert Items
      let seq = 1;
      for (const itm of dto.items) {
        const qty = Number(itm.dispatchedQty || 0);
        const rate = Number(itm.unitRate || 0);
        const amt = Number(itm.totalAmount || (qty * rate).toFixed(2));

        await client.query(
          `INSERT INTO tbl_sales_delivery_challan_item (
             challan_id, so_item_id, item_sequence, item_id, item_code, item_name,
             description, hsn_sac_code, uom_id, ordered_qty, dispatched_qty,
             warehouse_id, bin_id, batch_no, heat_no, unit_rate, total_amount, remarks,
             is_active, comp_id, branch_id, fyear_id, created_by
           ) VALUES (
             $1, $2, $3, $4, $5, $6,
             $7, $8, $9, $10, $11,
             $12, $13, $14, $15, $16, $17, $18,
             TRUE, $19, $20, $21, $22
           );`,
          [
            challanId,
            itm.soItemId || null,
            seq++,
            itm.itemId,
            itm.itemCode || 'ITEM',
            itm.itemName || 'Item Description',
            itm.description || null,
            itm.hsnSacCode || null,
            itm.uomId,
            itm.orderedQty || qty,
            qty,
            itm.warehouseId || dto.warehouseId,
            itm.binId || null,
            itm.batchNo || null,
            itm.heatNo || null,
            rate,
            amt,
            itm.remarks || null,
            compId,
            branchId,
            fyearId,
            user.userId,
          ],
        );
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId: user.userId,
        username: user.username,
        screenCode: 'DELIVERY_CHALLAN',
        actionType: 'ADD',
        entityTable: 'tbl_sales_delivery_challan_header',
        recordId: challanId,
        newValue: { challanId, challanNo, totalQty, totalVal },
        compId,
        branchId,
      });

      return this.findOne(challanId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Error creating delivery challan: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 6. Update Delivery Challan
  // --------------------------------------------------------------------------
  async update(id: number, dto: UpdateChallanDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    const existing = await this.findOne(id, user);
    if (!['DRAFT', 'PICKED'].includes(existing.status)) {
      throw new BadRequestException(
        `Cannot edit delivery challan #${id} in '${existing.status}' status. Only DRAFT or PICKED challans can be modified.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let totalQty = existing.total_quantity;
      let totalVal = existing.total_value;

      if (dto.items && dto.items.length > 0) {
        totalQty = 0;
        totalVal = 0;
        for (const itm of dto.items) {
          const qty = Number(itm.dispatchedQty || 0);
          const rate = Number(itm.unitRate || 0);
          const amt = Number(itm.totalAmount || (qty * rate).toFixed(2));
          totalQty += qty;
          totalVal += amt;
        }

        // Remove old items
        await client.query(
          `DELETE FROM tbl_sales_delivery_challan_item WHERE challan_id = $1;`,
          [id],
        );

        // Insert updated items
        let seq = 1;
        for (const itm of dto.items) {
          const qty = Number(itm.dispatchedQty || 0);
          const rate = Number(itm.unitRate || 0);
          const amt = Number(itm.totalAmount || (qty * rate).toFixed(2));

          await client.query(
            `INSERT INTO tbl_sales_delivery_challan_item (
               challan_id, so_item_id, item_sequence, item_id, item_code, item_name,
               description, hsn_sac_code, uom_id, ordered_qty, dispatched_qty,
               warehouse_id, bin_id, batch_no, heat_no, unit_rate, total_amount, remarks,
               is_active, comp_id, branch_id, fyear_id, created_by
             ) VALUES (
               $1, $2, $3, $4, $5, $6,
               $7, $8, $9, $10, $11,
               $12, $13, $14, $15, $16, $17, $18,
               TRUE, $19, $20, $21, $22
             );`,
            [
              id,
              itm.soItemId || null,
              seq++,
              itm.itemId,
              itm.itemCode || 'ITEM',
              itm.itemName || 'Item Description',
              itm.description || null,
              itm.hsnSacCode || null,
              itm.uomId,
              itm.orderedQty || qty,
              qty,
              itm.warehouseId || dto.warehouseId || existing.warehouse_id,
              itm.binId || null,
              itm.batchNo || null,
              itm.heatNo || null,
              rate,
              amt,
              itm.remarks || null,
              compId,
              branchId,
              fyearId,
              user.userId,
            ],
          );
        }
      }

      // Update Header
      await client.query(
        `UPDATE tbl_sales_delivery_challan_header
         SET
           challan_date = COALESCE($1, challan_date),
           so_id = COALESCE($2, so_id),
           so_no = COALESCE($3, so_no),
           customer_id = COALESCE($4, customer_id),
           customer_name = COALESCE($5, customer_name),
           contact_person = COALESCE($6, contact_person),
           contact_phone = COALESCE($7, contact_phone),
           billing_address_id = COALESCE($8, billing_address_id),
           billing_address = COALESCE($9, billing_address),
           shipping_address_id = COALESCE($10, shipping_address_id),
           shipping_address = COALESCE($11, shipping_address),
           shipping_state_code = COALESCE($12, shipping_state_code),
           shipping_state_name = COALESCE($13, shipping_state_name),
           customer_gstin = COALESCE($14, customer_gstin),
           dispatch_purpose = COALESCE($15, dispatch_purpose),
           transporter_id = COALESCE($16, transporter_id),
           transporter_name = COALESCE($17, transporter_name),
           vehicle_no = COALESCE($18, vehicle_no),
           lr_rr_no = COALESCE($19, lr_rr_no),
           lr_rr_date = COALESCE($20, lr_rr_date),
           e_way_bill_no = COALESCE($21, e_way_bill_no),
           e_way_bill_date = COALESCE($22, e_way_bill_date),
           delivery_terms = COALESCE($23, delivery_terms),
           total_packages = COALESCE($24, total_packages),
           package_type = COALESCE($25, package_type),
           gross_weight_kg = COALESCE($26, gross_weight_kg),
           net_weight_kg = COALESCE($27, net_weight_kg),
           warehouse_id = COALESCE($28, warehouse_id),
           total_quantity = $29,
           total_value = $30,
           remarks = COALESCE($31, remarks),
           terms_and_conditions = COALESCE($32, terms_and_conditions),
           updated_by = $33,
           updated_date = CURRENT_TIMESTAMP
         WHERE challan_id = $34;`,
        [
          dto.challanDate,
          dto.soId,
          dto.soNo,
          dto.customerId,
          dto.customerName,
          dto.contactPerson,
          dto.contactPhone,
          dto.billingAddressId,
          dto.billingAddress,
          dto.shippingAddressId,
          dto.shippingAddress,
          dto.shippingStateCode,
          dto.shippingStateName,
          dto.customerGstin,
          dto.dispatchPurpose,
          dto.transporterId,
          dto.transporterName,
          dto.vehicleNo,
          dto.lrRrNo,
          dto.lrRrDate,
          dto.eWayBillNo,
          dto.eWayBillDate,
          dto.deliveryTerms,
          dto.totalPackages,
          dto.packageType,
          dto.grossWeightKg,
          dto.netWeightKg,
          dto.warehouseId,
          totalQty,
          totalVal,
          dto.remarks,
          dto.termsAndConditions,
          user.userId,
          id,
        ],
      );

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId: user.userId,
        username: user.username,
        screenCode: 'DELIVERY_CHALLAN',
        actionType: 'EDIT',
        entityTable: 'tbl_sales_delivery_challan_header',
        recordId: id,
        oldValue: { status: existing.status, totalVal: existing.total_value },
        newValue: { totalQty, totalVal },
        compId,
        branchId,
      });

      return this.findOne(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Error updating delivery challan #${id}: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 7. Pick Slip Generation / Confirmation
  // --------------------------------------------------------------------------
  async pick(id: number, dto: PickChallanDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const existing = await this.findOne(id, user);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        `Challan #${id} is currently in '${existing.status}' status. Only DRAFT challans can be confirmed for picking.`,
      );
    }

    await this.pool.query(
      `UPDATE tbl_sales_delivery_challan_header
       SET
         status = 'PICKED',
         picked_by = $1,
         picked_at = CURRENT_TIMESTAMP,
         remarks = CASE WHEN $2::VARCHAR IS NOT NULL THEN COALESCE(remarks, '') || ' | Pick: ' || $2::VARCHAR ELSE remarks END,
         updated_by = $1,
         updated_date = CURRENT_TIMESTAMP
       WHERE challan_id = $3;`,
      [user.userId, dto.remarks || null, id],
    );

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'DELIVERY_CHALLAN',
      actionType: 'PICK',
      entityTable: 'tbl_sales_delivery_challan_header',
      recordId: id,
      oldValue: { status: 'DRAFT' },
      newValue: { status: 'PICKED', pickedBy: user.userId },
      compId,
      branchId,
    });

    return this.findOne(id, user);
  }

  // --------------------------------------------------------------------------
  // 8. Packing Confirmation
  // --------------------------------------------------------------------------
  async pack(id: number, dto: PackChallanDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const existing = await this.findOne(id, user);
    if (!['DRAFT', 'PICKED'].includes(existing.status)) {
      throw new BadRequestException(
        `Challan #${id} is currently in '${existing.status}' status. Only DRAFT or PICKED challans can be confirmed for packing.`,
      );
    }

    await this.pool.query(
      `UPDATE tbl_sales_delivery_challan_header
       SET
         status = 'PACKED',
         packed_by = $1,
         packed_at = CURRENT_TIMESTAMP,
         total_packages = COALESCE($2, total_packages),
         package_type = COALESCE($3, package_type),
         gross_weight_kg = COALESCE($4, gross_weight_kg),
         net_weight_kg = COALESCE($5, net_weight_kg),
         remarks = CASE WHEN $6::VARCHAR IS NOT NULL THEN COALESCE(remarks, '') || ' | Pack: ' || $6::VARCHAR ELSE remarks END,
         updated_by = $1,
         updated_date = CURRENT_TIMESTAMP
       WHERE challan_id = $7;`,
      [
        user.userId,
        dto.totalPackages,
        dto.packageType,
        dto.grossWeightKg,
        dto.netWeightKg,
        dto.remarks || null,
        id,
      ],
    );

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'DELIVERY_CHALLAN',
      actionType: 'PACK',
      entityTable: 'tbl_sales_delivery_challan_header',
      recordId: id,
      oldValue: { status: existing.status },
      newValue: { status: 'PACKED', packedBy: user.userId },
      compId,
      branchId,
    });

    return this.findOne(id, user);
  }

  // --------------------------------------------------------------------------
  // 9. Physical Gate Dispatch & Stock Ledger Deduction
  // --------------------------------------------------------------------------
  async dispatch(id: number, dto: DispatchChallanDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    const existing = await this.findOne(id, user);
    if (existing.status === 'DISPATCHED' || existing.status === 'DELIVERED') {
      throw new BadRequestException(`Delivery Challan #${id} has already been dispatched.`);
    }
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot dispatch cancelled Delivery Challan #${id}.`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Update Challan Header to DISPATCHED
      await client.query(
        `UPDATE tbl_sales_delivery_challan_header
         SET
           status = 'DISPATCHED',
           dispatched_by = $1,
           dispatched_at = CURRENT_TIMESTAMP,
           vehicle_no = COALESCE($2, vehicle_no),
           transporter_id = COALESCE($3, transporter_id),
           transporter_name = COALESCE($4, transporter_name),
           lr_rr_no = COALESCE($5, lr_rr_no),
           lr_rr_date = COALESCE($6, lr_rr_date),
           e_way_bill_no = COALESCE($7, e_way_bill_no),
           e_way_bill_date = COALESCE($8, e_way_bill_date),
           remarks = CASE WHEN $9::VARCHAR IS NOT NULL THEN COALESCE(remarks, '') || ' | Dispatch: ' || $9::VARCHAR ELSE remarks END,
           updated_by = $1,
           updated_date = CURRENT_TIMESTAMP
         WHERE challan_id = $10;`,
        [
          user.userId,
          dto.vehicleNo || null,
          dto.transporterId || null,
          dto.transporterName || null,
          dto.lrRrNo || null,
          dto.lrRrDate || null,
          dto.eWayBillNo || null,
          dto.eWayBillDate || null,
          dto.remarks || null,
          id,
        ],
      );

      // 2. Inventory Deductions & Stock Ledger Entries
      for (const itm of existing.items) {
        const qtyToDeduct = Number(itm.dispatched_qty || 0);
        if (qtyToDeduct <= 0) continue;

        const binId = itm.bin_id;
        const itemId = itm.item_id;
        const whId = itm.warehouse_id || existing.warehouse_id;

        // Query current balance in bin if binId exists
        let currentOnHand = 0;
        if (binId) {
          const binStockRes = await client.query(
            `SELECT on_hand_qty, reserved_qty, available_qty
             FROM tbl_inv_bin_stock
             WHERE bin_id = $1 AND item_id = $2;`,
            [binId, itemId],
          );
          if (binStockRes.rows.length > 0) {
            currentOnHand = Number(binStockRes.rows[0].on_hand_qty || 0);

            // Deduct on_hand and reserved
            await client.query(
              `UPDATE tbl_inv_bin_stock
               SET
                 on_hand_qty = GREATEST(0, on_hand_qty - $1),
                 reserved_qty = GREATEST(0, reserved_qty - $1),
                 available_qty = GREATEST(0, on_hand_qty - $1) - GREATEST(0, reserved_qty - $1),
                 last_stock_date = CURRENT_TIMESTAMP,
                 updated_by = $2,
                 updated_date = CURRENT_TIMESTAMP
               WHERE bin_id = $3 AND item_id = $4;`,
              [qtyToDeduct, user.userId, binId, itemId],
            );
          }
        }

        const newClosingBalance = Math.max(0, currentOnHand - qtyToDeduct);

        // Record in tbl_inv_stock_ledger
        await client.query(
          `INSERT INTO tbl_inv_stock_ledger (
             comp_id, branch_id, fyear_id, transaction_date,
             transaction_type, reference_doc_type, reference_doc_id, reference_doc_no,
             warehouse_id, from_bin_id, to_bin_id, item_id, uom_id,
             batch_no, heat_no, qty_in, qty_out, unit_cost, total_cost, closing_balance,
             remarks, is_active, created_by
           ) VALUES (
             $1, $2, $3, CURRENT_TIMESTAMP,
             'SALES_DISPATCH', 'DELIVERY_CHALLAN', $4, $5,
             $6, $7, NULL, $8, $9,
             $10, $11, 0.000, $12, $13, $14, $15,
             $16, TRUE, $17
           );`,
          [
            compId,
            branchId,
            fyearId,
            id,
            existing.challan_no,
            whId,
            binId || null,
            itemId,
            itm.uom_id,
            itm.batch_no || null,
            itm.heat_no || null,
            qtyToDeduct,
            itm.unit_rate || 0,
            (qtyToDeduct * Number(itm.unit_rate || 0)).toFixed(2),
            newClosingBalance,
            `Outward dispatch per Delivery Challan ${existing.challan_no}`,
            user.userId,
          ],
        );

        // 3. Update Sales Order Item delivered_qty & reserved_qty
        if (itm.so_item_id) {
          await client.query(
            `UPDATE tbl_sales_order_item
             SET
               delivered_qty = delivered_qty + $1,
               reserved_qty = GREATEST(0, reserved_qty - $1),
               updated_by = $2,
               updated_date = CURRENT_TIMESTAMP
             WHERE so_item_id = $3;`,
            [qtyToDeduct, user.userId, itm.so_item_id],
          );
        }
      }

      // 4. Update Parent Sales Order Status
      if (existing.so_id) {
        const soItemsRes = await client.query(
          `SELECT
             ordered_qty::FLOAT AS ordered_qty,
             delivered_qty::FLOAT AS delivered_qty
           FROM tbl_sales_order_item
           WHERE so_id = $1 AND is_active = TRUE;`,
          [existing.so_id],
        );

        let allDelivered = true;
        let anyDelivered = false;
        for (const r of soItemsRes.rows) {
          if (r.delivered_qty < r.ordered_qty) {
            allDelivered = false;
          }
          if (r.delivered_qty > 0) {
            anyDelivered = true;
          }
        }

        const newSoStatus = allDelivered
          ? 'COMPLETED'
          : anyDelivered
          ? 'PARTIALLY_DELIVERED'
          : 'CONFIRMED';

        await client.query(
          `UPDATE tbl_sales_order_header
           SET
             status = $1,
             updated_by = $2,
             updated_date = CURRENT_TIMESTAMP
           WHERE so_id = $3;`,
          [newSoStatus, user.userId, existing.so_id],
        );
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId: user.userId,
        username: user.username,
        screenCode: 'DELIVERY_CHALLAN',
        actionType: 'DISPATCH',
        entityTable: 'tbl_sales_delivery_challan_header',
        recordId: id,
        oldValue: { status: existing.status },
        newValue: { status: 'DISPATCHED', dispatchedBy: user.userId },
        compId,
        branchId,
      });

      return this.findOne(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Error dispatching delivery challan #${id}: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 10. Mark Delivered (Customer Receipt Acknowledged)
  // --------------------------------------------------------------------------
  async markDelivered(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const existing = await this.findOne(id, user);
    if (existing.status !== 'DISPATCHED') {
      throw new BadRequestException(
        `Only DISPATCHED challans can be marked as DELIVERED. Current status: '${existing.status}'.`,
      );
    }

    await this.pool.query(
      `UPDATE tbl_sales_delivery_challan_header
       SET
         status = 'DELIVERED',
         delivered_at = CURRENT_TIMESTAMP,
         updated_by = $1,
         updated_date = CURRENT_TIMESTAMP
       WHERE challan_id = $2;`,
      [user.userId, id],
    );

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'DELIVERY_CHALLAN',
      actionType: 'COMPLETE',
      entityTable: 'tbl_sales_delivery_challan_header',
      recordId: id,
      oldValue: { status: 'DISPATCHED' },
      newValue: { status: 'DELIVERED' },
      compId,
      branchId,
    });

    return this.findOne(id, user);
  }

  // --------------------------------------------------------------------------
  // 11. Cancel Delivery Challan (with Stock Reversal if Dispatched)
  // --------------------------------------------------------------------------
  async cancel(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    const existing = await this.findOne(id, user);
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException(`Delivery Challan #${id} is already cancelled.`);
    }
    if (existing.status === 'DELIVERED') {
      throw new BadRequestException(
        `Cannot cancel delivered Challan #${id}. Please issue a Sales Return (Credit Note) instead.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // If it was already dispatched, reverse inventory and sales order delivered quantities!
      if (existing.status === 'DISPATCHED') {
        for (const itm of existing.items) {
          const qtyToReverse = Number(itm.dispatched_qty || 0);
          if (qtyToReverse <= 0) continue;

          const binId = itm.bin_id;
          const itemId = itm.item_id;
          const whId = itm.warehouse_id || existing.warehouse_id;

          // Re-add to on_hand and reserved in tbl_inv_bin_stock
          if (binId) {
            await client.query(
              `UPDATE tbl_inv_bin_stock
               SET
                 on_hand_qty = on_hand_qty + $1,
                 reserved_qty = reserved_qty + $1,
                 available_qty = (on_hand_qty + $1) - (reserved_qty + $1),
                 last_stock_date = CURRENT_TIMESTAMP,
                 updated_by = $2,
                 updated_date = CURRENT_TIMESTAMP
               WHERE bin_id = $3 AND item_id = $4;`,
              [qtyToReverse, user.userId, binId, itemId],
            );
          }

          // Stock ledger reversal entry
          await client.query(
            `INSERT INTO tbl_inv_stock_ledger (
               comp_id, branch_id, fyear_id, transaction_date,
               transaction_type, reference_doc_type, reference_doc_id, reference_doc_no,
               warehouse_id, from_bin_id, to_bin_id, item_id, uom_id,
               batch_no, heat_no, qty_in, qty_out, unit_cost, total_cost, closing_balance,
               remarks, is_active, created_by
             ) VALUES (
               $1, $2, $3, CURRENT_TIMESTAMP,
               'ADJUSTMENT', 'DELIVERY_CHALLAN', $4, $5,
               $6, NULL, $7, $8, $9,
               $10, $11, $12, 0.000, $13, $14, 0.000,
               $15, TRUE, $16
             );`,
            [
              compId,
              branchId,
              fyearId,
              id,
              existing.challan_no,
              whId,
              binId || null,
              itemId,
              itm.uom_id,
              itm.batch_no || null,
              itm.heat_no || null,
              qtyToReverse,
              itm.unit_rate || 0,
              (qtyToReverse * Number(itm.unit_rate || 0)).toFixed(2),
              `Reversal due to cancellation of Delivery Challan ${existing.challan_no}`,
              user.userId,
            ],
          );

          // Reverse SO item delivered_qty
          if (itm.so_item_id) {
            await client.query(
              `UPDATE tbl_sales_order_item
               SET
                 delivered_qty = GREATEST(0, delivered_qty - $1),
                 reserved_qty = reserved_qty + $1,
                 updated_by = $2,
                 updated_date = CURRENT_TIMESTAMP
               WHERE so_item_id = $3;`,
              [qtyToReverse, user.userId, itm.so_item_id],
            );
          }
        }

        // Recheck SO status
        if (existing.so_id) {
          await client.query(
            `UPDATE tbl_sales_order_header
             SET
               status = 'READY_FOR_DISPATCH',
               updated_by = $1,
               updated_date = CURRENT_TIMESTAMP
             WHERE so_id = $2;`,
            [user.userId, existing.so_id],
          );
        }
      }

      // Update Challan to CANCELLED
      await client.query(
        `UPDATE tbl_sales_delivery_challan_header
         SET
           status = 'CANCELLED',
           updated_by = $1,
           updated_date = CURRENT_TIMESTAMP
         WHERE challan_id = $2;`,
        [user.userId, id],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId: user.userId,
        username: user.username,
        screenCode: 'DELIVERY_CHALLAN',
        actionType: 'CANCEL',
        entityTable: 'tbl_sales_delivery_challan_header',
        recordId: id,
        oldValue: { status: existing.status },
        newValue: { status: 'CANCELLED' },
        compId,
        branchId,
      });

      return this.findOne(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Error cancelling delivery challan #${id}: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 12. Soft Delete (Draft Only)
  // --------------------------------------------------------------------------
  async delete(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const existing = await this.findOne(id, user);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT Delivery Challans can be deleted. Current status is '${existing.status}'.`,
      );
    }

    await this.pool.query(
      `UPDATE tbl_sales_delivery_challan_header
       SET is_active = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP
       WHERE challan_id = $2;`,
      [user.userId, id],
    );

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'DELIVERY_CHALLAN',
      actionType: 'DELETE',
      entityTable: 'tbl_sales_delivery_challan_header',
      recordId: id,
      oldValue: { challanNo: existing.challan_no },
      compId,
      branchId,
    });

    return { success: true, message: `Delivery Challan #${id} deleted successfully.` };
  }
}
