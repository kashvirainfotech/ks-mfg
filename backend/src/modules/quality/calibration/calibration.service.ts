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
  CalibrationFilterDto,
  CreateGaugeDto,
  LockoutGaugeDto,
  LogCalibrationEventDto,
  UpdateGaugeDto,
} from './calibration.dto';

@Injectable()
export class CalibrationService {
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
        COUNT(*)::INT AS total_gauges,
        COUNT(CASE WHEN current_status = 'VALID' AND next_calibration_due_date > CURRENT_DATE + INTERVAL '15 days' THEN 1 END)::INT AS valid_active,
        COUNT(CASE WHEN current_status = 'CALIBRATION_DUE' OR (current_status = 'VALID' AND next_calibration_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '15 days') THEN 1 END)::INT AS due_soon,
        COUNT(CASE WHEN current_status = 'OVERDUE' OR next_calibration_due_date < CURRENT_DATE THEN 1 END)::INT AS overdue_expired,
        COUNT(CASE WHEN current_status = 'OUT_OF_TOLERANCE_LOCKOUT' OR current_status = 'SCRAPPED' THEN 1 END)::INT AS locked_out
      FROM tbl_qc_gauge_master
      WHERE comp_id = $1 AND is_active = TRUE
        AND ($2::BIGINT IS NULL OR branch_id = $2::BIGINT);
    `;

    const res = await this.pool.query(sql, [compId, branchId]);
    const r = res.rows[0] || {};
    return {
      totalGauges: Number(r.total_gauges || 0),
      validActive: Number(r.valid_active || 0),
      dueSoon: Number(r.due_soon || 0),
      overdueExpired: Number(r.overdue_expired || 0),
      lockedOut: Number(r.locked_out || 0),
    };
  }

  // --------------------------------------------------------------------------
  // Lookups
  // --------------------------------------------------------------------------
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const usersRes = await this.pool.query(
      `SELECT user_id, user_name, full_name, role_id
       FROM tbl_sec_user
       WHERE comp_id = $1 AND is_active = TRUE
       ORDER BY full_name ASC`,
      [compId],
    );

    return {
      custodians: usersRes.rows.map((r) => ({
        userId: Number(r.user_id),
        userName: r.user_name,
        fullName: r.full_name,
      })),
      gaugeTypes: [
        { value: 'MICROMETER', label: 'Micrometer (External / Blade / Depth)' },
        { value: 'VERNIER_CALIPER', label: 'Vernier Caliper (Digital / Dial / Manual)' },
        { value: 'PRESSURE_GAUGE', label: 'Pressure Gauge (Hydraulic / Pneumatic)' },
        { value: 'TORQUE_WRENCH', label: 'Torque Wrench (Click / Digital Dial)' },
        { value: 'DIAL_INDICATOR', label: 'Dial Indicator / Plunger Gauge' },
        { value: 'HEIGHT_GAUGE', label: 'Digital Height Vernier Gauge' },
        { value: 'BORE_GAUGE', label: 'Dial Cylinder Bore Gauge' },
        { value: 'SURFACE_ROUGHNESS_TESTER', label: 'Surface Roughness Tester (Ra/Rz)' },
        { value: 'HARDNESS_TESTER', label: 'Portable Leeb Hardness Tester' },
        { value: 'TEMPERATURE_CONTROLLER', label: 'Temperature Controller / Pyrometer' },
        { value: 'CMM_PROBE', label: 'CMM Touch Probe & Stylus' },
      ],
      gaugeStatuses: [
        { value: 'VALID', label: 'Valid / In Tolerance' },
        { value: 'CALIBRATION_DUE', label: 'Calibration Due Soon (<= 15 Days)' },
        { value: 'OVERDUE', label: 'Overdue / Expired' },
        { value: 'UNDER_CALIBRATION', label: 'Under Calibration at Lab' },
        { value: 'OUT_OF_TOLERANCE_LOCKOUT', label: 'Locked Out (Out of Tolerance)' },
        { value: 'SCRAPPED', label: 'Decommissioned / Scrapped' },
      ],
      agencyTypes: [
        { value: 'NABL_EXTERNAL_LAB', label: 'NABL Accredited External Metrology Lab' },
        { value: 'INTERNAL_LAB', label: 'Internal Plant Metrology Calibration Room' },
        { value: 'OEM_MANUFACTURER', label: 'Original Equipment Manufacturer (OEM)' },
      ],
      calibrationResults: [
        { value: 'PASS', label: 'Pass (Within Permissible Tolerance)' },
        { value: 'PASS_WITH_CORRECTION', label: 'Pass with Offset Correction Factor' },
        { value: 'FAIL_OUT_OF_TOLERANCE', label: 'Fail (Out of Tolerance - Lockout)' },
      ],
    };
  }

  // --------------------------------------------------------------------------
  // List Gauges
  // --------------------------------------------------------------------------
  async findAll(filter: CalibrationFilterDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filter.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['g.comp_id = $1', 'g.is_active = TRUE'];
    const params: any[] = [compId];
    let pIdx = 2;

    if (branchId) {
      conditions.push(`g.branch_id = $${pIdx}`);
      params.push(branchId);
      pIdx++;
    }

    if (filter.status) {
      conditions.push(`g.current_status = $${pIdx}`);
      params.push(filter.status);
      pIdx++;
    }

    if (filter.gaugeType) {
      conditions.push(`g.gauge_type = $${pIdx}`);
      params.push(filter.gaugeType);
      pIdx++;
    }

    if (filter.agencyType) {
      conditions.push(`g.calibration_agency_type = $${pIdx}`);
      params.push(filter.agencyType);
      pIdx++;
    }

    if (filter.isOverdueOnly) {
      conditions.push(`(g.next_calibration_due_date < CURRENT_DATE OR g.current_status = 'OVERDUE')`);
    }

    if (filter.search) {
      conditions.push(
        `(g.gauge_code ILIKE $${pIdx} OR g.gauge_name ILIKE $${pIdx} OR g.serial_no ILIKE $${pIdx} OR g.make_manufacturer ILIKE $${pIdx} OR g.location_custody ILIKE $${pIdx})`,
      );
      params.push(`%${filter.search}%`);
      pIdx++;
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `
      SELECT COUNT(*)::INT AS total
      FROM tbl_qc_gauge_master g
      WHERE ${whereClause};
    `;
    const countRes = await this.pool.query(countSql, params);
    const total = Number(countRes.rows[0]?.total || 0);

    const dataSql = `
      SELECT
        g.gauge_id,
        g.gauge_code,
        g.gauge_name,
        g.gauge_type,
        g.make_manufacturer,
        g.model_no,
        g.serial_no,
        g.range_min,
        g.range_max,
        g.uom,
        g.least_count,
        g.max_permissible_error,
        g.location_custody,
        g.custodian_id,
        g.custodian_name,
        g.calibration_frequency_days,
        g.last_calibration_date,
        g.next_calibration_due_date,
        (g.next_calibration_due_date - CURRENT_DATE)::INT AS days_until_due,
        g.calibration_agency_type,
        g.agency_name,
        g.calibration_certificate_no,
        g.current_status,
        g.remarks,
        g.created_by,
        g.created_date,
        (SELECT COUNT(*)::INT FROM tbl_qc_gauge_calibration_history h WHERE h.gauge_id = g.gauge_id AND h.is_active = TRUE) AS calibration_event_count
      FROM tbl_qc_gauge_master g
      WHERE ${whereClause}
      ORDER BY g.next_calibration_due_date ASC, g.gauge_id DESC
      LIMIT $${pIdx} OFFSET $${pIdx + 1};
    `;
    params.push(limit, offset);

    const dataRes = await this.pool.query(dataSql, params);

    return {
      items: dataRes.rows.map((r) => this.mapGaugeRow(r)),
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

    const gaugeRes = await this.pool.query(
      `SELECT g.*, (g.next_calibration_due_date - CURRENT_DATE)::INT AS days_until_due
       FROM tbl_qc_gauge_master g
       WHERE g.gauge_id = $1 AND g.comp_id = $2 AND g.is_active = TRUE`,
      [id, compId],
    );

    if (gaugeRes.rowCount === 0) {
      throw new NotFoundException(`Gauge #${id} not found.`);
    }

    const gauge = this.mapGaugeRow(gaugeRes.rows[0]);

    // Fetch calibration history
    const historyRes = await this.pool.query(
      `SELECT history_id, gauge_id, calibration_event_no, calibration_date,
              certificate_no, calibrated_by_agency, calibrator_name,
              master_instrument_traceability, nominal_value, observed_value,
              error_val, permissible_tolerance, calibration_result,
              next_due_date, environmental_conditions, certificate_url,
              verified_by_user_id, verified_by_name, remarks, created_date
       FROM tbl_qc_gauge_calibration_history
       WHERE gauge_id = $1 AND is_active = TRUE
       ORDER BY calibration_date DESC, history_id DESC`,
      [id],
    );

    return {
      ...gauge,
      history: historyRes.rows.map((h) => ({
        historyId: Number(h.history_id),
        gaugeId: Number(h.gauge_id),
        calibrationEventNo: h.calibration_event_no,
        calibrationDate: h.calibration_date,
        certificateNo: h.certificate_no,
        calibratedByAgency: h.calibrated_by_agency,
        calibratorName: h.calibrator_name,
        masterInstrumentTraceability: h.master_instrument_traceability,
        nominalValue: Number(h.nominal_value),
        observedValue: Number(h.observed_value),
        errorVal: Number(h.error_val),
        permissibleTolerance: Number(h.permissible_tolerance),
        calibrationResult: h.calibration_result,
        nextDueDate: h.next_due_date,
        environmentalConditions: h.environmental_conditions,
        certificateUrl: h.certificate_url,
        verifiedByUserId: h.verified_by_user_id ? Number(h.verified_by_user_id) : null,
        verifiedByName: h.verified_by_name,
        remarks: h.remarks,
        createdDate: h.created_date,
      })),
    };
  }

  // --------------------------------------------------------------------------
  // Create Gauge
  // --------------------------------------------------------------------------
  async create(dto: CreateGaugeDto, user: AuthenticatedUserContext, meta?: any) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    // Custodian name
    let custodianName: string | null = null;
    if (dto.custodianId) {
      const uRes = await this.pool.query(`SELECT full_name FROM tbl_sec_user WHERE user_id = $1`, [
        dto.custodianId,
      ]);
      custodianName = uRes.rows[0]?.full_name || null;
    }

    // Gauge code
    let gaugeCode = dto.gaugeCode?.trim();
    if (!gaugeCode) {
      const prefixMap: Record<string, string> = {
        MICROMETER: 'MIC',
        VERNIER_CALIPER: 'VER',
        PRESSURE_GAUGE: 'PRS',
        TORQUE_WRENCH: 'TRQ',
        DIAL_INDICATOR: 'DIA',
        HEIGHT_GAUGE: 'HGT',
        BORE_GAUGE: 'BOR',
        SURFACE_ROUGHNESS_TESTER: 'SRF',
        HARDNESS_TESTER: 'HRD',
        TEMPERATURE_CONTROLLER: 'TMP',
        CMM_PROBE: 'CMM',
      };
      const pfx = prefixMap[dto.gaugeType] || 'GAG';
      const countRes = await this.pool.query(
        `SELECT COUNT(*)::INT AS seq FROM tbl_qc_gauge_master WHERE comp_id = $1`,
        [compId],
      );
      const nextSeq = Number(countRes.rows[0]?.seq || 0) + 1;
      gaugeCode = `GAG-${pfx}-${String(nextSeq).padStart(3, '0')}`;
    }

    // Compute next due date
    const freq = Number(dto.calibrationFrequencyDays) || 180;
    const lastDate = new Date(dto.lastCalibrationDate);
    const dueDate = new Date(lastDate);
    dueDate.setDate(dueDate.getDate() + freq);
    const nextDueDateStr = dueDate.toISOString().slice(0, 10);

    // Initial status
    const today = new Date();
    let currentStatus = 'VALID';
    if (dueDate < today) {
      currentStatus = 'OVERDUE';
    } else {
      const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 15) {
        currentStatus = 'CALIBRATION_DUE';
      }
    }

    const insertSql = `
      INSERT INTO tbl_qc_gauge_master (
        gauge_code, gauge_name, gauge_type, make_manufacturer, model_no, serial_no,
        range_min, range_max, uom, least_count, max_permissible_error,
        location_custody, custodian_id, custodian_name, calibration_frequency_days,
        last_calibration_date, next_calibration_due_date, calibration_agency_type,
        agency_name, calibration_certificate_no, current_status, remarks,
        comp_id, branch_id, fyear_id, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18,
        $19, $20, $21, $22,
        $23, $24, 1001, $25
      )
      RETURNING gauge_id;
    `;

    const insertRes = await this.pool.query(insertSql, [
      gaugeCode,
      dto.gaugeName,
      dto.gaugeType,
      dto.makeManufacturer,
      dto.modelNo || null,
      dto.serialNo,
      dto.rangeMin,
      dto.rangeMax,
      dto.uom,
      dto.leastCount,
      dto.maxPermissibleError,
      dto.locationCustody,
      dto.custodianId || null,
      custodianName,
      freq,
      dto.lastCalibrationDate,
      nextDueDateStr,
      dto.calibrationAgencyType || 'NABL_EXTERNAL_LAB',
      dto.agencyName || 'Central Metrology & Calibration Standards Lab',
      dto.calibrationCertificateNo || 'CERT-INITIAL-CAL',
      currentStatus,
      dto.remarks || null,
      compId,
      branchId,
      userId,
    ]);

    const gaugeId = Number(insertRes.rows[0].gauge_id);

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'CALIBRATION_QC',
      actionType: 'ADD',
      entityTable: 'tbl_qc_gauge_master',
      recordId: gaugeId,
      newValue: { gaugeId, gaugeCode, ...dto },
      compId,
      branchId,
      fyearId: user.fyearId || null,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    return this.findById(gaugeId, user);
  }

  // --------------------------------------------------------------------------
  // Update Gauge
  // --------------------------------------------------------------------------
  async update(id: number, dto: UpdateGaugeDto, user: AuthenticatedUserContext, meta?: any) {
    const existing = await this.findById(id, user);
    const userId = user.userId || 1001;
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    let custodianName = existing.custodianName;
    if (dto.custodianId && dto.custodianId !== existing.custodianId) {
      const uRes = await this.pool.query(`SELECT full_name FROM tbl_sec_user WHERE user_id = $1`, [
        dto.custodianId,
      ]);
      custodianName = uRes.rows[0]?.full_name || null;
    }

    const updateSql = `
      UPDATE tbl_qc_gauge_master
      SET
        gauge_name = COALESCE($1, gauge_name),
        gauge_type = COALESCE($2, gauge_type),
        make_manufacturer = COALESCE($3, make_manufacturer),
        model_no = COALESCE($4, model_no),
        serial_no = COALESCE($5, serial_no),
        range_min = COALESCE($6, range_min),
        range_max = COALESCE($7, range_max),
        uom = COALESCE($8, uom),
        least_count = COALESCE($9, least_count),
        max_permissible_error = COALESCE($10, max_permissible_error),
        location_custody = COALESCE($11, location_custody),
        custodian_id = COALESCE($12, custodian_id),
        custodian_name = COALESCE($13, custodian_name),
        calibration_frequency_days = COALESCE($14, calibration_frequency_days),
        calibration_agency_type = COALESCE($15, calibration_agency_type),
        agency_name = COALESCE($16, agency_name),
        current_status = COALESCE($17, current_status),
        remarks = COALESCE($18, remarks),
        updated_by = $19,
        updated_date = CURRENT_TIMESTAMP
      WHERE gauge_id = $20;
    `;

    await this.pool.query(updateSql, [
      dto.gaugeName || null,
      dto.gaugeType || null,
      dto.makeManufacturer || null,
      dto.modelNo || null,
      dto.serialNo || null,
      dto.rangeMin ?? null,
      dto.rangeMax ?? null,
      dto.uom || null,
      dto.leastCount ?? null,
      dto.maxPermissibleError ?? null,
      dto.locationCustody || null,
      dto.custodianId || null,
      custodianName,
      dto.calibrationFrequencyDays ?? null,
      dto.calibrationAgencyType || null,
      dto.agencyName || null,
      dto.currentStatus || null,
      dto.remarks || null,
      userId,
      id,
    ]);

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'CALIBRATION_QC',
      actionType: 'EDIT',
      entityTable: 'tbl_qc_gauge_master',
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
  // Log Calibration Verification Event
  // --------------------------------------------------------------------------
  async logEvent(id: number, dto: LogCalibrationEventDto, user: AuthenticatedUserContext, meta?: any) {
    const gauge = await this.findById(id, user);
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;
    const verifierName = user.username || 'Metrologist';

    // Generate event number
    const countRes = await this.pool.query(
      `SELECT COUNT(*)::INT AS seq FROM tbl_qc_gauge_calibration_history WHERE comp_id = $1`,
      [compId],
    );
    const nextSeq = Number(countRes.rows[0]?.seq || 0) + 1;
    const eventNo = `EVT-CAL-2026-${String(nextSeq).padStart(3, '0')}`;

    // Calculate next due date
    let nextDueDateStr = dto.nextDueDate;
    if (!nextDueDateStr) {
      const calDate = new Date(dto.calibrationDate);
      const nextDue = new Date(calDate);
      nextDue.setDate(nextDue.getDate() + gauge.calibrationFrequencyDays);
      nextDueDateStr = nextDue.toISOString().slice(0, 10);
    }

    // Insert history record
    const insertHistorySql = `
      INSERT INTO tbl_qc_gauge_calibration_history (
        gauge_id, calibration_event_no, calibration_date, certificate_no,
        calibrated_by_agency, calibrator_name, master_instrument_traceability,
        nominal_value, observed_value, error_val, permissible_tolerance,
        calibration_result, next_due_date, environmental_conditions, certificate_url,
        verified_by_user_id, verified_by_name, remarks,
        comp_id, branch_id, fyear_id, created_by
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18,
        $19, $20, 1001, $21
      )
      RETURNING history_id;
    `;

    await this.pool.query(insertHistorySql, [
      id,
      eventNo,
      dto.calibrationDate,
      dto.certificateNo,
      dto.calibratedByAgency,
      dto.calibratorName,
      dto.masterInstrumentTraceability || 'Grade-0 Ceramic Gauge Block Set (NPL Traceable)',
      dto.nominalValue,
      dto.observedValue,
      dto.errorVal,
      dto.permissibleTolerance,
      dto.calibrationResult,
      nextDueDateStr,
      dto.environmentalConditions || 'Temp: 20.0 ± 0.5 °C, Humidity: 50 ± 5% RH',
      dto.certificateUrl || null,
      userId,
      verifierName,
      dto.remarks || null,
      compId,
      branchId,
      userId,
    ]);

    // Update parent gauge master
    const nextStatus =
      dto.calibrationResult === 'FAIL_OUT_OF_TOLERANCE'
        ? 'OUT_OF_TOLERANCE_LOCKOUT'
        : 'VALID';

    const updateMasterSql = `
      UPDATE tbl_qc_gauge_master
      SET
        last_calibration_date = $1,
        next_calibration_due_date = $2,
        current_status = $3,
        calibration_certificate_no = $4,
        agency_name = $5,
        updated_by = $6,
        updated_date = CURRENT_TIMESTAMP
      WHERE gauge_id = $7;
    `;

    await this.pool.query(updateMasterSql, [
      dto.calibrationDate,
      nextDueDateStr,
      nextStatus,
      dto.certificateNo,
      dto.calibratedByAgency,
      userId,
      id,
    ]);

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'CALIBRATION_QC',
      actionType: 'CALIBRATE',
      entityTable: 'tbl_qc_gauge_master',
      recordId: id,
      oldValue: { lastCalibrationDate: gauge.lastCalibrationDate, currentStatus: gauge.currentStatus },
      newValue: { eventNo, ...dto, nextStatus, nextDueDateStr },
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
  // Lockout / Quarantine Gauge
  // --------------------------------------------------------------------------
  async lockout(id: number, dto: LockoutGaugeDto, user: AuthenticatedUserContext, meta?: any) {
    const gauge = await this.findById(id, user);
    const userId = user.userId || 1001;
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const newStatus = dto.newStatus || 'OUT_OF_TOLERANCE_LOCKOUT';

    const appendedRemarks = gauge.remarks
      ? `${gauge.remarks} | Lockout: ${dto.lockoutReason}`
      : `Lockout: ${dto.lockoutReason}`;

    await this.pool.query(
      `UPDATE tbl_qc_gauge_master
       SET current_status = $1,
           remarks = $2,
           updated_by = $3,
           updated_date = CURRENT_TIMESTAMP
       WHERE gauge_id = $4`,
      [newStatus, appendedRemarks, userId, id],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'CALIBRATION_QC',
      actionType: 'LOCKOUT',
      entityTable: 'tbl_qc_gauge_master',
      recordId: id,
      oldValue: { currentStatus: gauge.currentStatus },
      newValue: { newStatus, lockoutReason: dto.lockoutReason },
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
  // Delete Gauge
  // --------------------------------------------------------------------------
  async delete(id: number, user: AuthenticatedUserContext, meta?: any) {
    const existing = await this.findById(id, user);
    const userId = user.userId || 1001;
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    await this.pool.query(
      `UPDATE tbl_qc_gauge_master SET is_active = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP WHERE gauge_id = $2`,
      [userId, id],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'CALIBRATION_QC',
      actionType: 'DELETE',
      entityTable: 'tbl_qc_gauge_master',
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

    return { success: true, message: `Gauge #${existing.gaugeCode} deleted successfully.` };
  }

  // --------------------------------------------------------------------------
  // Row Mapper
  // --------------------------------------------------------------------------
  private mapGaugeRow(r: any) {
    return {
      gaugeId: Number(r.gauge_id),
      gaugeCode: r.gauge_code,
      gaugeName: r.gauge_name,
      gaugeType: r.gauge_type,
      makeManufacturer: r.make_manufacturer,
      modelNo: r.model_no,
      serialNo: r.serial_no,
      rangeMin: Number(r.range_min || 0),
      rangeMax: Number(r.range_max || 0),
      uom: r.uom,
      leastCount: Number(r.least_count || 0),
      maxPermissibleError: Number(r.max_permissible_error || 0),
      locationCustody: r.location_custody,
      custodianId: r.custodian_id ? Number(r.custodian_id) : null,
      custodianName: r.custodian_name,
      calibrationFrequencyDays: Number(r.calibration_frequency_days || 180),
      lastCalibrationDate: r.last_calibration_date,
      nextCalibrationDueDate: r.next_calibration_due_date,
      daysUntilDue: r.days_until_due !== undefined ? Number(r.days_until_due) : null,
      calibrationAgencyType: r.calibration_agency_type,
      agencyName: r.agency_name,
      calibrationCertificateNo: r.calibration_certificate_no,
      currentStatus: r.current_status,
      remarks: r.remarks,
      createdBy: Number(r.created_by),
      createdDate: r.created_date,
      calibrationEventCount:
        r.calibration_event_count !== undefined ? Number(r.calibration_event_count) : 0,
    };
  }
}
