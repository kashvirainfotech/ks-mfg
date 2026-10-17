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
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import {
  CreateDocNumberSeriesDto,
  CreateSystemConfigDto,
  UpdateDocNumberSeriesDto,
  UpdateSystemConfigDto,
} from './system-config.dto';

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

@Injectable()
export class SystemConfigService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
  ) {}

  public formatVoucherNumber(params: {
    prefixTemplate: string;
    suffixTemplate?: string | null;
    separatorChar: string;
    paddingDigits: number;
    sequenceNo: number;
  }): string {
    const sep = params.separatorChar ?? '/';
    const prefix = (params.prefixTemplate || '').trim();
    const suffix = (params.suffixTemplate || '').trim();
    const digits = Math.max(1, Math.min(10, Number(params.paddingDigits) || 4));
    const paddedSeq = String(Math.max(1, Number(params.sequenceNo) || 1)).padStart(
      digits,
      '0',
    );

    const parts = [prefix];
    if (suffix) {
      parts.push(suffix);
    }
    parts.push(paddedSeq);

    return parts
      .filter(Boolean)
      .map((part, idx) =>
        idx === 0 ? part.replace(new RegExp(`\\${sep}+$`), '') : part.replace(new RegExp(`^\\${sep}+|\\${sep}+$`, 'g'), ''),
      )
      .join(sep);
  }

  private validateConfigPayload(dto: {
    dataType: string;
    configValue: string;
    defaultValue: string;
    allowedValues?: string | null;
    scopeLevel: string;
    targetCompId?: number | null;
    targetBranchId?: number | null;
  }) {
    const dataType = (dto.dataType || 'STRING').toUpperCase();
    const value = String(dto.configValue ?? '').trim();
    const defVal = String(dto.defaultValue ?? '').trim();

    if (!value) {
      throw new BadRequestException('Configuration value cannot be empty.');
    }

    if (dataType === 'BOOLEAN') {
      const upperVal = value.toUpperCase();
      const upperDef = defVal.toUpperCase();
      if (upperVal !== 'TRUE' && upperVal !== 'FALSE') {
        throw new BadRequestException(
          'BOOLEAN configuration value must be either "TRUE" or "FALSE".',
        );
      }
      if (upperDef !== 'TRUE' && upperDef !== 'FALSE') {
        throw new BadRequestException(
          'BOOLEAN default value must be either "TRUE" or "FALSE".',
        );
      }
    } else if (dataType === 'NUMBER') {
      if (Number.isNaN(Number(value)) || Number.isNaN(Number(defVal))) {
        throw new BadRequestException(
          'NUMBER configuration value and default value must be valid numeric values.',
        );
      }
    } else if (dataType === 'ENUM') {
      const allowed = (dto.allowedValues || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (allowed.length === 0) {
        throw new BadRequestException(
          'ENUM configuration requires comma-separated allowedValues.',
        );
      }
      if (!allowed.includes(value)) {
        throw new BadRequestException(
          `Configuration value "${value}" is not in allowed ENUM options (${allowed.join(', ')}).`,
        );
      }
    } else if (dataType === 'JSON') {
      try {
        JSON.parse(value);
      } catch {
        throw new BadRequestException(
          'JSON configuration value must be valid JSON syntax.',
        );
      }
    }

    const scope = (dto.scopeLevel || 'GLOBAL').toUpperCase();
    if (scope === 'COMPANY' && !dto.targetCompId) {
      throw new BadRequestException(
        'targetCompId is required when scopeLevel is "COMPANY".',
      );
    }
    if (scope === 'BRANCH' && (!dto.targetCompId || !dto.targetBranchId)) {
      throw new BadRequestException(
        'Both targetCompId and targetBranchId are required when scopeLevel is "BRANCH".',
      );
    }
  }

  // ==========================================================================
  // TAB 1: SYSTEM CONFIGURATION MATRIX (tbl_sys_config)
  // ==========================================================================

  async findAllConfigs(filters?: {
    configGroup?: string;
    scopeLevel?: string;
    targetCompId?: number;
    targetBranchId?: number;
  }) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.configGroup) {
      params.push(filters.configGroup);
      conditions.push(`cfg.config_group = $${params.length}`);
    }
    if (filters?.scopeLevel) {
      params.push(filters.scopeLevel);
      conditions.push(`cfg.scope_level = $${params.length}`);
    }
    if (filters?.targetCompId) {
      params.push(Number(filters.targetCompId));
      conditions.push(
        `(cfg.target_comp_id = $${params.length} OR cfg.scope_level = 'GLOBAL')`,
      );
    }
    if (filters?.targetBranchId) {
      params.push(Number(filters.targetBranchId));
      conditions.push(
        `(cfg.target_branch_id = $${params.length} OR cfg.scope_level IN ('GLOBAL', 'COMPANY'))`,
      );
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `
      SELECT
        cfg.config_id         AS "configId",
        cfg.config_key        AS "configKey",
        cfg.config_name       AS "configName",
        cfg.config_group      AS "configGroup",
        cfg.data_type         AS "dataType",
        cfg.config_value      AS "configValue",
        cfg.default_value     AS "defaultValue",
        cfg.allowed_values    AS "allowedValues",
        cfg.scope_level       AS "scopeLevel",
        cfg.target_comp_id    AS "targetCompId",
        c.comp_code           AS "targetCompCode",
        c.comp_name           AS "targetCompName",
        cfg.target_branch_id  AS "targetBranchId",
        b.branch_code         AS "targetBranchCode",
        b.branch_name         AS "targetBranchName",
        cfg.description       AS "description",
        cfg.is_system_locked  AS "isSystemLocked",
        cfg.is_active         AS "isActive",
        cfg.created_date      AS "createdDate",
        cfg.updated_date      AS "updatedDate"
      FROM tbl_sys_config cfg
      LEFT JOIN tbl_org_company c ON c.comp_id = cfg.target_comp_id
      LEFT JOIN tbl_org_branch b ON b.branch_id = cfg.target_branch_id
      ${whereSql}
      ORDER BY
        cfg.config_group ASC,
        cfg.config_key ASC,
        CASE cfg.scope_level
          WHEN 'GLOBAL' THEN 1
          WHEN 'COMPANY' THEN 2
          WHEN 'BRANCH' THEN 3
          ELSE 4
        END ASC
      `,
      params,
    );

    return rows.map((r) => ({
      configId: Number(r.configId),
      configKey: r.configKey,
      configName: r.configName,
      configGroup: r.configGroup,
      dataType: r.dataType,
      configValue: r.configValue,
      defaultValue: r.defaultValue,
      allowedValues: r.allowedValues || null,
      scopeLevel: r.scopeLevel,
      targetCompId: r.targetCompId ? Number(r.targetCompId) : null,
      targetCompCode: r.targetCompCode || null,
      targetCompName: r.targetCompName || null,
      targetBranchId: r.targetBranchId ? Number(r.targetBranchId) : null,
      targetBranchCode: r.targetBranchCode || null,
      targetBranchName: r.targetBranchName || null,
      description: r.description || null,
      isSystemLocked: Boolean(r.isSystemLocked),
      isActive: Boolean(r.isActive),
      isModifiedFromDefault: String(r.configValue) !== String(r.defaultValue),
      createdDate: r.createdDate,
      updatedDate: r.updatedDate,
    }));
  }

  async findConfigById(configId: number) {
    const all = await this.findAllConfigs();
    const found = all.find((c) => c.configId === configId);
    if (!found) {
      throw new NotFoundException(
        `System configuration #${configId} was not found.`,
      );
    }
    return found;
  }

  async createConfig(
    dto: CreateSystemConfigDto,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const configKey = (dto.configKey || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_');
    const configName = (dto.configName || '').trim();

    if (!configKey || !configName) {
      throw new BadRequestException(
        'Both configKey and configName are required.',
      );
    }

    const scopeLevel = (dto.scopeLevel || 'GLOBAL').toUpperCase() as
      | 'GLOBAL'
      | 'COMPANY'
      | 'BRANCH';
    const targetCompId =
      scopeLevel === 'GLOBAL' ? null : Number(dto.targetCompId) || null;
    const targetBranchId =
      scopeLevel === 'BRANCH' ? Number(dto.targetBranchId) || null : null;

    this.validateConfigPayload({
      dataType: dto.dataType,
      configValue: dto.configValue,
      defaultValue: dto.defaultValue,
      allowedValues: dto.allowedValues,
      scopeLevel,
      targetCompId,
      targetBranchId,
    });

    const dupCheck = await this.pool.query(
      `
      SELECT config_id
      FROM tbl_sys_config
      WHERE config_key = $1
        AND scope_level = $2
        AND COALESCE(target_comp_id, 0) = COALESCE($3::bigint, 0)
        AND COALESCE(target_branch_id, 0) = COALESCE($4::bigint, 0)
      LIMIT 1
      `,
      [configKey, scopeLevel, targetCompId, targetBranchId],
    );

    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `A configuration rule for key "${configKey}" already exists at the ${scopeLevel} scope for this target Company/Plant.`,
      );
    }

    const normalizedVal =
      dto.dataType === 'BOOLEAN'
        ? dto.configValue.trim().toUpperCase()
        : dto.configValue.trim();
    const normalizedDef =
      dto.dataType === 'BOOLEAN'
        ? dto.defaultValue.trim().toUpperCase()
        : dto.defaultValue.trim();

    const { rows } = await this.pool.query(
      `
      INSERT INTO tbl_sys_config (
        config_key, config_name, config_group, data_type,
        config_value, default_value, allowed_values, scope_level,
        target_comp_id, target_branch_id, description, is_system_locked, is_active,
        comp_id, branch_id, fyear_id, created_by
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17
      )
      RETURNING config_id AS "configId"
      `,
      [
        configKey,
        configName,
        dto.configGroup || 'INVENTORY_VALUATION',
        dto.dataType || 'STRING',
        normalizedVal,
        normalizedDef,
        dto.allowedValues?.trim() || null,
        scopeLevel,
        targetCompId,
        targetBranchId,
        dto.description?.trim() || null,
        dto.isSystemLocked ?? false,
        dto.isActive ?? true,
        targetCompId || user.compId,
        targetBranchId || user.branchId,
        user.fyearId,
        user.userId,
      ],
    );

    const created = await this.findConfigById(Number(rows[0].configId));

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'CONFIG_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_sys_config',
      recordId: created.configId,
      oldValue: null,
      newValue: created as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return created;
  }

  async updateConfig(
    configId: number,
    dto: UpdateSystemConfigDto,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const existing = await this.findConfigById(configId);

    const nextDataType = existing.isSystemLocked
      ? existing.dataType
      : ((dto.dataType || existing.dataType) as string);
    const nextConfigKey = existing.isSystemLocked
      ? existing.configKey
      : (dto.configKey || existing.configKey)
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_]/g, '_');
    const nextScopeLevel = existing.isSystemLocked
      ? existing.scopeLevel
      : (dto.scopeLevel || existing.scopeLevel).toUpperCase();

    const nextTargetCompId =
      nextScopeLevel === 'GLOBAL'
        ? null
        : dto.targetCompId !== undefined
          ? dto.targetCompId
          : existing.targetCompId;
    const nextTargetBranchId =
      nextScopeLevel === 'BRANCH'
        ? dto.targetBranchId !== undefined
          ? dto.targetBranchId
          : existing.targetBranchId
        : null;

    const rawNextVal =
      dto.configValue !== undefined ? dto.configValue : existing.configValue;
    const rawNextDef =
      dto.defaultValue !== undefined ? dto.defaultValue : existing.defaultValue;
    const nextAllowedValues =
      dto.allowedValues !== undefined
        ? dto.allowedValues
        : existing.allowedValues;

    this.validateConfigPayload({
      dataType: nextDataType,
      configValue: rawNextVal,
      defaultValue: rawNextDef,
      allowedValues: nextAllowedValues,
      scopeLevel: nextScopeLevel,
      targetCompId: nextTargetCompId,
      targetBranchId: nextTargetBranchId,
    });

    const dupCheck = await this.pool.query(
      `
      SELECT config_id
      FROM tbl_sys_config
      WHERE config_key = $1
        AND scope_level = $2
        AND COALESCE(target_comp_id, 0) = COALESCE($3::bigint, 0)
        AND COALESCE(target_branch_id, 0) = COALESCE($4::bigint, 0)
        AND config_id <> $5
      LIMIT 1
      `,
      [
        nextConfigKey,
        nextScopeLevel,
        nextTargetCompId,
        nextTargetBranchId,
        configId,
      ],
    );

    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Another configuration rule for key "${nextConfigKey}" already exists at the ${nextScopeLevel} scope for this target Company/Plant.`,
      );
    }

    const normalizedVal =
      nextDataType === 'BOOLEAN'
        ? rawNextVal.trim().toUpperCase()
        : rawNextVal.trim();
    const normalizedDef =
      nextDataType === 'BOOLEAN'
        ? rawNextDef.trim().toUpperCase()
        : rawNextDef.trim();

    await this.pool.query(
      `
      UPDATE tbl_sys_config
      SET
        config_key       = $1,
        config_name      = $2,
        config_group     = $3,
        data_type        = $4,
        config_value     = $5,
        default_value    = $6,
        allowed_values   = $7,
        scope_level      = $8,
        target_comp_id   = $9,
        target_branch_id = $10,
        description      = $11,
        is_active        = $12,
        updated_by       = $13,
        updated_date     = CURRENT_TIMESTAMP
      WHERE config_id = $14
      `,
      [
        nextConfigKey,
        (dto.configName ?? existing.configName).trim(),
        dto.configGroup ?? existing.configGroup,
        nextDataType,
        normalizedVal,
        normalizedDef,
        nextAllowedValues?.trim() || null,
        nextScopeLevel,
        nextTargetCompId,
        nextTargetBranchId,
        dto.description !== undefined
          ? dto.description?.trim() || null
          : existing.description,
        dto.isActive !== undefined ? dto.isActive : existing.isActive,
        user.userId,
        configId,
      ],
    );

    const updated = await this.findConfigById(configId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'CONFIG_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_sys_config',
      recordId: configId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return updated;
  }

  async resetConfigToDefault(
    configId: number,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const existing = await this.findConfigById(configId);

    await this.pool.query(
      `
      UPDATE tbl_sys_config
      SET
        config_value = default_value,
        updated_by   = $1,
        updated_date = CURRENT_TIMESTAMP
      WHERE config_id = $2
      `,
      [user.userId, configId],
    );

    const updated = await this.findConfigById(configId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'CONFIG_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_sys_config',
      recordId: configId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return updated;
  }

  async deleteConfig(
    configId: number,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const existing = await this.findConfigById(configId);

    if (existing.isSystemLocked) {
      throw new BadRequestException(
        `Core system parameter "${existing.configKey}" is locked and cannot be deleted. You can edit its value or create Company/Plant overrides.`,
      );
    }

    await this.pool.query(`DELETE FROM tbl_sys_config WHERE config_id = $1`, [
      configId,
    ]);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'CONFIG_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_sys_config',
      recordId: configId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: null,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return { deleted: true, configId };
  }

  // ==========================================================================
  // TAB 2: DOCUMENT NUMBERING SERIES ENGINE (tbl_sys_doc_number_series)
  // ==========================================================================

  async findAllDocSeries(filters?: {
    moduleName?: string;
    docTypeCode?: string;
    targetCompId?: number;
    targetBranchId?: number;
    targetFyearId?: number;
  }) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.moduleName) {
      params.push(filters.moduleName);
      conditions.push(`s.module_name = $${params.length}`);
    }
    if (filters?.docTypeCode) {
      params.push(filters.docTypeCode);
      conditions.push(`s.doc_type_code = $${params.length}`);
    }
    if (filters?.targetCompId) {
      params.push(Number(filters.targetCompId));
      conditions.push(`s.target_comp_id = $${params.length}`);
    }
    if (filters?.targetBranchId) {
      params.push(Number(filters.targetBranchId));
      conditions.push(`s.target_branch_id = $${params.length}`);
    }
    if (filters?.targetFyearId) {
      params.push(Number(filters.targetFyearId));
      conditions.push(`s.target_fyear_id = $${params.length}`);
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `
      SELECT
        s.series_id             AS "seriesId",
        s.series_code           AS "seriesCode",
        s.series_name           AS "seriesName",
        s.doc_type_code         AS "docTypeCode",
        s.doc_type_name         AS "docTypeName",
        s.module_name           AS "moduleName",
        s.target_comp_id        AS "targetCompId",
        c.comp_code             AS "targetCompCode",
        c.comp_name             AS "targetCompName",
        s.target_branch_id      AS "targetBranchId",
        b.branch_code           AS "targetBranchCode",
        b.branch_name           AS "targetBranchName",
        s.target_fyear_id       AS "targetFyearId",
        fy.fyear_code           AS "targetFyearCode",
        fy.fyear_name           AS "targetFyearName",
        s.prefix_template       AS "prefixTemplate",
        s.suffix_template       AS "suffixTemplate",
        s.separator_char        AS "separatorChar",
        s.padding_digits        AS "paddingDigits",
        s.starting_no           AS "startingNo",
        s.current_next_no       AS "currentNextNo",
        s.reset_frequency       AS "resetFrequency",
        s.allow_manual_override AS "allowManualOverride",
        s.is_default            AS "isDefault",
        s.is_active             AS "isActive",
        s.created_date          AS "createdDate",
        s.updated_date          AS "updatedDate"
      FROM tbl_sys_doc_number_series s
      INNER JOIN tbl_org_company c ON c.comp_id = s.target_comp_id
      INNER JOIN tbl_org_branch b ON b.branch_id = s.target_branch_id
      INNER JOIN tbl_org_financial_year fy ON fy.fyear_id = s.target_fyear_id
      ${whereSql}
      ORDER BY
        s.target_comp_id ASC,
        s.target_branch_id ASC,
        s.module_name ASC,
        s.doc_type_code ASC,
        s.is_default DESC,
        s.series_code ASC
      `,
      params,
    );

    return rows.map((r) => {
      const paddingDigits = Number(r.paddingDigits) || 4;
      const startingNo = Number(r.startingNo) || 1;
      const currentNextNo = Number(r.currentNextNo) || 1;
      const issuedDocumentsCount = Math.max(0, currentNextNo - startingNo);

      return {
        seriesId: Number(r.seriesId),
        seriesCode: r.seriesCode,
        seriesName: r.seriesName,
        docTypeCode: r.docTypeCode,
        docTypeName: r.docTypeName,
        moduleName: r.moduleName,
        targetCompId: Number(r.targetCompId),
        targetCompCode: r.targetCompCode,
        targetCompName: r.targetCompName,
        targetBranchId: Number(r.targetBranchId),
        targetBranchCode: r.targetBranchCode,
        targetBranchName: r.targetBranchName,
        targetFyearId: Number(r.targetFyearId),
        targetFyearCode: r.targetFyearCode,
        targetFyearName: r.targetFyearName,
        prefixTemplate: r.prefixTemplate,
        suffixTemplate: r.suffixTemplate || null,
        separatorChar: r.separatorChar || '/',
        paddingDigits,
        startingNo,
        currentNextNo,
        issuedDocumentsCount,
        resetFrequency: r.resetFrequency,
        allowManualOverride: Boolean(r.allowManualOverride),
        isDefault: Boolean(r.isDefault),
        isActive: Boolean(r.isActive),
        firstFormattedVoucherNo: this.formatVoucherNumber({
          prefixTemplate: r.prefixTemplate,
          suffixTemplate: r.suffixTemplate,
          separatorChar: r.separatorChar || '/',
          paddingDigits,
          sequenceNo: startingNo,
        }),
        nextFormattedVoucherNo: this.formatVoucherNumber({
          prefixTemplate: r.prefixTemplate,
          suffixTemplate: r.suffixTemplate,
          separatorChar: r.separatorChar || '/',
          paddingDigits,
          sequenceNo: currentNextNo,
        }),
        createdDate: r.createdDate,
        updatedDate: r.updatedDate,
      };
    });
  }

  async findDocSeriesById(seriesId: number) {
    const all = await this.findAllDocSeries();
    const found = all.find((s) => s.seriesId === seriesId);
    if (!found) {
      throw new NotFoundException(
        `Document Numbering Series #${seriesId} was not found.`,
      );
    }
    return found;
  }

  async previewDocSeriesSequence(seriesId: number) {
    const series = await this.findDocSeriesById(seriesId);
    const nextFiveSamples = Array.from({ length: 5 }, (_, idx) => {
      const seqNo = series.currentNextNo + idx;
      return {
        step: idx + 1,
        sequenceNo: seqNo,
        formattedVoucherNo: this.formatVoucherNumber({
          prefixTemplate: series.prefixTemplate,
          suffixTemplate: series.suffixTemplate,
          separatorChar: series.separatorChar,
          paddingDigits: series.paddingDigits,
          sequenceNo: seqNo,
        }),
      };
    });

    return {
      series,
      nextFiveSamples,
    };
  }

  async createDocSeries(
    dto: CreateDocNumberSeriesDto,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const seriesCode = (dto.seriesCode || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '-');
    const seriesName = (dto.seriesName || '').trim();
    const prefixTemplate = (dto.prefixTemplate || '').trim().toUpperCase();

    if (!seriesCode || !seriesName || !prefixTemplate) {
      throw new BadRequestException(
        'seriesCode, seriesName, and prefixTemplate are required.',
      );
    }

    const paddingDigits = Math.max(
      2,
      Math.min(10, Number(dto.paddingDigits) || 4),
    );
    const startingNo = Math.max(1, Number(dto.startingNo) || 1);
    const currentNextNo = Math.max(
      startingNo,
      Number(dto.currentNextNo) || startingNo,
    );

    const dupCheck = await this.pool.query(
      `
      SELECT series_id
      FROM tbl_sys_doc_number_series
      WHERE target_comp_id = $1
        AND target_branch_id = $2
        AND target_fyear_id = $3
        AND series_code = $4
      LIMIT 1
      `,
      [dto.targetCompId, dto.targetBranchId, dto.targetFyearId, seriesCode],
    );

    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Document series code "${seriesCode}" already exists for the selected Company, Plant, and Financial Year.`,
      );
    }

    const client = await this.pool.connect();
    let createdSeriesId = 0;

    try {
      await client.query('BEGIN');

      if (dto.isDefault) {
        await client.query(
          `
          UPDATE tbl_sys_doc_number_series
          SET is_default = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP
          WHERE target_comp_id = $2
            AND target_branch_id = $3
            AND target_fyear_id = $4
            AND doc_type_code = $5
          `,
          [
            user.userId,
            dto.targetCompId,
            dto.targetBranchId,
            dto.targetFyearId,
            dto.docTypeCode,
          ],
        );
      }

      const { rows } = await client.query(
        `
        INSERT INTO tbl_sys_doc_number_series (
          series_code, series_name, doc_type_code, doc_type_name, module_name,
          target_comp_id, target_branch_id, target_fyear_id,
          prefix_template, suffix_template, separator_char, padding_digits,
          starting_no, current_next_no, reset_frequency, allow_manual_override,
          is_default, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18,
          $19, $20, $21, $22
        )
        RETURNING series_id AS "seriesId"
        `,
        [
          seriesCode,
          seriesName,
          dto.docTypeCode,
          dto.docTypeName,
          dto.moduleName || 'PROCUREMENT',
          dto.targetCompId,
          dto.targetBranchId,
          dto.targetFyearId,
          prefixTemplate,
          dto.suffixTemplate?.trim() || null,
          dto.separatorChar || '/',
          paddingDigits,
          startingNo,
          currentNextNo,
          dto.resetFrequency || 'FYEAR',
          dto.allowManualOverride ?? false,
          dto.isDefault ?? true,
          dto.isActive ?? true,
          dto.targetCompId,
          dto.targetBranchId,
          dto.targetFyearId,
          user.userId,
        ],
      );

      createdSeriesId = Number(rows[0].seriesId);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const created = await this.findDocSeriesById(createdSeriesId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'CONFIG_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_sys_doc_number_series',
      recordId: created.seriesId,
      oldValue: null,
      newValue: created as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return created;
  }

  async updateDocSeries(
    seriesId: number,
    dto: UpdateDocNumberSeriesDto,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const existing = await this.findDocSeriesById(seriesId);

    const nextSeriesCode = (dto.seriesCode ?? existing.seriesCode)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '-');
    const nextCompId = dto.targetCompId ?? existing.targetCompId;
    const nextBranchId = dto.targetBranchId ?? existing.targetBranchId;
    const nextFyearId = dto.targetFyearId ?? existing.targetFyearId;
    const nextDocTypeCode = dto.docTypeCode ?? existing.docTypeCode;
    const nextPaddingDigits = Math.max(
      2,
      Math.min(10, Number(dto.paddingDigits ?? existing.paddingDigits) || 4),
    );
    const nextStartingNo = Math.max(
      1,
      Number(dto.startingNo ?? existing.startingNo) || 1,
    );
    const nextCurrentNo = Math.max(
      nextStartingNo,
      Number(dto.currentNextNo ?? existing.currentNextNo) || nextStartingNo,
    );

    if (nextCurrentNo < existing.currentNextNo) {
      throw new BadRequestException(
        `Cannot roll back currentNextNo (${nextCurrentNo}) below already issued counter (${existing.currentNextNo}) to prevent duplicate voucher numbers.`,
      );
    }

    const dupCheck = await this.pool.query(
      `
      SELECT series_id
      FROM tbl_sys_doc_number_series
      WHERE target_comp_id = $1
        AND target_branch_id = $2
        AND target_fyear_id = $3
        AND series_code = $4
        AND series_id <> $5
      LIMIT 1
      `,
      [nextCompId, nextBranchId, nextFyearId, nextSeriesCode, seriesId],
    );

    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Another document series with code "${nextSeriesCode}" already exists for the selected Company, Plant, and Financial Year.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const nextIsDefault = dto.isDefault ?? existing.isDefault;
      if (nextIsDefault) {
        await client.query(
          `
          UPDATE tbl_sys_doc_number_series
          SET is_default = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP
          WHERE target_comp_id = $2
            AND target_branch_id = $3
            AND target_fyear_id = $4
            AND doc_type_code = $5
            AND series_id <> $6
          `,
          [
            user.userId,
            nextCompId,
            nextBranchId,
            nextFyearId,
            nextDocTypeCode,
            seriesId,
          ],
        );
      }

      await client.query(
        `
        UPDATE tbl_sys_doc_number_series
        SET
          series_code           = $1,
          series_name           = $2,
          doc_type_code         = $3,
          doc_type_name         = $4,
          module_name           = $5,
          target_comp_id        = $6,
          target_branch_id      = $7,
          target_fyear_id       = $8,
          prefix_template       = $9,
          suffix_template       = $10,
          separator_char        = $11,
          padding_digits        = $12,
          starting_no           = $13,
          current_next_no       = $14,
          reset_frequency       = $15,
          allow_manual_override = $16,
          is_default            = $17,
          is_active             = $18,
          updated_by            = $19,
          updated_date          = CURRENT_TIMESTAMP
        WHERE series_id = $20
        `,
        [
          nextSeriesCode,
          (dto.seriesName ?? existing.seriesName).trim(),
          nextDocTypeCode,
          dto.docTypeName ?? existing.docTypeName,
          dto.moduleName ?? existing.moduleName,
          nextCompId,
          nextBranchId,
          nextFyearId,
          (dto.prefixTemplate ?? existing.prefixTemplate).trim().toUpperCase(),
          dto.suffixTemplate !== undefined
            ? dto.suffixTemplate?.trim() || null
            : existing.suffixTemplate,
          dto.separatorChar ?? existing.separatorChar,
          nextPaddingDigits,
          nextStartingNo,
          nextCurrentNo,
          dto.resetFrequency ?? existing.resetFrequency,
          dto.allowManualOverride ?? existing.allowManualOverride,
          nextIsDefault,
          dto.isActive ?? existing.isActive,
          user.userId,
          seriesId,
        ],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updated = await this.findDocSeriesById(seriesId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'CONFIG_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_sys_doc_number_series',
      recordId: seriesId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return updated;
  }

  async deleteDocSeries(
    seriesId: number,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const existing = await this.findDocSeriesById(seriesId);

    if (existing.issuedDocumentsCount > 0) {
      throw new ConflictException(
        `Cannot delete Document Numbering Series "${existing.seriesCode}" because ${existing.issuedDocumentsCount} voucher document(s) have already been generated using this series (Current Next No: ${existing.currentNextNo}). Deactivate the series instead.`,
      );
    }

    await this.pool.query(
      `DELETE FROM tbl_sys_doc_number_series WHERE series_id = $1`,
      [seriesId],
    );

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'CONFIG_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_sys_doc_number_series',
      recordId: seriesId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: null,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return { deleted: true, seriesId };
  }

  async recordScreenAction(
    actionType: 'PRINT' | 'EXPORT',
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'CONFIG_MASTER',
      actionType,
      entityTable: 'tbl_sys_config',
      recordId: 0,
      oldValue: null,
      newValue: { actionType, screenCode: 'CONFIG_MASTER' },
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });
    return { logged: true };
  }
}
