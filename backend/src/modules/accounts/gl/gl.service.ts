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
  CreateChartOfAccountDto,
  CreateCostCenterDto,
  CreateJournalVoucherDto,
  GenerateOperationalJvDto,
  ReverseJournalVoucherDto,
  UpdateChartOfAccountDto,
} from './gl.dto';

@Injectable()
export class GlService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
  ) {}

  // ==========================================================================
  // 1. KPI Financial Overview Summary
  // ==========================================================================
  async getSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // Accounts & Vouchers counts
    const countsSql = `
      SELECT
        (SELECT COUNT(*)::INT FROM tbl_acc_chart_of_accounts WHERE comp_id = $1 AND is_active = TRUE) AS total_accounts,
        (SELECT COUNT(*)::INT FROM tbl_acc_journal_header WHERE comp_id = $1 AND branch_id = $2 AND is_active = TRUE AND status = 'POSTED') AS posted_vouchers,
        (SELECT COUNT(*)::INT FROM tbl_acc_cost_center WHERE comp_id = $1 AND is_active = TRUE) AS active_cost_centers;
    `;
    const countRes = await this.pool.query(countsSql, [compId, branchId]);
    const { total_accounts, posted_vouchers, active_cost_centers } = countRes.rows[0] || {};

    // Financial balance rollups by major Account Type
    const balSql = `
      SELECT
        a.account_type,
        COALESCE(SUM(i.debit_amount), 0) AS total_debit,
        COALESCE(SUM(i.credit_amount), 0) AS total_credit
      FROM tbl_acc_journal_item i
      JOIN tbl_acc_journal_header h ON i.journal_id = h.journal_id
      JOIN tbl_acc_chart_of_accounts a ON i.account_id = a.account_id
      WHERE h.comp_id = $1 AND h.branch_id = $2
        AND h.is_active = TRUE AND h.status = 'POSTED'
      GROUP BY a.account_type;
    `;
    const balRes = await this.pool.query(balSql, [compId, branchId]);

    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let totalRevenue = 0;
    let totalExpense = 0;

    for (const row of balRes.rows) {
      const debit = Number(row.total_debit || 0);
      const credit = Number(row.total_credit || 0);

      if (row.account_type === 'ASSET') {
        totalAssets = debit - credit;
      } else if (row.account_type === 'LIABILITY') {
        totalLiabilities = credit - debit;
      } else if (row.account_type === 'EQUITY') {
        totalEquity = credit - debit;
      } else if (row.account_type === 'REVENUE') {
        totalRevenue = credit - debit;
      } else if (row.account_type === 'EXPENSE') {
        totalExpense = debit - credit;
      }
    }

    const netProfitLoss = totalRevenue - totalExpense;

    return {
      totalAccounts: Number(total_accounts || 0),
      postedVouchers: Number(posted_vouchers || 0),
      activeCostCenters: Number(active_cost_centers || 0),
      totalAssets: Number(totalAssets.toFixed(2)),
      totalLiabilities: Number(totalLiabilities.toFixed(2)),
      totalEquity: Number(totalEquity.toFixed(2)),
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalExpense: Number(totalExpense.toFixed(2)),
      netProfitLoss: Number(netProfitLoss.toFixed(2)),
    };
  }

  // ==========================================================================
  // 2. Lookups (Accounts, Cost Centers, Parties)
  // ==========================================================================
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // Detailed posting accounts (non-group accounts)
    const accSql = `
      SELECT
        account_id,
        account_code,
        account_name,
        account_type,
        normal_balance,
        level,
        is_group,
        is_reconciliation
      FROM tbl_acc_chart_of_accounts
      WHERE comp_id = $1 AND is_active = TRUE
      ORDER BY account_code ASC;
    `;
    const accRes = await this.pool.query(accSql, [compId]);

    // Cost Centers
    const ccSql = `
      SELECT
        cost_center_id,
        cost_center_code,
        cost_center_name,
        dept_id
      FROM tbl_acc_cost_center
      WHERE comp_id = $1 AND is_active = TRUE
      ORDER BY cost_center_code ASC;
    `;
    const ccRes = await this.pool.query(ccSql, [compId]);

    // Parties
    const partySql = `
      SELECT
        party_id,
        party_code,
        party_name,
        party_type
      FROM tbl_crm_party
      WHERE comp_id = $1 AND is_active = TRUE
      ORDER BY party_name ASC;
    `;
    const partyRes = await this.pool.query(partySql, [compId]);

    return {
      accounts: accRes.rows.map((r) => ({
        accountId: Number(r.account_id),
        accountCode: r.account_code,
        accountName: r.account_name,
        accountType: r.account_type,
        normalBalance: r.normal_balance,
        level: Number(r.level),
        isGroup: Boolean(r.is_group),
        isReconciliation: Boolean(r.is_reconciliation),
      })),
      costCenters: ccRes.rows.map((r) => ({
        costCenterId: Number(r.cost_center_id),
        costCenterCode: r.cost_center_code,
        costCenterName: r.cost_center_name,
        deptId: r.dept_id ? Number(r.dept_id) : null,
      })),
      parties: partyRes.rows.map((r) => ({
        partyId: Number(r.party_id),
        partyCode: r.party_code,
        partyName: r.party_name,
        partyType: r.party_type,
      })),
    };
  }

  // ==========================================================================
  // 3. Chart of Accounts (COA) Management
  // ==========================================================================
  async getChartOfAccounts(user: AuthenticatedUserContext, filter?: { accountType?: string; search?: string }) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    let whereClause = `a.comp_id = $1 AND a.is_active = TRUE`;
    const params: any[] = [compId];
    let pIdx = 2;

    if (filter?.accountType) {
      whereClause += ` AND a.account_type = $${pIdx}`;
      params.push(filter.accountType);
      pIdx++;
    }

    if (filter?.search) {
      whereClause += ` AND (a.account_code ILIKE $${pIdx} OR a.account_name ILIKE $${pIdx} OR a.description ILIKE $${pIdx})`;
      params.push(`%${filter.search}%`);
      pIdx++;
    }

    const sql = `
      SELECT
        a.account_id,
        a.account_code,
        a.account_name,
        a.account_type,
        a.parent_account_id,
        p.account_name AS parent_account_name,
        a.level,
        a.normal_balance,
        a.is_group,
        a.is_reconciliation,
        a.currency_code,
        a.description,
        a.is_system,
        a.is_active,
        COALESCE(SUM(i.debit_amount), 0) AS total_debit,
        COALESCE(SUM(i.credit_amount), 0) AS total_credit
      FROM tbl_acc_chart_of_accounts a
      LEFT JOIN tbl_acc_chart_of_accounts p ON a.parent_account_id = p.account_id
      LEFT JOIN tbl_acc_journal_item i ON a.account_id = i.account_id
      LEFT JOIN tbl_acc_journal_header h ON i.journal_id = h.journal_id AND h.branch_id = $${pIdx} AND h.status = 'POSTED' AND h.is_active = TRUE
      WHERE ${whereClause}
      GROUP BY a.account_id, a.account_code, a.account_name, a.account_type, a.parent_account_id, p.account_name, a.level, a.normal_balance, a.is_group, a.is_reconciliation, a.currency_code, a.description, a.is_system, a.is_active
      ORDER BY a.account_code ASC;
    `;

    params.push(branchId);
    const res = await this.pool.query(sql, params);

    return res.rows.map((r) => {
      const debit = Number(r.total_debit || 0);
      const credit = Number(r.total_credit || 0);
      let currentBalance = 0;
      if (r.normal_balance === 'DEBIT') {
        currentBalance = debit - credit;
      } else {
        currentBalance = credit - debit;
      }

      return {
        accountId: Number(r.account_id),
        accountCode: r.account_code,
        accountName: r.account_name,
        accountType: r.account_type,
        parentAccountId: r.parent_account_id ? Number(r.parent_account_id) : null,
        parentAccountName: r.parent_account_name || null,
        level: Number(r.level),
        normalBalance: r.normal_balance,
        isGroup: Boolean(r.is_group),
        isReconciliation: Boolean(r.is_reconciliation),
        currencyCode: r.currency_code,
        description: r.description,
        isSystem: Boolean(r.is_system),
        isActive: Boolean(r.is_active),
        totalDebit: Number(debit.toFixed(2)),
        totalCredit: Number(credit.toFixed(2)),
        currentBalance: Number(currentBalance.toFixed(2)),
      };
    });
  }

  async createChartOfAccount(dto: CreateChartOfAccountDto, user: AuthenticatedUserContext, meta?: any) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    // Check duplicate code
    const dupCheck = await this.pool.query(
      `SELECT account_id FROM tbl_acc_chart_of_accounts WHERE comp_id = $1 AND account_code = $2`,
      [compId, dto.accountCode],
    );
    if (dupCheck.rowCount > 0) {
      throw new BadRequestException(`Account code '${dto.accountCode}' already exists.`);
    }

    let level = dto.level || 5;
    if (dto.parentAccountId) {
      const pRes = await this.pool.query(
        `SELECT level FROM tbl_acc_chart_of_accounts WHERE account_id = $1`,
        [dto.parentAccountId],
      );
      if (pRes.rowCount > 0) {
        level = Math.min(5, Number(pRes.rows[0].level) + 1);
      }
    }

    const insertSql = `
      INSERT INTO tbl_acc_chart_of_accounts (
        account_code, account_name, account_type, parent_account_id, level, normal_balance,
        is_group, is_reconciliation, currency_code, description, is_system, is_active,
        comp_id, branch_id, fyear_id, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, FALSE, TRUE,
        $11, $12, 1001, $13
      )
      RETURNING account_id;
    `;

    const res = await this.pool.query(insertSql, [
      dto.accountCode,
      dto.accountName,
      dto.accountType,
      dto.parentAccountId || null,
      level,
      dto.normalBalance || (dto.accountType === 'ASSET' || dto.accountType === 'EXPENSE' ? 'DEBIT' : 'CREDIT'),
      Boolean(dto.isGroup),
      Boolean(dto.isReconciliation),
      dto.currencyCode || 'INR',
      dto.description || null,
      compId,
      branchId,
      userId,
    ]);

    const accountId = Number(res.rows[0].account_id);

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'GL_ACCOUNTS',
      actionType: 'ADD',
      entityTable: 'tbl_acc_chart_of_accounts',
      recordId: accountId,
      newValue: { accountId, ...dto },
      compId,
      branchId,
      fyearId: 1001,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    return { accountId, message: `Account '${dto.accountCode} - ${dto.accountName}' created successfully.` };
  }

  async updateChartOfAccount(id: number, dto: UpdateChartOfAccountDto, user: AuthenticatedUserContext, meta?: any) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;

    const existRes = await this.pool.query(
      `SELECT * FROM tbl_acc_chart_of_accounts WHERE account_id = $1 AND comp_id = $2`,
      [id, compId],
    );
    if (existRes.rowCount === 0) {
      throw new NotFoundException(`Account #${id} not found.`);
    }
    const oldRow = existRes.rows[0];

    const updateSql = `
      UPDATE tbl_acc_chart_of_accounts
      SET
        account_name = COALESCE($1, account_name),
        parent_account_id = CASE WHEN $2::BIGINT IS NOT NULL THEN $2::BIGINT ELSE parent_account_id END,
        is_reconciliation = COALESCE($3, is_reconciliation),
        description = COALESCE($4, description),
        is_active = COALESCE($5, is_active),
        updated_by = $6,
        updated_date = CURRENT_TIMESTAMP
      WHERE account_id = $7
      RETURNING *;
    `;

    const res = await this.pool.query(updateSql, [
      dto.accountName || null,
      dto.parentAccountId || null,
      dto.isReconciliation !== undefined ? dto.isReconciliation : null,
      dto.description || null,
      dto.isActive !== undefined ? dto.isActive : null,
      userId,
      id,
    ]);

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'GL_ACCOUNTS',
      actionType: 'EDIT',
      entityTable: 'tbl_acc_chart_of_accounts',
      recordId: id,
      oldValue: oldRow,
      newValue: res.rows[0],
      compId,
      branchId: user.branchId || 1001,
      fyearId: 1001,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    return { message: `Account updated successfully.`, account: res.rows[0] };
  }

  // ==========================================================================
  // 4. General Ledger Statement (Account Drilldown with Running Balance)
  // ==========================================================================
  async getAccountStatement(
    user: AuthenticatedUserContext,
    params: {
      accountId: number;
      fromDate?: string;
      toDate?: string;
      costCenterId?: number;
    },
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // Fetch account info
    const accRes = await this.pool.query(
      `SELECT account_id, account_code, account_name, account_type, normal_balance FROM tbl_acc_chart_of_accounts WHERE account_id = $1 AND comp_id = $2`,
      [params.accountId, compId],
    );
    if (accRes.rowCount === 0) {
      throw new NotFoundException(`Account #${params.accountId} not found.`);
    }
    const acc = accRes.rows[0];

    const fromDate = params.fromDate || '2026-04-01';
    const toDate = params.toDate || new Date().toISOString().slice(0, 10);

    // Opening balance calculation (all transactions strictly before fromDate)
    const opBalSql = `
      SELECT
        COALESCE(SUM(i.debit_amount), 0) AS op_debit,
        COALESCE(SUM(i.credit_amount), 0) AS op_credit
      FROM tbl_acc_journal_item i
      JOIN tbl_acc_journal_header h ON i.journal_id = h.journal_id
      WHERE h.comp_id = $1 AND h.branch_id = $2
        AND i.account_id = $3
        AND h.is_active = TRUE AND h.status = 'POSTED'
        AND h.voucher_date < $4
        AND ($5::BIGINT IS NULL OR i.cost_center_id = $5::BIGINT);
    `;
    const opRes = await this.pool.query(opBalSql, [compId, branchId, params.accountId, fromDate, params.costCenterId || null]);
    const opDebit = Number(opRes.rows[0]?.op_debit || 0);
    const opCredit = Number(opRes.rows[0]?.op_credit || 0);

    let openingBalance = 0;
    if (acc.normal_balance === 'DEBIT') {
      openingBalance = opDebit - opCredit;
    } else {
      openingBalance = opCredit - opDebit;
    }

    // Period Transactions
    const txSql = `
      SELECT
        i.journal_item_id,
        h.journal_id,
        h.voucher_no,
        h.voucher_date,
        h.voucher_type,
        h.source_module,
        h.source_ref_no,
        h.narration AS header_narration,
        i.line_narration,
        i.debit_amount,
        i.credit_amount,
        p.party_name,
        cc.cost_center_name
      FROM tbl_acc_journal_item i
      JOIN tbl_acc_journal_header h ON i.journal_id = h.journal_id
      LEFT JOIN tbl_crm_party p ON i.party_id = p.party_id
      LEFT JOIN tbl_acc_cost_center cc ON i.cost_center_id = cc.cost_center_id
      WHERE h.comp_id = $1 AND h.branch_id = $2
        AND i.account_id = $3
        AND h.is_active = TRUE AND h.status = 'POSTED'
        AND h.voucher_date >= $4 AND h.voucher_date <= $5
        AND ($6::BIGINT IS NULL OR i.cost_center_id = $6::BIGINT)
      ORDER BY h.voucher_date ASC, h.voucher_no ASC, i.line_no ASC;
    `;
    const txRes = await this.pool.query(txSql, [
      compId,
      branchId,
      params.accountId,
      fromDate,
      toDate,
      params.costCenterId || null,
    ]);

    let runningBal = openingBalance;
    let periodTotalDebit = 0;
    let periodTotalCredit = 0;

    const transactions = txRes.rows.map((row) => {
      const debit = Number(row.debit_amount || 0);
      const credit = Number(row.credit_amount || 0);
      periodTotalDebit += debit;
      periodTotalCredit += credit;

      if (acc.normal_balance === 'DEBIT') {
        runningBal += debit - credit;
      } else {
        runningBal += credit - debit;
      }

      return {
        journalItemId: Number(row.journal_item_id),
        journalId: Number(row.journal_id),
        voucherNo: row.voucher_no,
        voucherDate: row.voucher_date,
        voucherType: row.voucher_type,
        sourceModule: row.source_module,
        sourceRefNo: row.source_ref_no,
        narration: row.line_narration || row.header_narration,
        partyName: row.party_name || null,
        costCenterName: row.cost_center_name || null,
        debitAmount: Number(debit.toFixed(2)),
        creditAmount: Number(credit.toFixed(2)),
        runningBalance: Number(runningBal.toFixed(2)),
      };
    });

    return {
      account: {
        accountId: Number(acc.account_id),
        accountCode: acc.account_code,
        accountName: acc.account_name,
        accountType: acc.account_type,
        normalBalance: acc.normal_balance,
      },
      fromDate,
      toDate,
      openingBalance: Number(openingBalance.toFixed(2)),
      periodTotalDebit: Number(periodTotalDebit.toFixed(2)),
      periodTotalCredit: Number(periodTotalCredit.toFixed(2)),
      closingBalance: Number(runningBal.toFixed(2)),
      transactions,
    };
  }

  // ==========================================================================
  // 5. Statutory Trial Balance
  // ==========================================================================
  async getTrialBalance(user: AuthenticatedUserContext, asOfDate?: string) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const targetDate = asOfDate || new Date().toISOString().slice(0, 10);

    const sql = `
      SELECT
        a.account_id,
        a.account_code,
        a.account_name,
        a.account_type,
        a.level,
        a.normal_balance,
        a.is_group,
        COALESCE(SUM(i.debit_amount), 0) AS total_debit,
        COALESCE(SUM(i.credit_amount), 0) AS total_credit
      FROM tbl_acc_chart_of_accounts a
      LEFT JOIN tbl_acc_journal_item i ON a.account_id = i.account_id
      LEFT JOIN tbl_acc_journal_header h ON i.journal_id = h.journal_id
        AND h.branch_id = $2 AND h.status = 'POSTED' AND h.is_active = TRUE
        AND h.voucher_date <= $3
      WHERE a.comp_id = $1 AND a.is_active = TRUE
      GROUP BY a.account_id, a.account_code, a.account_name, a.account_type, a.level, a.normal_balance, a.is_group
      ORDER BY a.account_code ASC;
    `;

    const res = await this.pool.query(sql, [compId, branchId, targetDate]);

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    const rows = res.rows.map((r) => {
      const debit = Number(r.total_debit || 0);
      const credit = Number(r.total_credit || 0);

      let netDebit = 0;
      let netCredit = 0;

      if (r.normal_balance === 'DEBIT') {
        const net = debit - credit;
        if (net >= 0) {
          netDebit = net;
        } else {
          netCredit = Math.abs(net);
        }
      } else {
        const net = credit - debit;
        if (net >= 0) {
          netCredit = net;
        } else {
          netDebit = Math.abs(net);
        }
      }

      if (!r.is_group) {
        grandTotalDebit += netDebit;
        grandTotalCredit += netCredit;
      }

      return {
        accountId: Number(r.account_id),
        accountCode: r.account_code,
        accountName: r.account_name,
        accountType: r.account_type,
        level: Number(r.level),
        normalBalance: r.normal_balance,
        isGroup: Boolean(r.is_group),
        grossDebit: Number(debit.toFixed(2)),
        grossCredit: Number(credit.toFixed(2)),
        netDebit: Number(netDebit.toFixed(2)),
        netCredit: Number(netCredit.toFixed(2)),
      };
    });

    return {
      asOfDate: targetDate,
      rows,
      grandTotalDebit: Number(grandTotalDebit.toFixed(2)),
      grandTotalCredit: Number(grandTotalCredit.toFixed(2)),
      isBalanced: Math.abs(grandTotalDebit - grandTotalCredit) < 0.01,
      variance: Number(Math.abs(grandTotalDebit - grandTotalCredit).toFixed(2)),
    };
  }

  // ==========================================================================
  // 6. Financial Statements: Profit & Loss and Balance Sheet
  // ==========================================================================
  async getFinancialStatements(user: AuthenticatedUserContext, asOfDate?: string) {
    const trialBalance = await this.getTrialBalance(user, asOfDate);

    // Group rows into P&L and Balance Sheet
    const revenueRows: any[] = [];
    const expenseRows: any[] = [];
    const assetRows: any[] = [];
    const liabilityRows: any[] = [];
    const equityRows: any[] = [];

    let totalRevenue = 0;
    let totalExpense = 0;
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;

    for (const row of trialBalance.rows) {
      if (row.isGroup) continue;

      if (row.accountType === 'REVENUE') {
        const amt = row.netCredit - row.netDebit;
        totalRevenue += amt;
        revenueRows.push({ ...row, amount: Number(amt.toFixed(2)) });
      } else if (row.accountType === 'EXPENSE') {
        const amt = row.netDebit - row.netCredit;
        totalExpense += amt;
        expenseRows.push({ ...row, amount: Number(amt.toFixed(2)) });
      } else if (row.accountType === 'ASSET') {
        const amt = row.netDebit - row.netCredit;
        totalAssets += amt;
        assetRows.push({ ...row, amount: Number(amt.toFixed(2)) });
      } else if (row.accountType === 'LIABILITY') {
        const amt = row.netCredit - row.netDebit;
        totalLiabilities += amt;
        liabilityRows.push({ ...row, amount: Number(amt.toFixed(2)) });
      } else if (row.accountType === 'EQUITY') {
        const amt = row.netCredit - row.netDebit;
        totalEquity += amt;
        equityRows.push({ ...row, amount: Number(amt.toFixed(2)) });
      }
    }

    const netProfit = totalRevenue - totalExpense;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + netProfit;

    return {
      asOfDate: trialBalance.asOfDate,
      profitAndLoss: {
        revenues: revenueRows,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        expenses: expenseRows,
        totalExpense: Number(totalExpense.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
      },
      balanceSheet: {
        assets: assetRows,
        totalAssets: Number(totalAssets.toFixed(2)),
        liabilities: liabilityRows,
        totalLiabilities: Number(totalLiabilities.toFixed(2)),
        equity: equityRows,
        totalEquity: Number(totalEquity.toFixed(2)),
        currentPeriodNetProfit: Number(netProfit.toFixed(2)),
        totalLiabilitiesAndEquity: Number(totalLiabilitiesAndEquity.toFixed(2)),
        isBalanced: Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.05,
      },
    };
  }

  // ==========================================================================
  // 7. Journal Vouchers Register & Details
  // ==========================================================================
  async getVouchers(
    user: AuthenticatedUserContext,
    filter?: {
      search?: string;
      voucherType?: string;
      status?: string;
      fromDate?: string;
      toDate?: string;
    },
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    let whereClause = `h.comp_id = $1 AND h.branch_id = $2 AND h.is_active = TRUE`;
    const params: any[] = [compId, branchId];
    let pIdx = 3;

    if (filter?.voucherType) {
      whereClause += ` AND h.voucher_type = $${pIdx}`;
      params.push(filter.voucherType);
      pIdx++;
    }

    if (filter?.status) {
      whereClause += ` AND h.status = $${pIdx}`;
      params.push(filter.status);
      pIdx++;
    }

    if (filter?.fromDate) {
      whereClause += ` AND h.voucher_date >= $${pIdx}`;
      params.push(filter.fromDate);
      pIdx++;
    }

    if (filter?.toDate) {
      whereClause += ` AND h.voucher_date <= $${pIdx}`;
      params.push(filter.toDate);
      pIdx++;
    }

    if (filter?.search) {
      whereClause += ` AND (h.voucher_no ILIKE $${pIdx} OR h.source_ref_no ILIKE $${pIdx} OR h.narration ILIKE $${pIdx})`;
      params.push(`%${filter.search}%`);
      pIdx++;
    }

    const sql = `
      SELECT
        h.journal_id,
        h.voucher_no,
        h.voucher_date,
        h.voucher_type,
        h.source_module,
        h.source_ref_no,
        h.source_ref_id,
        h.narration,
        h.total_debit,
        h.total_credit,
        h.is_posted,
        h.posted_by,
        u.full_name AS posted_by_name,
        h.posted_date,
        h.is_reversed,
        h.reversal_ref_id,
        h.reversal_date,
        h.reversal_reason,
        h.status,
        COUNT(i.journal_item_id)::INT AS line_count
      FROM tbl_acc_journal_header h
      LEFT JOIN tbl_sec_user u ON h.posted_by = u.user_id
      LEFT JOIN tbl_acc_journal_item i ON h.journal_id = i.journal_id
      WHERE ${whereClause}
      GROUP BY h.journal_id, u.full_name
      ORDER BY h.voucher_date DESC, h.journal_id DESC;
    `;

    const res = await this.pool.query(sql, params);

    return res.rows.map((r) => ({
      journalId: Number(r.journal_id),
      voucherNo: r.voucher_no,
      voucherDate: r.voucher_date,
      voucherType: r.voucher_type,
      sourceModule: r.source_module,
      sourceRefNo: r.source_ref_no,
      sourceRefId: r.source_ref_id ? Number(r.source_ref_id) : null,
      narration: r.narration,
      totalDebit: Number(Number(r.total_debit || 0).toFixed(2)),
      totalCredit: Number(Number(r.total_credit || 0).toFixed(2)),
      isPosted: Boolean(r.is_posted),
      postedBy: r.posted_by ? Number(r.posted_by) : null,
      postedByName: r.posted_by_name || 'System',
      postedDate: r.posted_date,
      isReversed: Boolean(r.is_reversed),
      reversalRefId: r.reversal_ref_id ? Number(r.reversal_ref_id) : null,
      reversalDate: r.reversal_date,
      reversalReason: r.reversal_reason,
      status: r.status,
      lineCount: Number(r.line_count || 0),
    }));
  }

  async getVoucherById(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const hSql = `
      SELECT
        h.*,
        u.full_name AS posted_by_name
      FROM tbl_acc_journal_header h
      LEFT JOIN tbl_sec_user u ON h.posted_by = u.user_id
      WHERE h.journal_id = $1 AND h.comp_id = $2 AND h.branch_id = $3 AND h.is_active = TRUE;
    `;
    const hRes = await this.pool.query(hSql, [id, compId, branchId]);
    if (hRes.rowCount === 0) {
      throw new NotFoundException(`Journal Voucher #${id} not found.`);
    }
    const h = hRes.rows[0];

    const iSql = `
      SELECT
        i.journal_item_id,
        i.account_id,
        a.account_code,
        a.account_name,
        a.account_type,
        a.normal_balance,
        i.debit_amount,
        i.credit_amount,
        i.party_id,
        p.party_name,
        i.cost_center_id,
        cc.cost_center_name,
        i.line_narration,
        i.line_no
      FROM tbl_acc_journal_item i
      JOIN tbl_acc_chart_of_accounts a ON i.account_id = a.account_id
      LEFT JOIN tbl_crm_party p ON i.party_id = p.party_id
      LEFT JOIN tbl_acc_cost_center cc ON i.cost_center_id = cc.cost_center_id
      WHERE i.journal_id = $1 AND i.is_active = TRUE
      ORDER BY i.line_no ASC;
    `;
    const iRes = await this.pool.query(iSql, [id]);

    return {
      journalId: Number(h.journal_id),
      voucherNo: h.voucher_no,
      voucherDate: h.voucher_date,
      voucherType: h.voucher_type,
      sourceModule: h.source_module,
      sourceRefNo: h.source_ref_no,
      sourceRefId: h.source_ref_id ? Number(h.source_ref_id) : null,
      narration: h.narration,
      totalDebit: Number(Number(h.total_debit || 0).toFixed(2)),
      totalCredit: Number(Number(h.total_credit || 0).toFixed(2)),
      isPosted: Boolean(h.is_posted),
      postedBy: h.posted_by ? Number(h.posted_by) : null,
      postedByName: h.posted_by_name || 'System',
      postedDate: h.posted_date,
      isReversed: Boolean(h.is_reversed),
      reversalRefId: h.reversal_ref_id ? Number(h.reversal_ref_id) : null,
      reversalDate: h.reversal_date,
      reversalReason: h.reversal_reason,
      status: h.status,
      items: iRes.rows.map((r) => ({
        journalItemId: Number(r.journal_item_id),
        accountId: Number(r.account_id),
        accountCode: r.account_code,
        accountName: r.account_name,
        accountType: r.account_type,
        normalBalance: r.normal_balance,
        debitAmount: Number(Number(r.debit_amount || 0).toFixed(2)),
        creditAmount: Number(Number(r.credit_amount || 0).toFixed(2)),
        partyId: r.party_id ? Number(r.party_id) : null,
        partyName: r.party_name || null,
        costCenterId: r.cost_center_id ? Number(r.cost_center_id) : null,
        costCenterName: r.cost_center_name || null,
        lineNarration: r.line_narration || null,
        lineNo: Number(r.line_no),
      })),
    };
  }

  // ==========================================================================
  // 8. Create Manual Balanced Journal Voucher
  // ==========================================================================
  async createVoucher(dto: CreateJournalVoucherDto, user: AuthenticatedUserContext, meta?: any) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    if (!dto.items || dto.items.length < 2) {
      throw new BadRequestException('A Journal Voucher must contain at least 2 double-entry line items.');
    }

    let sumDebit = 0;
    let sumCredit = 0;

    for (const item of dto.items) {
      const debit = Number(item.debitAmount || 0);
      const credit = Number(item.creditAmount || 0);

      if (debit < 0 || credit < 0) {
        throw new BadRequestException('Debit and credit amounts cannot be negative.');
      }
      if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
        throw new BadRequestException('Each line must have either a debit OR a credit amount.');
      }
      sumDebit += debit;
      sumCredit += credit;
    }

    if (Math.abs(sumDebit - sumCredit) > 0.01 || sumDebit <= 0) {
      throw new BadRequestException(
        `Journal Voucher is out of balance. Total Debit: ₹${sumDebit.toFixed(2)}, Total Credit: ₹${sumCredit.toFixed(2)}. Invariant requires Total Debit = Total Credit.`,
      );
    }

    // Verify accounts exist and are not group headers
    for (const item of dto.items) {
      const aRes = await this.pool.query(
        `SELECT is_group FROM tbl_acc_chart_of_accounts WHERE account_id = $1 AND comp_id = $2`,
        [item.accountId, compId],
      );
      if (aRes.rowCount === 0) {
        throw new BadRequestException(`Account #${item.accountId} does not exist.`);
      }
      if (aRes.rows[0].is_group) {
        throw new BadRequestException(`Cannot post journal entries directly to header group account #${item.accountId}.`);
      }
    }

    // Generate Voucher Number
    const countRes = await this.pool.query(
      `SELECT COUNT(*)::INT AS seq FROM tbl_acc_journal_header WHERE comp_id = $1 AND branch_id = $2`,
      [compId, branchId],
    );
    const nextSeq = Number(countRes.rows[0]?.seq || 0) + 1;
    const voucherNo = `JV-AHM-2627-${String(nextSeq).padStart(4, '0')}`;
    const voucherDate = dto.voucherDate || new Date().toISOString().slice(0, 10);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const hInsertSql = `
        INSERT INTO tbl_acc_journal_header (
          voucher_no, voucher_date, voucher_type, source_module, source_ref_no, source_ref_id,
          narration, total_debit, total_credit, is_posted, posted_by, posted_date, status,
          is_active, comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, TRUE, $10, CURRENT_TIMESTAMP, 'POSTED',
          TRUE, $11, $12, 1001, $13
        )
        RETURNING journal_id;
      `;

      const hRes = await client.query(hInsertSql, [
        voucherNo,
        voucherDate,
        dto.voucherType || 'GENERAL',
        dto.sourceModule || 'MANUAL',
        dto.sourceRefNo || null,
        dto.sourceRefId || null,
        dto.narration,
        sumDebit,
        sumCredit,
        userId,
        compId,
        branchId,
        userId,
      ]);

      const journalId = Number(hRes.rows[0].journal_id);

      for (let i = 0; i < dto.items.length; i++) {
        const item = dto.items[i];
        const iInsertSql = `
          INSERT INTO tbl_acc_journal_item (
            journal_id, account_id, debit_amount, credit_amount, party_id, cost_center_id,
            line_narration, line_no, is_active, comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, TRUE, $9, $10, 1001, $11
          );
        `;
        await client.query(iInsertSql, [
          journalId,
          item.accountId,
          item.debitAmount,
          item.creditAmount,
          item.partyId || null,
          item.costCenterId || null,
          item.lineNarration || null,
          i + 1,
          compId,
          branchId,
          userId,
        ]);
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'GL_ACCOUNTS',
        actionType: 'POST',
        entityTable: 'tbl_acc_journal_header',
        recordId: journalId,
        newValue: { journalId, voucherNo, sumDebit, sumCredit, ...dto },
        compId,
        branchId,
        fyearId: 1001,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
        correlationId: meta?.correlationId,
      });

      return {
        journalId,
        voucherNo,
        message: `Journal Voucher '${voucherNo}' successfully posted. Total: ₹${sumDebit.toFixed(2)}`,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // 9. Reversal of Posted Journal Voucher
  // ==========================================================================
  async reverseVoucher(id: number, dto: ReverseJournalVoucherDto, user: AuthenticatedUserContext, meta?: any) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    const voucher = await this.getVoucherById(id, user);
    if (voucher.isReversed || voucher.status === 'REVERSED') {
      throw new BadRequestException(`Voucher '${voucher.voucherNo}' has already been reversed.`);
    }

    // Prepare reversing items: swap debit and credit
    const revItems = voucher.items.map((it) => ({
      accountId: it.accountId,
      debitAmount: it.creditAmount,
      creditAmount: it.debitAmount,
      partyId: it.partyId || undefined,
      costCenterId: it.costCenterId || undefined,
      lineNarration: `Reversal of ${voucher.voucherNo}: ${it.lineNarration || ''}`.trim(),
    }));

    // Create reversing voucher
    const revDto: CreateJournalVoucherDto = {
      voucherDate: new Date().toISOString().slice(0, 10),
      voucherType: 'GENERAL',
      sourceModule: 'MANUAL',
      sourceRefNo: voucher.voucherNo,
      sourceRefId: voucher.journalId,
      narration: `Reversal of ${voucher.voucherNo}. Reason: ${dto.reversalReason}`,
      items: revItems,
    };

    const revResult = await this.createVoucher(revDto, user, meta);

    // Update original voucher to REVERSED
    await this.pool.query(
      `UPDATE tbl_acc_journal_header
       SET is_reversed = TRUE,
           reversal_ref_id = $1,
           reversal_date = CURRENT_TIMESTAMP,
           reversal_reason = $2,
           status = 'REVERSED',
           updated_by = $3,
           updated_date = CURRENT_TIMESTAMP
       WHERE journal_id = $4`,
      [revResult.journalId, dto.reversalReason, userId, id],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'GL_ACCOUNTS',
      actionType: 'REVERSE',
      entityTable: 'tbl_acc_journal_header',
      recordId: id,
      newValue: { originalJournalId: id, reversalJournalId: revResult.journalId, reason: dto.reversalReason },
      compId,
      branchId,
      fyearId: 1001,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    return {
      message: `Voucher '${voucher.voucherNo}' reversed by '${revResult.voucherNo}'.`,
      reversalVoucherNo: revResult.voucherNo,
      reversalJournalId: revResult.journalId,
    };
  }

  // ==========================================================================
  // 10. Operational Integration: Find Unposted Events
  // ==========================================================================
  async getUnpostedOperations(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // Unposted Sales Invoices
    const siSql = `
      SELECT
        i.invoice_id,
        i.invoice_no,
        i.invoice_date,
        i.customer_id,
        p.party_name AS customer_name,
        i.total_taxable_amount,
        i.total_cgst_amount,
        i.total_sgst_amount,
        i.total_igst_amount,
        i.total_invoice_amount
      FROM tbl_sales_invoice_header i
      JOIN tbl_crm_party p ON i.customer_id = p.party_id
      LEFT JOIN tbl_acc_journal_header j ON j.source_module = 'SALES' AND j.source_ref_id = i.invoice_id AND j.is_active = TRUE
      WHERE i.comp_id = $1 AND i.branch_id = $2 AND i.is_active = TRUE
        AND j.journal_id IS NULL
      ORDER BY i.invoice_date DESC
      LIMIT 10;
    `;
    const siRes = await this.pool.query(siSql, [compId, branchId]);

    // Unposted Purchase Invoices
    const piSql = `
      SELECT
        i.invoice_id,
        i.invoice_no,
        i.invoice_date,
        i.vendor_id,
        p.party_name AS vendor_name,
        i.total_taxable_amount,
        i.total_cgst_amount,
        i.total_sgst_amount,
        i.total_igst_amount,
        i.total_invoice_amount
      FROM tbl_pur_invoice_header i
      JOIN tbl_crm_party p ON i.vendor_id = p.party_id
      LEFT JOIN tbl_acc_journal_header j ON j.source_module = 'PROCUREMENT' AND j.source_ref_id = i.invoice_id AND j.is_active = TRUE
      WHERE i.comp_id = $1 AND i.branch_id = $2 AND i.is_active = TRUE
        AND j.journal_id IS NULL
      ORDER BY i.invoice_date DESC
      LIMIT 10;
    `;
    const piRes = await this.pool.query(piSql, [compId, branchId]);

    // Unposted FG Production Receipts
    const fgrSql = `
      SELECT
        r.fg_receipt_id,
        r.fg_receipt_no,
        r.receipt_date,
        r.wo_id,
        r.item_id,
        it.item_name,
        r.accepted_qty,
        COALESCE(r.actual_material_cost, 0) + COALESCE(r.actual_operation_cost, 0) AS total_production_cost
      FROM tbl_mfg_fg_receipt_header r
      JOIN tbl_inv_item it ON r.item_id = it.item_id
      LEFT JOIN tbl_acc_journal_header j ON j.source_module = 'MANUFACTURING' AND j.source_ref_id = r.fg_receipt_id AND j.is_active = TRUE
      WHERE r.comp_id = $1 AND r.branch_id = $2 AND r.is_active = TRUE
        AND j.journal_id IS NULL
      ORDER BY r.receipt_date DESC
      LIMIT 10;
    `;
    const fgrRes = await this.pool.query(fgrSql, [compId, branchId]);

    return {
      salesInvoices: siRes.rows.map((r) => ({
        invoiceId: Number(r.invoice_id),
        invoiceNo: r.invoice_no,
        invoiceDate: r.invoice_date,
        customerId: Number(r.customer_id),
        customerName: r.customer_name,
        taxableAmount: Number(Number(r.total_taxable_amount || 0).toFixed(2)),
        cgstAmount: Number(Number(r.total_cgst_amount || 0).toFixed(2)),
        sgstAmount: Number(Number(r.total_sgst_amount || 0).toFixed(2)),
        igstAmount: Number(Number(r.total_igst_amount || 0).toFixed(2)),
        totalInvoiceAmount: Number(Number(r.total_invoice_amount || 0).toFixed(2)),
      })),
      purchaseInvoices: piRes.rows.map((r) => ({
        invoiceId: Number(r.invoice_id),
        invoiceNo: r.invoice_no,
        invoiceDate: r.invoice_date,
        vendorId: Number(r.vendor_id),
        vendorName: r.vendor_name,
        taxableAmount: Number(Number(r.total_taxable_amount || 0).toFixed(2)),
        cgstAmount: Number(Number(r.total_cgst_amount || 0).toFixed(2)),
        sgstAmount: Number(Number(r.total_sgst_amount || 0).toFixed(2)),
        igstAmount: Number(Number(r.total_igst_amount || 0).toFixed(2)),
        totalInvoiceAmount: Number(Number(r.total_invoice_amount || 0).toFixed(2)),
      })),
      fgReceipts: fgrRes.rows.map((r) => ({
        fgReceiptId: Number(r.fg_receipt_id),
        fgReceiptNo: r.fg_receipt_no,
        receiptDate: r.receipt_date,
        woId: Number(r.wo_id),
        itemId: Number(r.item_id),
        itemName: r.item_name,
        acceptedQty: Number(r.accepted_qty),
        totalProductionCost: Number(Number(r.total_production_cost || 0).toFixed(2)),
      })),
    };
  }

  // ==========================================================================
  // 11. 1-Click Auto Post Operational Event to GL
  // ==========================================================================
  async generateOperationalJv(dto: GenerateOperationalJvDto, user: AuthenticatedUserContext, meta?: any) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // Fetch Standard Accounts
    const accLookup = await this.pool.query(
      `SELECT account_id, account_code FROM tbl_acc_chart_of_accounts WHERE comp_id = $1`,
      [compId],
    );
    const codeToId: Record<string, number> = {};
    for (const r of accLookup.rows) {
      codeToId[r.account_code] = Number(r.account_id);
    }

    const debtorAccId = codeToId['112001'] || 1111;
    const salesAccId = codeToId['411001'] || 1401;
    const cgstOutputAccId = codeToId['212001'] || 1211;
    const sgstOutputAccId = codeToId['212002'] || 1212;
    const igstOutputAccId = codeToId['212003'] || 1213;

    const rmStockAccId = codeToId['113001'] || 1121;
    const cgstInputAccId = codeToId['114001'] || 1131;
    const sgstInputAccId = codeToId['114002'] || 1132;
    const igstInputAccId = codeToId['114003'] || 1133;
    const creditorAccId = codeToId['211001'] || 1201;

    const fgStockAccId = codeToId['113003'] || 1123;
    const rmConsumpAccId = codeToId['511001'] || 1501;
    const laborWagesAccId = codeToId['511002'] || 1502;

    if (dto.operationType === 'SALES_INVOICE') {
      const invRes = await this.pool.query(
        `SELECT * FROM tbl_sales_invoice_header WHERE invoice_id = $1 AND comp_id = $2`,
        [dto.operationId, compId],
      );
      if (invRes.rowCount === 0) throw new NotFoundException('Sales Invoice not found.');
      const inv = invRes.rows[0];

      const taxable = Number(inv.total_taxable_amount || 0);
      const cgst = Number(inv.total_cgst_amount || 0);
      const sgst = Number(inv.total_sgst_amount || 0);
      const igst = Number(inv.total_igst_amount || 0);
      const total = Number(inv.total_invoice_amount || 0);

      const items: any[] = [
        {
          accountId: debtorAccId,
          debitAmount: total,
          creditAmount: 0,
          partyId: Number(inv.customer_id),
          lineNarration: `Receivable for Sales Invoice ${inv.invoice_no}`,
        },
        {
          accountId: salesAccId,
          debitAmount: 0,
          creditAmount: taxable,
          lineNarration: `Domestic Sales Revenue for ${inv.invoice_no}`,
        },
      ];

      if (cgst > 0) {
        items.push({
          accountId: cgstOutputAccId,
          debitAmount: 0,
          creditAmount: cgst,
          lineNarration: `CGST Output Liability on ${inv.invoice_no}`,
        });
      }
      if (sgst > 0) {
        items.push({
          accountId: sgstOutputAccId,
          debitAmount: 0,
          creditAmount: sgst,
          lineNarration: `SGST Output Liability on ${inv.invoice_no}`,
        });
      }
      if (igst > 0) {
        items.push({
          accountId: igstOutputAccId,
          debitAmount: 0,
          creditAmount: igst,
          lineNarration: `IGST Output Liability on ${inv.invoice_no}`,
        });
      }

      return this.createVoucher(
        {
          voucherDate: inv.invoice_date,
          voucherType: 'SALES_INVOICE',
          sourceModule: 'SALES',
          sourceRefNo: inv.invoice_no,
          sourceRefId: Number(inv.invoice_id),
          narration: `Automated GL posting for Sales Tax Invoice ${inv.invoice_no}`,
          items,
        },
        user,
        meta,
      );
    } else if (dto.operationType === 'PURCHASE_INVOICE') {
      const invRes = await this.pool.query(
        `SELECT * FROM tbl_pur_invoice_header WHERE invoice_id = $1 AND comp_id = $2`,
        [dto.operationId, compId],
      );
      if (invRes.rowCount === 0) throw new NotFoundException('Purchase Invoice not found.');
      const inv = invRes.rows[0];

      const taxable = Number(inv.total_taxable_amount || 0);
      const cgst = Number(inv.total_cgst_amount || 0);
      const sgst = Number(inv.total_sgst_amount || 0);
      const igst = Number(inv.total_igst_amount || 0);
      const total = Number(inv.total_invoice_amount || 0);

      const items: any[] = [
        {
          accountId: rmStockAccId,
          debitAmount: taxable,
          creditAmount: 0,
          lineNarration: `Raw Material Inventory purchase under ${inv.invoice_no}`,
        },
      ];

      if (cgst > 0) {
        items.push({
          accountId: cgstInputAccId,
          debitAmount: cgst,
          creditAmount: 0,
          lineNarration: `CGST Input Tax Credit on ${inv.invoice_no}`,
        });
      }
      if (sgst > 0) {
        items.push({
          accountId: sgstInputAccId,
          debitAmount: sgst,
          creditAmount: 0,
          lineNarration: `SGST Input Tax Credit on ${inv.invoice_no}`,
        });
      }
      if (igst > 0) {
        items.push({
          accountId: igstInputAccId,
          debitAmount: igst,
          creditAmount: 0,
          lineNarration: `IGST Input Tax Credit on ${inv.invoice_no}`,
        });
      }

      items.push({
        accountId: creditorAccId,
        debitAmount: 0,
        creditAmount: total,
        partyId: Number(inv.vendor_id),
        lineNarration: `Accounts Payable to vendor for ${inv.invoice_no}`,
      });

      return this.createVoucher(
        {
          voucherDate: inv.invoice_date,
          voucherType: 'PURCHASE_INVOICE',
          sourceModule: 'PROCUREMENT',
          sourceRefNo: inv.invoice_no,
          sourceRefId: Number(inv.invoice_id),
          narration: `Automated GL posting for Purchase Invoice ${inv.invoice_no}`,
          items,
        },
        user,
        meta,
      );
    } else if (dto.operationType === 'FG_RECEIPT') {
      const fgrRes = await this.pool.query(
        `SELECT * FROM tbl_mfg_fg_receipt_header WHERE fg_receipt_id = $1 AND comp_id = $2`,
        [dto.operationId, compId],
      );
      if (fgrRes.rowCount === 0) throw new NotFoundException('FG Receipt not found.');
      const fgr = fgrRes.rows[0];

      const matCost = Number(fgr.actual_material_cost || 0);
      const opCost = Number(fgr.actual_operation_cost || 0);
      const totalCost = matCost + opCost;

      const items: any[] = [
        {
          accountId: fgStockAccId,
          debitAmount: totalCost,
          creditAmount: 0,
          lineNarration: `Finished Goods inventory valuation for ${fgr.fg_receipt_no}`,
        },
        {
          accountId: rmConsumpAccId,
          debitAmount: 0,
          creditAmount: matCost,
          lineNarration: `Raw material absorbed in production for ${fgr.fg_receipt_no}`,
        },
        {
          accountId: laborWagesAccId,
          debitAmount: 0,
          creditAmount: opCost,
          lineNarration: `Shopfloor wages and machining absorbed for ${fgr.fg_receipt_no}`,
        },
      ];

      return this.createVoucher(
        {
          voucherDate: fgr.receipt_date,
          voucherType: 'ABSORPTION_COST',
          sourceModule: 'MANUFACTURING',
          sourceRefNo: fgr.fg_receipt_no,
          sourceRefId: Number(fgr.fg_receipt_id),
          narration: `Finished Goods production absorption cost capitalization for ${fgr.fg_receipt_no}`,
          items,
        },
        user,
        meta,
      );
    }

    throw new BadRequestException(`Operation type '${dto.operationType}' not yet supported for automated GL posting.`);
  }
}
