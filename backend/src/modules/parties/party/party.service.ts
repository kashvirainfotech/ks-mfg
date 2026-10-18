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
  CreatePartyAddressDto,
  CreatePartyDto,
  PartyFilterDto,
  UpdatePartyDto,
} from './party.dto';

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

@Injectable()
export class PartyService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // ==========================================================================
  // SUMMARY / KPI METRICS
  // ==========================================================================

  async getPartySummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const { rows } = await this.pool.query(
      `
      SELECT
        COUNT(*)::int AS "totalParties",
        COUNT(CASE WHEN is_active = true AND is_customer = true THEN 1 END)::int AS "customersCount",
        COUNT(CASE WHEN is_active = true AND is_supplier = true THEN 1 END)::int AS "suppliersCount",
        COUNT(CASE WHEN is_active = true AND is_job_worker = true THEN 1 END)::int AS "jobWorkersCount",
        COUNT(CASE WHEN is_active = true AND is_transporter = true THEN 1 END)::int AS "transportersCount"
      FROM tbl_crm_party
      WHERE comp_id = $1
      `,
      [compId],
    );

    const r = rows[0] || {};
    return {
      totalParties: Number(r.totalParties) || 0,
      customersCount: Number(r.customersCount) || 0,
      suppliersCount: Number(r.suppliersCount) || 0,
      jobWorkersCount: Number(r.jobWorkersCount) || 0,
      transportersCount: Number(r.transportersCount) || 0,
    };
  }

  // ==========================================================================
  // RETRIEVAL & LISTING
  // ==========================================================================

  async findAllParties(filters: PartyFilterDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const conditions: string[] = ['p.comp_id = $1'];
    const params: unknown[] = [compId];

    if (filters.isCustomer !== undefined) {
      params.push(filters.isCustomer);
      conditions.push(`p.is_customer = $${params.length}`);
    }

    if (filters.isSupplier !== undefined) {
      params.push(filters.isSupplier);
      conditions.push(`p.is_supplier = $${params.length}`);
    }

    if (filters.isJobWorker !== undefined) {
      params.push(filters.isJobWorker);
      conditions.push(`p.is_job_worker = $${params.length}`);
    }

    if (filters.isTransporter !== undefined) {
      params.push(filters.isTransporter);
      conditions.push(`p.is_transporter = $${params.length}`);
    }

    if (filters.partyGroup) {
      params.push(filters.partyGroup);
      conditions.push(`p.party_group = $${params.length}`);
    }

    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
      conditions.push(`p.is_active = $${params.length}`);
    }

    if (filters.search && filters.search.trim()) {
      params.push(`%${filters.search.trim()}%`);
      const pIdx = params.length;
      conditions.push(
        `(p.party_code ILIKE $${pIdx} OR p.party_name ILIKE $${pIdx} OR p.trade_name ILIKE $${pIdx} OR p.primary_contact_name ILIKE $${pIdx} OR p.pan_no ILIKE $${pIdx})`,
      );
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `
      SELECT
        p.party_id              AS "partyId",
        p.party_code            AS "partyCode",
        p.party_name            AS "partyName",
        p.trade_name            AS "tradeName",
        p.is_customer           AS "isCustomer",
        p.is_supplier           AS "isSupplier",
        p.is_job_worker         AS "isJobWorker",
        p.is_transporter        AS "isTransporter",
        p.party_group           AS "partyGroup",
        p.pan_no                AS "panNo",
        p.msme_reg_no           AS "msmeRegNo",
        p.primary_contact_name  AS "primaryContactName",
        p.primary_email         AS "primaryEmail",
        p.primary_phone         AS "primaryPhone",
        p.website               AS "website",
        p.credit_limit          AS "creditLimit",
        p.credit_days           AS "creditDays",
        p.payment_terms         AS "paymentTerms",
        p.currency_code         AS "currencyCode",
        p.gst_treatment_type    AS "gstTreatmentType",
        p.is_active             AS "isActive",
        p.remarks               AS "remarks",
        p.created_date          AS "createdDate",
        p.updated_date          AS "updatedDate",
        COALESCE(
          json_agg(
            json_build_object(
              'addressId', a.address_id,
              'addressLabel', a.address_label,
              'addressType', a.address_type,
              'gstin', a.gstin,
              'stateCode', a.state_code,
              'stateName', a.state_name,
              'addressLine1', a.address_line1,
              'addressLine2', a.address_line2,
              'city', a.city,
              'pincode', a.pincode,
              'contactPerson', a.contact_person,
              'phone', a.phone,
              'email', a.email,
              'isDefaultBilling', a.is_default_billing,
              'isDefaultShipping', a.is_default_shipping,
              'isActive', a.is_active
            )
          ) FILTER (WHERE a.address_id IS NOT NULL),
          '[]'
        ) AS "addresses"
      FROM tbl_crm_party p
      LEFT JOIN tbl_crm_party_address a ON a.party_id = p.party_id
      ${whereSql}
      GROUP BY p.party_id
      ORDER BY p.party_name ASC
      `,
      params,
    );

    return rows.map((r) => this.mapPartyRow(r));
  }

  async findPartyById(partyId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const { rows } = await this.pool.query(
      `
      SELECT
        p.party_id              AS "partyId",
        p.party_code            AS "partyCode",
        p.party_name            AS "partyName",
        p.trade_name            AS "tradeName",
        p.is_customer           AS "isCustomer",
        p.is_supplier           AS "isSupplier",
        p.is_job_worker         AS "isJobWorker",
        p.is_transporter        AS "isTransporter",
        p.party_group           AS "partyGroup",
        p.pan_no                AS "panNo",
        p.msme_reg_no           AS "msmeRegNo",
        p.primary_contact_name  AS "primaryContactName",
        p.primary_email         AS "primaryEmail",
        p.primary_phone         AS "primaryPhone",
        p.website               AS "website",
        p.credit_limit          AS "creditLimit",
        p.credit_days           AS "creditDays",
        p.payment_terms         AS "paymentTerms",
        p.currency_code         AS "currencyCode",
        p.gst_treatment_type    AS "gstTreatmentType",
        p.is_active             AS "isActive",
        p.remarks               AS "remarks",
        p.created_date          AS "createdDate",
        p.updated_date          AS "updatedDate",
        COALESCE(
          json_agg(
            json_build_object(
              'addressId', a.address_id,
              'addressLabel', a.address_label,
              'addressType', a.address_type,
              'gstin', a.gstin,
              'stateCode', a.state_code,
              'stateName', a.state_name,
              'addressLine1', a.address_line1,
              'addressLine2', a.address_line2,
              'city', a.city,
              'pincode', a.pincode,
              'contactPerson', a.contact_person,
              'phone', a.phone,
              'email', a.email,
              'isDefaultBilling', a.is_default_billing,
              'isDefaultShipping', a.is_default_shipping,
              'isActive', a.is_active
            )
          ) FILTER (WHERE a.address_id IS NOT NULL),
          '[]'
        ) AS "addresses"
      FROM tbl_crm_party p
      LEFT JOIN tbl_crm_party_address a ON a.party_id = p.party_id
      WHERE p.party_id = $1 AND p.comp_id = $2
      GROUP BY p.party_id
      `,
      [partyId, compId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Party with ID ${partyId} not found`);
    }

    return this.mapPartyRow(rows[0]);
  }

  // ==========================================================================
  // CREATE / INSERT
  // ==========================================================================

  async createParty(
    dto: CreatePartyDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const trimmedCode = dto.partyCode.trim().toUpperCase();
    const trimmedName = dto.partyName.trim();

    if (!trimmedCode) {
      throw new BadRequestException('Party Code is required');
    }
    if (!trimmedName) {
      throw new BadRequestException('Party Name is required');
    }
    if (!dto.primaryPhone?.trim()) {
      throw new BadRequestException('Primary Phone is required');
    }

    // Verify duplicate code in company
    const { rows: dupRows } = await this.pool.query(
      `SELECT party_id FROM tbl_crm_party WHERE comp_id = $1 AND party_code = $2`,
      [compId, trimmedCode],
    );
    if (dupRows.length > 0) {
      throw new ConflictException(
        `Party code '${trimmedCode}' already exists in this company`,
      );
    }

    const client = await this.pool.connect();
    let newPartyId: number;

    try {
      await client.query('BEGIN');

      const partyInsertSql = `
        INSERT INTO tbl_crm_party (
          party_code, party_name, trade_name,
          is_customer, is_supplier, is_job_worker, is_transporter,
          party_group, pan_no, msme_reg_no,
          primary_contact_name, primary_email, primary_phone, website,
          credit_limit, credit_days, payment_terms, currency_code, gst_treatment_type,
          is_active, remarks,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6, $7,
          $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21,
          $22, $23, $24, $25
        )
        RETURNING party_id AS "partyId"
      `;

      const partyValues = [
        trimmedCode,
        trimmedName,
        dto.tradeName?.trim() || null,
        dto.isCustomer !== undefined ? dto.isCustomer : true,
        dto.isSupplier !== undefined ? dto.isSupplier : false,
        dto.isJobWorker !== undefined ? dto.isJobWorker : false,
        dto.isTransporter !== undefined ? dto.isTransporter : false,
        dto.partyGroup || 'OEM_AUTOMOTIVE',
        dto.panNo?.trim().toUpperCase() || null,
        dto.msmeRegNo?.trim().toUpperCase() || null,
        dto.primaryContactName.trim(),
        dto.primaryEmail?.trim().toLowerCase() || null,
        dto.primaryPhone.trim(),
        dto.website?.trim() || null,
        dto.creditLimit !== undefined ? dto.creditLimit : 0.0,
        dto.creditDays !== undefined ? dto.creditDays : 30,
        dto.paymentTerms || 'NET_30',
        dto.currencyCode || 'INR',
        dto.gstTreatmentType || 'REGISTERED_REGULAR',
        dto.isActive !== undefined ? dto.isActive : true,
        dto.remarks?.trim() || null,
        compId,
        branchId,
        fyearId,
        userId,
      ];

      const partyRes = await client.query(partyInsertSql, partyValues);
      newPartyId = Number(partyRes.rows[0].partyId);

      // Insert addresses if provided
      if (dto.addresses && dto.addresses.length > 0) {
        for (const addr of dto.addresses) {
          await this.insertAddress(client, newPartyId, addr, compId, branchId, fyearId, userId);
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const created = await this.findPartyById(newPartyId, user);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'PARTY_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_crm_party',
      recordId: newPartyId,
      oldValue: null,
      newValue: created as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return created;
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  async updateParty(
    partyId: number,
    dto: UpdatePartyDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const existing = await this.findPartyById(partyId, user);
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const trimmedCode =
      dto.partyCode !== undefined ? dto.partyCode.trim().toUpperCase() : existing.partyCode;
    const trimmedName =
      dto.partyName !== undefined ? dto.partyName.trim() : existing.partyName;

    if (dto.partyCode && trimmedCode !== existing.partyCode) {
      const { rows: dupRows } = await this.pool.query(
        `SELECT party_id FROM tbl_crm_party WHERE comp_id = $1 AND party_code = $2 AND party_id <> $3`,
        [compId, trimmedCode, partyId],
      );
      if (dupRows.length > 0) {
        throw new ConflictException(
          `Party code '${trimmedCode}' already exists in this company`,
        );
      }
    }

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const partyUpdateSql = `
        UPDATE tbl_crm_party SET
          party_code            = $1,
          party_name            = $2,
          trade_name            = $3,
          is_customer           = $4,
          is_supplier           = $5,
          is_job_worker         = $6,
          is_transporter        = $7,
          party_group           = $8,
          pan_no                = $9,
          msme_reg_no           = $10,
          primary_contact_name  = $11,
          primary_email         = $12,
          primary_phone         = $13,
          website               = $14,
          credit_limit          = $15,
          credit_days           = $16,
          payment_terms         = $17,
          currency_code         = $18,
          gst_treatment_type    = $19,
          is_active             = $20,
          remarks               = $21,
          updated_by            = $22,
          updated_date          = CURRENT_TIMESTAMP
        WHERE party_id = $23 AND comp_id = $24
      `;

      const partyValues = [
        trimmedCode,
        trimmedName,
        dto.tradeName !== undefined ? dto.tradeName?.trim() || null : existing.tradeName,
        dto.isCustomer !== undefined ? dto.isCustomer : existing.isCustomer,
        dto.isSupplier !== undefined ? dto.isSupplier : existing.isSupplier,
        dto.isJobWorker !== undefined ? dto.isJobWorker : existing.isJobWorker,
        dto.isTransporter !== undefined ? dto.isTransporter : existing.isTransporter,
        dto.partyGroup !== undefined ? dto.partyGroup : existing.partyGroup,
        dto.panNo !== undefined ? dto.panNo?.trim().toUpperCase() || null : existing.panNo,
        dto.msmeRegNo !== undefined ? dto.msmeRegNo?.trim().toUpperCase() || null : existing.msmeRegNo,
        dto.primaryContactName !== undefined ? dto.primaryContactName.trim() : existing.primaryContactName,
        dto.primaryEmail !== undefined ? dto.primaryEmail?.trim().toLowerCase() || null : existing.primaryEmail,
        dto.primaryPhone !== undefined ? dto.primaryPhone.trim() : existing.primaryPhone,
        dto.website !== undefined ? dto.website?.trim() || null : existing.website,
        dto.creditLimit !== undefined ? dto.creditLimit : existing.creditLimit,
        dto.creditDays !== undefined ? dto.creditDays : existing.creditDays,
        dto.paymentTerms !== undefined ? dto.paymentTerms : existing.paymentTerms,
        dto.currencyCode !== undefined ? dto.currencyCode : existing.currencyCode,
        dto.gstTreatmentType !== undefined ? dto.gstTreatmentType : existing.gstTreatmentType,
        dto.isActive !== undefined ? dto.isActive : existing.isActive,
        dto.remarks !== undefined ? dto.remarks?.trim() || null : existing.remarks,
        userId,
        partyId,
        compId,
      ];

      await client.query(partyUpdateSql, partyValues);

      // If addresses array passed, replace or sync addresses
      if (dto.addresses !== undefined) {
        await client.query(`DELETE FROM tbl_crm_party_address WHERE party_id = $1`, [partyId]);
        for (const addr of dto.addresses) {
          await this.insertAddress(client, partyId, addr, compId, branchId, fyearId, userId);
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updated = await this.findPartyById(partyId, user);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'PARTY_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_crm_party',
      recordId: partyId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return updated;
  }

  // ==========================================================================
  // DELETE
  // ==========================================================================

  async deleteParty(
    partyId: number,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const existing = await this.findPartyById(partyId, user);
    const compId = user.compId || 1001;

    // Check if referenced in operational or user tables
    await this.dependencyCheckService.verifyCanDelete({
      entity: 'Unified Party Master (Customer/Supplier/Vendor)',
      entityId: partyId,
      relations: [
        { table: 'tbl_sec_user', column: 'linked_entity_id', label: 'Linked External User Accounts' },
        { table: 'tbl_crm_price_list_header', column: 'party_id', label: 'Party-Specific Price Lists' },
        { table: 'tbl_po_header', column: 'supplier_id', label: 'Purchase Orders' },
        { table: 'tbl_so_header', column: 'customer_id', label: 'Sales Orders' },
        { table: 'tbl_grn_header', column: 'supplier_id', label: 'Goods Receipt Notes' },
        { table: 'tbl_subcon_challan', column: 'job_worker_id', label: 'Subcontractor Job-Work Challans' },
      ],
    });

    await this.pool.query(
      `DELETE FROM tbl_crm_party WHERE party_id = $1 AND comp_id = $2`,
      [partyId, compId],
    );

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'PARTY_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_crm_party',
      recordId: partyId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: null,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return {
      success: true,
      message: `Party ${existing.partyCode} (${existing.partyName}) deleted successfully`,
    };
  }

  // ==========================================================================
  // ACTION LOGGING
  // ==========================================================================

  async recordScreenAction(
    actionType: 'PRINT' | 'EXPORT',
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'PARTY_MASTER',
      actionType,
      entityTable: 'tbl_crm_party',
      recordId: 0,
      oldValue: null,
      newValue: { actionType, screenCode: 'PARTY_MASTER' },
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });
    return { logged: true };
  }

  // ==========================================================================
  // HELPER: ADDRESS INSERTION
  // ==========================================================================

  private async insertAddress(
    client: any,
    partyId: number,
    addr: CreatePartyAddressDto,
    compId: number,
    branchId: number,
    fyearId: number | null,
    userId: number,
  ) {
    const addressInsertSql = `
      INSERT INTO tbl_crm_party_address (
        party_id, address_label, address_type,
        gstin, state_code, state_name,
        address_line1, address_line2, city, pincode,
        contact_person, phone, email,
        is_default_billing, is_default_shipping, is_active,
        comp_id, branch_id, fyear_id, created_by
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16,
        $17, $18, $19, $20
      )
    `;

    const addrValues = [
      partyId,
      addr.addressLabel || 'Head Office / Billing',
      addr.addressType || 'BOTH',
      addr.gstin?.trim().toUpperCase() || null,
      addr.stateCode?.trim() || '24',
      addr.stateName?.trim() || 'Gujarat',
      addr.addressLine1.trim(),
      addr.addressLine2?.trim() || null,
      addr.city.trim(),
      addr.pincode.trim(),
      addr.contactPerson?.trim() || null,
      addr.phone?.trim() || null,
      addr.email?.trim().toLowerCase() || null,
      addr.isDefaultBilling !== undefined ? addr.isDefaultBilling : false,
      addr.isDefaultShipping !== undefined ? addr.isDefaultShipping : false,
      addr.isActive !== undefined ? addr.isActive : true,
      compId,
      branchId,
      fyearId,
      userId,
    ];

    await client.query(addressInsertSql, addrValues);
  }

  private mapPartyRow(r: any) {
    return {
      partyId: Number(r.partyId),
      partyCode: r.partyCode,
      partyName: r.partyName,
      tradeName: r.tradeName || null,
      isCustomer: Boolean(r.isCustomer),
      isSupplier: Boolean(r.isSupplier),
      isJobWorker: Boolean(r.isJobWorker),
      isTransporter: Boolean(r.isTransporter),
      partyGroup: r.partyGroup,
      panNo: r.panNo || null,
      msmeRegNo: r.msmeRegNo || null,
      primaryContactName: r.primaryContactName,
      primaryEmail: r.primaryEmail || null,
      primaryPhone: r.primaryPhone,
      website: r.website || null,
      creditLimit: Number(r.creditLimit) || 0,
      creditDays: Number(r.creditDays) || 0,
      paymentTerms: r.paymentTerms,
      currencyCode: r.currencyCode,
      gstTreatmentType: r.gstTreatmentType,
      isActive: Boolean(r.isActive),
      remarks: r.remarks || null,
      createdDate: r.createdDate,
      updatedDate: r.updatedDate,
      addresses: Array.isArray(r.addresses) ? r.addresses : [],
    };
  }
}
