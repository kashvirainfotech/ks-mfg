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
  CreateBankAccountDto,
  CreatePaymentDisbursementDto,
  CreateCustomerReceiptDto,
  ImportBankStatementLineDto,
  FinalizeBrsDto,
} from './banking.dto';

@Injectable()
export class BankingService {
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

    // Total Liquid Bank & Cash Balances
    const bankSql = `
      SELECT
        COALESCE(SUM(current_balance), 0)::NUMERIC(15,2) AS total_liquidity,
        COUNT(*)::INT AS total_accounts
      FROM tbl_acc_bank_account
      WHERE comp_id = $1 AND is_active = TRUE;
    `;
    const bankRes = await this.pool.query(bankSql, [compId]);
    const { total_liquidity, total_accounts } = bankRes.rows[0] || {};

    // Total Accounts Payable (AP) Due to Vendors
    const apSql = `
      SELECT
        COALESCE(SUM(balance_amount), 0)::NUMERIC(15,2) AS total_ap_due,
        COUNT(*)::INT AS open_purchase_invoices
      FROM tbl_pur_invoice_header
      WHERE comp_id = $1 AND is_active = TRUE AND payment_status != 'PAID';
    `;
    const apRes = await this.pool.query(apSql, [compId]);
    const { total_ap_due, open_purchase_invoices } = apRes.rows[0] || {};

    // Total Accounts Receivable (AR) Due from Customers
    const arSql = `
      SELECT
        COALESCE(SUM(balance_amount), 0)::NUMERIC(15,2) AS total_ar_due,
        COUNT(*)::INT AS open_sales_invoices
      FROM tbl_sales_invoice_header
      WHERE comp_id = $1 AND is_active = TRUE AND payment_status != 'PAID';
    `;
    const arRes = await this.pool.query(arSql, [compId]);
    const { total_ar_due, open_sales_invoices } = arRes.rows[0] || {};

    // Unreconciled BRS Transactions count
    const brsSql = `
      SELECT
        (SELECT COUNT(*)::INT FROM tbl_acc_bank_statement_line WHERE comp_id = $1 AND reconciliation_status = 'UNRECONCILED' AND is_active = TRUE) AS unreconciled_feed_count,
        (SELECT COUNT(*)::INT FROM tbl_acc_customer_receipt WHERE comp_id = $1 AND branch_id = $2 AND clearance_status = 'UNCLEARED' AND is_active = TRUE) AS uncleared_cheques_count;
    `;
    const brsRes = await this.pool.query(brsSql, [compId, branchId]);
    const { unreconciled_feed_count, uncleared_cheques_count } = brsRes.rows[0] || {};

    // Recent Disbursements
    const recentDisbSql = `
      SELECT
        d.disbursement_id,
        d.voucher_no,
        d.voucher_date,
        p.party_name AS vendor_name,
        d.payment_mode,
        d.payment_ref_no,
        d.total_net_paid,
        d.status
      FROM tbl_acc_payment_disbursement d
      LEFT JOIN tbl_crm_party p ON d.party_id = p.party_id
      WHERE d.comp_id = $1 AND d.branch_id = $2 AND d.is_active = TRUE
      ORDER BY d.voucher_date DESC, d.disbursement_id DESC
      LIMIT 5;
    `;
    const recentDisbRes = await this.pool.query(recentDisbSql, [compId, branchId]);

    // Recent Receipts
    const recentRecSql = `
      SELECT
        r.receipt_id,
        r.receipt_no,
        r.receipt_date,
        p.party_name AS customer_name,
        r.receipt_mode,
        r.instrument_ref_no,
        r.clearance_status,
        r.total_net_received,
        r.status
      FROM tbl_acc_customer_receipt r
      LEFT JOIN tbl_crm_party p ON r.party_id = p.party_id
      WHERE r.comp_id = $1 AND r.branch_id = $2 AND r.is_active = TRUE
      ORDER BY r.receipt_date DESC, r.receipt_id DESC
      LIMIT 5;
    `;
    const recentRecRes = await this.pool.query(recentRecSql, [compId, branchId]);

    return {
      totalLiquidity: Number(total_liquidity || 0),
      totalAccounts: Number(total_accounts || 0),
      totalApDue: Number(total_ap_due || 0),
      openPurchaseInvoices: Number(open_purchase_invoices || 0),
      totalArDue: Number(total_ar_due || 0),
      openSalesInvoices: Number(open_sales_invoices || 0),
      unreconciledFeedCount: Number(unreconciled_feed_count || 0),
      unclearedChequesCount: Number(uncleared_cheques_count || 0),
      recentDisbursements: recentDisbRes.rows,
      recentReceipts: recentRecRes.rows,
    };
  }

  // ==========================================================================
  // 1.1 Lookups for Banking, AP & AR
  // ==========================================================================
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const partiesRes = await this.pool.query(
      `SELECT party_id, party_code, party_name, is_supplier, is_customer, pan_no, credit_days, payment_terms
       FROM tbl_crm_party WHERE comp_id = $1 AND is_active = TRUE ORDER BY party_name ASC;`,
      [compId]
    );

    const bankAccRes = await this.pool.query(
      `SELECT b.bank_account_id, b.account_code, b.account_name, b.bank_name, b.account_number, b.account_type, b.gl_account_id, b.current_balance
       FROM tbl_acc_bank_account b WHERE b.comp_id = $1 AND b.is_active = TRUE ORDER BY b.account_code ASC;`,
      [compId]
    );

    const glAccRes = await this.pool.query(
      `SELECT account_id, account_code, account_name, account_type
       FROM tbl_acc_chart_of_accounts
       WHERE comp_id = $1 AND is_active = TRUE AND is_group = FALSE
       ORDER BY account_code ASC;`,
      [compId]
    );

    return {
      parties: partiesRes.rows,
      bankAccounts: bankAccRes.rows,
      glAccounts: glAccRes.rows,
    };
  }

  // ==========================================================================
  // 2. Bank Accounts Master
  // ==========================================================================
  async getBankAccounts(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const sql = `
      SELECT
        b.bank_account_id,
        b.account_code,
        b.account_name,
        b.bank_name,
        b.branch_name,
        b.account_number,
        b.account_type,
        b.ifsc_code,
        b.swift_code,
        b.currency_code,
        b.gl_account_id,
        c.account_code AS gl_account_code,
        c.account_name AS gl_account_name,
        b.opening_balance,
        b.current_balance,
        b.od_limit,
        b.is_active
      FROM tbl_acc_bank_account b
      LEFT JOIN tbl_acc_chart_of_accounts c ON b.gl_account_id = c.account_id
      WHERE b.comp_id = $1 AND b.is_active = TRUE
      ORDER BY b.account_code ASC;
    `;
    const res = await this.pool.query(sql, [compId]);
    return res.rows;
  }

  async createBankAccount(dto: CreateBankAccountDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    // Check unique code and account number
    const checkSql = `
      SELECT bank_account_id FROM tbl_acc_bank_account
      WHERE comp_id = $1 AND (account_code = $2 OR account_number = $3);
    `;
    const checkRes = await this.pool.query(checkSql, [compId, dto.accountCode, dto.accountNumber]);
    if (checkRes.rows.length > 0) {
      throw new BadRequestException('A bank account with this Account Code or Account Number already exists.');
    }

    const insertSql = `
      INSERT INTO tbl_acc_bank_account (
        account_code, account_name, bank_name, branch_name, account_number,
        account_type, ifsc_code, swift_code, currency_code, gl_account_id,
        opening_balance, current_balance, od_limit, is_active,
        comp_id, branch_id, fyear_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, TRUE, $14, $15, $16, $17)
      RETURNING *;
    `;
    const openingBal = Number(dto.openingBalance || 0);
    const res = await this.pool.query(insertSql, [
      dto.accountCode,
      dto.accountName,
      dto.bankName,
      dto.branchName,
      dto.accountNumber,
      dto.accountType || 'CURRENT',
      dto.ifscCode || null,
      dto.swiftCode || null,
      dto.currencyCode || 'INR',
      dto.glAccountId,
      openingBal,
      openingBal,
      Number(dto.odLimit || 0),
      compId,
      branchId,
      fyearId,
      userId,
    ]);

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'BANKING_ACCOUNTS',
      actionType: 'ADD',
      entityTable: 'tbl_acc_bank_account',
      recordId: res.rows[0].bank_account_id,
      newValue: res.rows[0],
      compId,
      branchId,
      fyearId,
    });

    return res.rows[0];
  }

  // ==========================================================================
  // 3. Accounts Payable (AP) Vendor Payments
  // ==========================================================================
  async getDisbursements(user: AuthenticatedUserContext, filters?: { bankAccountId?: number; partyId?: number }) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    let query = `
      SELECT
        d.disbursement_id,
        d.voucher_no,
        d.voucher_date,
        d.bank_account_id,
        b.account_name AS bank_account_name,
        b.account_number AS bank_account_number,
        d.party_id,
        p.party_name AS vendor_name,
        p.pan_no AS vendor_pan,
        d.payment_mode,
        d.payment_ref_no,
        d.instrument_date,
        d.cheque_clearance_status,
        d.clearance_date,
        d.total_gross_settled,
        d.total_tds_deducted,
        d.total_discount_received,
        d.total_net_paid,
        d.narration,
        d.status,
        d.posted_journal_id,
        j.voucher_no AS journal_voucher_no,
        d.created_date
      FROM tbl_acc_payment_disbursement d
      LEFT JOIN tbl_acc_bank_account b ON d.bank_account_id = b.bank_account_id
      LEFT JOIN tbl_crm_party p ON d.party_id = p.party_id
      LEFT JOIN tbl_acc_journal_header j ON d.posted_journal_id = j.journal_id
      WHERE d.comp_id = $1 AND d.branch_id = $2 AND d.is_active = TRUE
    `;
    const params: any[] = [compId, branchId];
    let idx = 3;

    if (filters?.bankAccountId) {
      query += ` AND d.bank_account_id = $${idx++}`;
      params.push(filters.bankAccountId);
    }
    if (filters?.partyId) {
      query += ` AND d.party_id = $${idx++}`;
      params.push(filters.partyId);
    }

    query += ` ORDER BY d.voucher_date DESC, d.disbursement_id DESC;`;
    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async getDisbursementById(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const headerSql = `
      SELECT
        d.*,
        b.account_name AS bank_account_name,
        b.bank_name,
        b.account_number AS bank_account_number,
        p.party_name AS vendor_name,
        p.party_code AS vendor_code,
        p.pan_no AS vendor_pan,
        j.voucher_no AS journal_voucher_no
      FROM tbl_acc_payment_disbursement d
      LEFT JOIN tbl_acc_bank_account b ON d.bank_account_id = b.bank_account_id
      LEFT JOIN tbl_crm_party p ON d.party_id = p.party_id
      LEFT JOIN tbl_acc_journal_header j ON d.posted_journal_id = j.journal_id
      WHERE d.disbursement_id = $1 AND d.comp_id = $2 AND d.branch_id = $3;
    `;
    const headerRes = await this.pool.query(headerSql, [id, compId, branchId]);
    if (headerRes.rows.length === 0) {
      throw new NotFoundException(`Payment Disbursement voucher #${id} not found.`);
    }

    const itemsSql = `
      SELECT * FROM tbl_acc_payment_disbursement_item
      WHERE disbursement_id = $1 AND is_active = TRUE
      ORDER BY disbursement_item_id ASC;
    `;
    const itemsRes = await this.pool.query(itemsSql, [id]);

    return {
      ...headerRes.rows[0],
      items: itemsRes.rows,
    };
  }

  async getPendingPurchaseInvoices(partyId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const sql = `
      SELECT
        invoice_id,
        invoice_no,
        invoice_date,
        vendor_invoice_no,
        vendor_invoice_date,
        due_date,
        net_payable_amount,
        paid_amount,
        balance_amount,
        payment_status,
        status
      FROM tbl_pur_invoice_header
      WHERE comp_id = $1 AND vendor_id = $2 AND is_active = TRUE AND payment_status != 'PAID'
      ORDER BY due_date ASC, invoice_id ASC;
    `;
    const res = await this.pool.query(sql, [compId, partyId]);
    return res.rows;
  }

  async createDisbursement(dto: CreatePaymentDisbursementDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch bank account details
      const bankRes = await client.query(
        `SELECT bank_account_id, gl_account_id, account_name, current_balance FROM tbl_acc_bank_account WHERE bank_account_id = $1 AND comp_id = $2;`,
        [dto.bankAccountId, compId]
      );
      if (bankRes.rows.length === 0) {
        throw new BadRequestException('Selected bank account does not exist.');
      }
      const bank = bankRes.rows[0];

      // 2. Generate disbursement voucher no from series
      const seriesRes = await client.query(
        `SELECT series_code, prefix_template, current_next_no, padding_digits
         FROM tbl_sys_doc_number_series
         WHERE target_comp_id = $1 AND target_branch_id = $2 AND series_code = 'AHM-PAY-2627'
         FOR UPDATE;`,
        [compId, branchId]
      );

      let voucherNo: string;
      if (seriesRes.rows.length > 0) {
        const s = seriesRes.rows[0];
        const nextNum = s.current_next_no;
        const pad = s.padding_digits || 4;
        voucherNo = `${s.prefix_template}${String(nextNum).padStart(pad, '0')}`;
        await client.query(
          `UPDATE tbl_sys_doc_number_series SET current_next_no = current_next_no + 1 WHERE target_comp_id = $1 AND target_branch_id = $2 AND series_code = 'AHM-PAY-2627';`,
          [compId, branchId]
        );
      } else {
        voucherNo = `PAY-AHM-2627-${Date.now().toString().slice(-4)}`;
      }

      // 3. Create Balanced Double-Entry Journal Voucher (JV)
      // Debit: Trade Creditors Control Account (1201)
      // Credit: Bank Account (bank.gl_account_id)
      // Credit: TDS Payable (1214) if any TDS deducted
      // Credit: Discount Received (412001) if any discount
      const jvSeriesRes = await client.query(
        `SELECT prefix_template, current_next_no, padding_digits
         FROM tbl_sys_doc_number_series
         WHERE target_comp_id = $1 AND target_branch_id = $2 AND series_code = 'AHM-JV-2627'
         FOR UPDATE;`,
        [compId, branchId]
      );
      let jvNo: string;
      if (jvSeriesRes.rows.length > 0) {
        const js = jvSeriesRes.rows[0];
        jvNo = `${js.prefix_template}${String(js.current_next_no).padStart(js.padding_digits || 4, '0')}`;
        await client.query(
          `UPDATE tbl_sys_doc_number_series SET current_next_no = current_next_no + 1 WHERE target_comp_id = $1 AND target_branch_id = $2 AND series_code = 'AHM-JV-2627';`,
          [compId, branchId]
        );
      } else {
        jvNo = `JV-AHM-2627-${Date.now().toString().slice(-4)}`;
      }

      const grossSettled = Number(dto.totalGrossSettled);
      const netPaid = Number(dto.totalNetPaid);
      const tdsAmount = Number(dto.totalTdsDeducted || 0);
      const discount = Number(dto.totalDiscountReceived || 0);

      // Verify double-entry balance: grossSettled = netPaid + tdsAmount + discount
      const calculatedCredit = Math.round((netPaid + tdsAmount + discount) * 100) / 100;
      if (Math.abs(grossSettled - calculatedCredit) > 0.05) {
        throw new BadRequestException(
          `Voucher out of balance: Gross Settled (₹${grossSettled}) must equal Net Paid (₹${netPaid}) + TDS (₹${tdsAmount}) + Discount (₹${discount}).`
        );
      }

      const jvHeaderSql = `
        INSERT INTO tbl_acc_journal_header (
          voucher_no, voucher_date, voucher_type, source_module, source_ref_no,
          narration, total_debit, total_credit, is_posted, posted_by, posted_date, status, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES ($1, $2, 'PAYMENT', 'PROCUREMENT', $3, $4, $5, $5, TRUE, $6, CURRENT_TIMESTAMP, 'POSTED', TRUE, $7, $8, $9, $6)
        RETURNING journal_id;
      `;
      const jvHeaderRes = await client.query(jvHeaderSql, [
        jvNo,
        dto.voucherDate,
        voucherNo,
        dto.narration,
        grossSettled,
        userId,
        compId,
        branchId,
        fyearId,
      ]);
      const journalId = jvHeaderRes.rows[0].journal_id;

      // Journal Line 1: Debit Trade Creditors (Account 1201)
      await client.query(
        `INSERT INTO tbl_acc_journal_item (
          journal_id, account_id, debit_amount, credit_amount, party_id, line_narration, line_no,
          is_active, comp_id, branch_id, fyear_id, created_by
        ) VALUES ($1, 1201, $2, 0.00, $3, $4, 1, TRUE, $5, $6, $7, $8);`,
        [journalId, grossSettled, dto.partyId, dto.narration, compId, branchId, fyearId, userId]
      );

      // Journal Line 2: Credit Bank Account
      await client.query(
        `INSERT INTO tbl_acc_journal_item (
          journal_id, account_id, debit_amount, credit_amount, party_id, line_narration, line_no,
          is_active, comp_id, branch_id, fyear_id, created_by
        ) VALUES ($1, $2, 0.00, $3, NULL, $4, 2, TRUE, $5, $6, $7, $8);`,
        [journalId, bank.gl_account_id, netPaid, `Payment via ${dto.paymentMode} Ref: ${dto.paymentRefNo}`, compId, branchId, fyearId, userId]
      );

      // Journal Line 3: Credit TDS Payable (Account 1214) if applicable
      if (tdsAmount > 0) {
        await client.query(
          `INSERT INTO tbl_acc_journal_item (
            journal_id, account_id, debit_amount, credit_amount, party_id, line_narration, line_no,
            is_active, comp_id, branch_id, fyear_id, created_by
          ) VALUES ($1, 1214, 0.00, $2, $3, 'TDS Deducted at Source', 3, TRUE, $4, $5, $6, $7);`,
          [journalId, tdsAmount, dto.partyId, compId, branchId, fyearId, userId]
        );
      }

      // 4. Insert Disbursement Header
      const disbHeaderSql = `
        INSERT INTO tbl_acc_payment_disbursement (
          voucher_no, voucher_date, bank_account_id, party_id, payment_mode, payment_ref_no,
          instrument_date, cheque_clearance_status, clearance_date, total_gross_settled, total_tds_deducted,
          total_discount_received, total_net_paid, narration, status, posted_journal_id, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'POSTED', $15, TRUE, $16, $17, $18, $19)
        RETURNING *;
      `;
      const disbHeaderRes = await client.query(disbHeaderSql, [
        voucherNo,
        dto.voucherDate,
        dto.bankAccountId,
        dto.partyId,
        dto.paymentMode,
        dto.paymentRefNo,
        dto.instrumentDate || dto.voucherDate,
        dto.chequeClearanceStatus || 'CLEARED',
        dto.clearanceDate || (dto.chequeClearanceStatus === 'ISSUED' ? null : dto.voucherDate),
        grossSettled,
        tdsAmount,
        discount,
        netPaid,
        dto.narration,
        journalId,
        compId,
        branchId,
        fyearId,
        userId,
      ]);
      const disbursementId = disbHeaderRes.rows[0].disbursement_id;

      // 5. Insert Line Items and Update Purchase Invoices
      for (const item of dto.items) {
        await client.query(
          `INSERT INTO tbl_acc_payment_disbursement_item (
            disbursement_id, invoice_id, invoice_no, invoice_date, gross_settled_amount,
            tds_section, tds_rate, tds_deducted_amount, discount_received_amount, net_paid_amount,
            line_narration, is_active, comp_id, branch_id, fyear_id, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, $12, $13, $14, $15);`,
          [
            disbursementId,
            item.invoiceId || null,
            item.invoiceNo || null,
            item.invoiceDate || null,
            Number(item.grossSettledAmount),
            item.tdsSection || '194Q',
            Number(item.tdsRate || 0),
            Number(item.tdsDeductedAmount || 0),
            Number(item.discountReceivedAmount || 0),
            Number(item.netPaidAmount),
            item.lineNarration || null,
            compId,
            branchId,
            fyearId,
            userId,
          ]
        );

        if (item.invoiceId) {
          // Adjust invoice paid and balance amounts
          const invRes = await client.query(
            `SELECT net_payable_amount, paid_amount, balance_amount FROM tbl_pur_invoice_header WHERE invoice_id = $1 FOR UPDATE;`,
            [item.invoiceId]
          );
          if (invRes.rows.length > 0) {
            const currentPaid = Number(invRes.rows[0].paid_amount || 0);
            const netPayable = Number(invRes.rows[0].net_payable_amount || 0);
            const newPaid = Math.min(netPayable, currentPaid + Number(item.grossSettledAmount));
            const newBalance = Math.max(0, netPayable - newPaid);
            const newStatus = newBalance <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';

            await client.query(
              `UPDATE tbl_pur_invoice_header
               SET paid_amount = $1, balance_amount = $2, payment_status = $3
               WHERE invoice_id = $4;`,
              [newPaid, newBalance, newStatus, item.invoiceId]
            );
          }
        }
      }

      // 6. Update Bank Account Balance (Deduct net paid)
      await client.query(
        `UPDATE tbl_acc_bank_account
         SET current_balance = current_balance - $1, updated_date = CURRENT_TIMESTAMP
         WHERE bank_account_id = $2;`,
        [netPaid, dto.bankAccountId]
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'BANKING_ACCOUNTS',
        actionType: 'DISBURSE',
        entityTable: 'tbl_acc_payment_disbursement',
        recordId: disbursementId,
        newValue: { disbursementId, voucherNo, netPaid, ...dto },
        compId,
        branchId,
        fyearId,
      });

      return {
        ...disbHeaderRes.rows[0],
        journalVoucherNo: jvNo,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // 4. Accounts Receivable (AR) Customer Collections
  // ==========================================================================
  async getReceipts(user: AuthenticatedUserContext, filters?: { bankAccountId?: number; partyId?: number }) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    let query = `
      SELECT
        r.receipt_id,
        r.receipt_no,
        r.receipt_date,
        r.bank_account_id,
        b.account_name AS bank_account_name,
        b.account_number AS bank_account_number,
        r.party_id,
        p.party_name AS customer_name,
        p.pan_no AS customer_pan,
        r.receipt_mode,
        r.instrument_ref_no,
        r.instrument_date,
        r.clearance_status,
        r.clearance_date,
        r.total_gross_settled,
        r.total_tds_deducted_by_cust,
        r.total_discount_given,
        r.total_net_received,
        r.narration,
        r.status,
        r.posted_journal_id,
        j.voucher_no AS journal_voucher_no,
        r.created_date
      FROM tbl_acc_customer_receipt r
      LEFT JOIN tbl_acc_bank_account b ON r.bank_account_id = b.bank_account_id
      LEFT JOIN tbl_crm_party p ON r.party_id = p.party_id
      LEFT JOIN tbl_acc_journal_header j ON r.posted_journal_id = j.journal_id
      WHERE r.comp_id = $1 AND r.branch_id = $2 AND r.is_active = TRUE
    `;
    const params: any[] = [compId, branchId];
    let idx = 3;

    if (filters?.bankAccountId) {
      query += ` AND r.bank_account_id = $${idx++}`;
      params.push(filters.bankAccountId);
    }
    if (filters?.partyId) {
      query += ` AND r.party_id = $${idx++}`;
      params.push(filters.partyId);
    }

    query += ` ORDER BY r.receipt_date DESC, r.receipt_id DESC;`;
    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async getReceiptById(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const headerSql = `
      SELECT
        r.*,
        b.account_name AS bank_account_name,
        b.bank_name,
        b.account_number AS bank_account_number,
        p.party_name AS customer_name,
        p.party_code AS customer_code,
        p.pan_no AS customer_pan,
        j.voucher_no AS journal_voucher_no
      FROM tbl_acc_customer_receipt r
      LEFT JOIN tbl_acc_bank_account b ON r.bank_account_id = b.bank_account_id
      LEFT JOIN tbl_crm_party p ON r.party_id = p.party_id
      LEFT JOIN tbl_acc_journal_header j ON r.posted_journal_id = j.journal_id
      WHERE r.receipt_id = $1 AND r.comp_id = $2 AND r.branch_id = $3;
    `;
    const headerRes = await this.pool.query(headerSql, [id, compId, branchId]);
    if (headerRes.rows.length === 0) {
      throw new NotFoundException(`Customer Receipt voucher #${id} not found.`);
    }

    const itemsSql = `
      SELECT * FROM tbl_acc_customer_receipt_item
      WHERE receipt_id = $1 AND is_active = TRUE
      ORDER BY receipt_item_id ASC;
    `;
    const itemsRes = await this.pool.query(itemsSql, [id]);

    return {
      ...headerRes.rows[0],
      items: itemsRes.rows,
    };
  }

  async getPendingSalesInvoices(partyId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const sql = `
      SELECT
        invoice_id,
        invoice_no,
        invoice_date,
        total_invoice_amount,
        paid_amount,
        balance_amount,
        payment_status,
        status
      FROM tbl_sales_invoice_header
      WHERE comp_id = $1 AND customer_id = $2 AND is_active = TRUE AND payment_status != 'PAID'
      ORDER BY invoice_date ASC, invoice_id ASC;
    `;
    const res = await this.pool.query(sql, [compId, partyId]);
    return res.rows;
  }

  async createReceipt(dto: CreateCustomerReceiptDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch bank account details
      const bankRes = await client.query(
        `SELECT bank_account_id, gl_account_id, account_name, current_balance FROM tbl_acc_bank_account WHERE bank_account_id = $1 AND comp_id = $2;`,
        [dto.bankAccountId, compId]
      );
      if (bankRes.rows.length === 0) {
        throw new BadRequestException('Selected bank account does not exist.');
      }
      const bank = bankRes.rows[0];

      // 2. Generate receipt voucher no from series
      const seriesRes = await client.query(
        `SELECT series_code, prefix_template, current_next_no, padding_digits
         FROM tbl_sys_doc_number_series
         WHERE target_comp_id = $1 AND target_branch_id = $2 AND series_code = 'AHM-REC-2627'
         FOR UPDATE;`,
        [compId, branchId]
      );

      let receiptNo: string;
      if (seriesRes.rows.length > 0) {
        const s = seriesRes.rows[0];
        const nextNum = s.current_next_no;
        const pad = s.padding_digits || 4;
        receiptNo = `${s.prefix_template}${String(nextNum).padStart(pad, '0')}`;
        await client.query(
          `UPDATE tbl_sys_doc_number_series SET current_next_no = current_next_no + 1 WHERE target_comp_id = $1 AND target_branch_id = $2 AND series_code = 'AHM-REC-2627';`,
          [compId, branchId]
        );
      } else {
        receiptNo = `REC-AHM-2627-${Date.now().toString().slice(-4)}`;
      }

      const grossSettled = Number(dto.totalGrossSettled);
      const netReceived = Number(dto.totalNetReceived);
      const custTds = Number(dto.totalTdsDeductedByCust || 0);
      const discount = Number(dto.totalDiscountGiven || 0);

      // Verify balance: netReceived + custTds + discount = grossSettled
      const calculatedSettled = Math.round((netReceived + custTds + discount) * 100) / 100;
      if (Math.abs(grossSettled - calculatedSettled) > 0.05) {
        throw new BadRequestException(
          `Receipt out of balance: Gross Settled (₹${grossSettled}) must equal Net Received (₹${netReceived}) + Customer TDS (₹${custTds}) + Cash Discount (₹${discount}).`
        );
      }

      let journalId: number | null = null;
      let jvNo: string | null = null;

      // If cleared, post Balanced Journal Voucher immediately:
      // Dr: Bank Account (glAccountId) for netReceived
      // Dr: TDS Receivable (1131) for custTds (if > 0)
      // Cr: Trade Debtors Control Account (1111) for grossSettled
      if (dto.clearanceStatus !== 'UNCLEARED') {
        const jvSeriesRes = await client.query(
          `SELECT prefix_template, current_next_no, padding_digits
           FROM tbl_sys_doc_number_series
           WHERE target_comp_id = $1 AND target_branch_id = $2 AND series_code = 'AHM-JV-2627'
           FOR UPDATE;`,
          [compId, branchId]
        );
        if (jvSeriesRes.rows.length > 0) {
          const js = jvSeriesRes.rows[0];
          jvNo = `${js.prefix_template}${String(js.current_next_no).padStart(js.padding_digits || 4, '0')}`;
          await client.query(
            `UPDATE tbl_sys_doc_number_series SET current_next_no = current_next_no + 1 WHERE target_comp_id = $1 AND target_branch_id = $2 AND series_code = 'AHM-JV-2627';`,
            [compId, branchId]
          );
        } else {
          jvNo = `JV-AHM-2627-${Date.now().toString().slice(-4)}`;
        }

        const jvHeaderSql = `
          INSERT INTO tbl_acc_journal_header (
            voucher_no, voucher_date, voucher_type, source_module, source_ref_no,
            narration, total_debit, total_credit, is_posted, posted_by, posted_date, status, is_active,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES ($1, $2, 'RECEIPT', 'SALES', $3, $4, $5, $5, TRUE, $6, CURRENT_TIMESTAMP, 'POSTED', TRUE, $7, $8, $9, $6)
          RETURNING journal_id;
        `;
        const jvHeaderRes = await client.query(jvHeaderSql, [
          jvNo,
          dto.receiptDate,
          receiptNo,
          dto.narration,
          grossSettled,
          userId,
          compId,
          branchId,
          fyearId,
        ]);
        journalId = jvHeaderRes.rows[0].journal_id;

        // Journal Line 1: Debit Bank Account
        await client.query(
          `INSERT INTO tbl_acc_journal_item (
            journal_id, account_id, debit_amount, credit_amount, party_id, line_narration, line_no,
            is_active, comp_id, branch_id, fyear_id, created_by
          ) VALUES ($1, $2, $3, 0.00, NULL, $4, 1, TRUE, $5, $6, $7, $8);`,
          [journalId, bank.gl_account_id, netReceived, `Collection via ${dto.receiptMode} Ref: ${dto.instrumentRefNo}`, compId, branchId, fyearId, userId]
        );

        // Journal Line 2: Debit TDS Receivable (Account 1131) if customer withheld TDS
        if (custTds > 0) {
          await client.query(
            `INSERT INTO tbl_acc_journal_item (
              journal_id, account_id, debit_amount, credit_amount, party_id, line_narration, line_no,
              is_active, comp_id, branch_id, fyear_id, created_by
            ) VALUES ($1, 1131, $2, 0.00, $3, 'Customer Withheld TDS Receivable', 2, TRUE, $4, $5, $6, $7);`,
            [journalId, custTds, dto.partyId, compId, branchId, fyearId, userId]
          );
        }

        // Journal Line 3: Credit Trade Debtors (Account 1111)
        await client.query(
          `INSERT INTO tbl_acc_journal_item (
            journal_id, account_id, debit_amount, credit_amount, party_id, line_narration, line_no,
            is_active, comp_id, branch_id, fyear_id, created_by
          ) VALUES ($1, 1111, 0.00, $2, $3, $4, 3, TRUE, $5, $6, $7, $8);`,
          [journalId, grossSettled, dto.partyId, dto.narration, compId, branchId, fyearId, userId]
        );

        // Update Bank Balance immediately if cleared
        await client.query(
          `UPDATE tbl_acc_bank_account
           SET current_balance = current_balance + $1, updated_date = CURRENT_TIMESTAMP
           WHERE bank_account_id = $2;`,
          [netReceived, dto.bankAccountId]
        );
      }

      // 4. Insert Receipt Header
      const recHeaderSql = `
        INSERT INTO tbl_acc_customer_receipt (
          receipt_no, receipt_date, bank_account_id, party_id, receipt_mode, instrument_ref_no,
          instrument_date, clearance_status, clearance_date, total_gross_settled, total_tds_deducted_by_cust,
          total_discount_given, total_net_received, narration, status, posted_journal_id, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'POSTED', $15, TRUE, $16, $17, $18, $19)
        RETURNING *;
      `;
      const recHeaderRes = await client.query(recHeaderSql, [
        receiptNo,
        dto.receiptDate,
        dto.bankAccountId,
        dto.partyId,
        dto.receiptMode,
        dto.instrumentRefNo,
        dto.instrumentDate || dto.receiptDate,
        dto.clearanceStatus || 'CLEARED',
        dto.clearanceDate || (dto.clearanceStatus === 'UNCLEARED' ? null : dto.receiptDate),
        grossSettled,
        custTds,
        discount,
        netReceived,
        dto.narration,
        journalId,
        compId,
        branchId,
        fyearId,
        userId,
      ]);
      const receiptId = recHeaderRes.rows[0].receipt_id;

      // 5. Insert Line Items and Update Sales Invoices
      for (const item of dto.items) {
        await client.query(
          `INSERT INTO tbl_acc_customer_receipt_item (
            receipt_id, invoice_id, invoice_no, invoice_date, gross_settled_amount,
            tds_deducted_by_cust, discount_given_amount, net_received_amount,
            line_narration, is_active, comp_id, branch_id, fyear_id, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, $11, $12, $13);`,
          [
            receiptId,
            item.invoiceId || null,
            item.invoiceNo || null,
            item.invoiceDate || null,
            Number(item.grossSettledAmount),
            Number(item.tdsDeductedByCust || 0),
            Number(item.discountGivenAmount || 0),
            Number(item.netReceivedAmount),
            item.lineNarration || null,
            compId,
            branchId,
            fyearId,
            userId,
          ]
        );

        if (item.invoiceId) {
          const invRes = await client.query(
            `SELECT total_invoice_amount, paid_amount, balance_amount FROM tbl_sales_invoice_header WHERE invoice_id = $1 FOR UPDATE;`,
            [item.invoiceId]
          );
          if (invRes.rows.length > 0) {
            const currentPaid = Number(invRes.rows[0].paid_amount || 0);
            const totalInvoice = Number(invRes.rows[0].total_invoice_amount || 0);
            const newPaid = Math.min(totalInvoice, currentPaid + Number(item.grossSettledAmount));
            const newBalance = Math.max(0, totalInvoice - newPaid);
            const newStatus = newBalance <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';

            await client.query(
              `UPDATE tbl_sales_invoice_header
               SET paid_amount = $1, balance_amount = $2, payment_status = $3
               WHERE invoice_id = $4;`,
              [newPaid, newBalance, newStatus, item.invoiceId]
            );
          }
        }
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'BANKING_ACCOUNTS',
        actionType: 'RECEIVE',
        entityTable: 'tbl_acc_customer_receipt',
        recordId: receiptId,
        newValue: { receiptId, receiptNo, netReceived, ...dto },
        compId,
        branchId,
        fyearId,
      });

      return {
        ...recHeaderRes.rows[0],
        journalVoucherNo: jvNo,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // 5. Bank Reconciliation (BRS) Engine
  // ==========================================================================
  async getStatementLines(bankAccountId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const sql = `
      SELECT
        statement_line_id,
        bank_account_id,
        txn_date,
        value_date,
        description,
        ref_cheque_no,
        debit_withdrawal,
        credit_deposit,
        running_balance,
        reconciliation_status,
        matched_entity_type,
        matched_entity_id,
        reconciled_date
      FROM tbl_acc_bank_statement_line
      WHERE bank_account_id = $1 AND comp_id = $2 AND is_active = TRUE
      ORDER BY txn_date DESC, statement_line_id DESC;
    `;
    const res = await this.pool.query(sql, [bankAccountId, compId]);
    return res.rows;
  }

  async importStatementLine(dto: ImportBankStatementLineDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const sql = `
      INSERT INTO tbl_acc_bank_statement_line (
        bank_account_id, txn_date, value_date, description, ref_cheque_no,
        debit_withdrawal, credit_deposit, running_balance, reconciliation_status,
        is_active, comp_id, branch_id, fyear_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'UNRECONCILED', TRUE, $9, $10, $11, $12)
      RETURNING *;
    `;
    const res = await this.pool.query(sql, [
      dto.bankAccountId,
      dto.txnDate,
      dto.valueDate || dto.txnDate,
      dto.description,
      dto.refChequeNo || null,
      Number(dto.debitWithdrawal || 0),
      Number(dto.creditDeposit || 0),
      Number(dto.runningBalance || 0),
      compId,
      branchId,
      fyearId,
      userId,
    ]);

    return res.rows[0];
  }

  async getReconciliationSummary(bankAccountId: number, cutoffDate: string, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // 1. Fetch Bank Account Info
    const bankRes = await this.pool.query(
      `SELECT bank_account_id, gl_account_id, account_name, account_number, current_balance
       FROM tbl_acc_bank_account
       WHERE bank_account_id = $1 AND comp_id = $2;`,
      [bankAccountId, compId]
    );
    if (bankRes.rows.length === 0) {
      throw new NotFoundException(`Bank account #${bankAccountId} not found.`);
    }
    const bank = bankRes.rows[0];

    // 2. Compute General Ledger Bank Book Balance up to cutoffDate
    const glBalSql = `
      SELECT
        COALESCE(SUM(i.debit_amount - i.credit_amount), 0)::NUMERIC(15,2) AS gl_book_balance
      FROM tbl_acc_journal_item i
      JOIN tbl_acc_journal_header h ON i.journal_id = h.journal_id
      WHERE i.account_id = $1
        AND h.voucher_date <= $2
        AND h.is_posted = TRUE
        AND h.status = 'POSTED'
        AND i.comp_id = $3
        AND i.is_active = TRUE;
    `;
    const glBalRes = await this.pool.query(glBalSql, [bank.gl_account_id, cutoffDate, compId]);
    const glBookBalance = Number(glBalRes.rows[0]?.gl_book_balance || bank.current_balance || 0);

    // 3. Cheques Issued but Not Yet Presented in Bank (Disbursements issued on/before cutoffDate where cheque_clearance_status = 'ISSUED' or not matched in statement feed)
    const unpresentedSql = `
      SELECT
        d.disbursement_id,
        d.voucher_no,
        d.voucher_date,
        p.party_name AS vendor_name,
        d.payment_ref_no,
        d.total_net_paid
      FROM tbl_acc_payment_disbursement d
      LEFT JOIN tbl_crm_party p ON d.party_id = p.party_id
      WHERE d.bank_account_id = $1
        AND d.voucher_date <= $2
        AND d.cheque_clearance_status = 'ISSUED'
        AND d.status = 'POSTED'
        AND d.is_active = TRUE;
    `;
    const unpresentedRes = await this.pool.query(unpresentedSql, [bankAccountId, cutoffDate]);
    const unpresentedCheques = unpresentedRes.rows;
    const unpresentedTotal = unpresentedCheques.reduce((acc, c) => acc + Number(c.total_net_paid), 0);

    // 4. Cheques / Deposits Received but Not Yet Credited by Bank (Customer receipts where clearance_status = 'UNCLEARED')
    const uncreditedSql = `
      SELECT
        r.receipt_id,
        r.receipt_no,
        r.receipt_date,
        p.party_name AS customer_name,
        r.instrument_ref_no,
        r.total_net_received
      FROM tbl_acc_customer_receipt r
      LEFT JOIN tbl_crm_party p ON r.party_id = p.party_id
      WHERE r.bank_account_id = $1
        AND r.receipt_date <= $2
        AND r.clearance_status = 'UNCLEARED'
        AND r.status = 'POSTED'
        AND r.is_active = TRUE;
    `;
    const uncreditedRes = await this.pool.query(uncreditedSql, [bankAccountId, cutoffDate]);
    const uncreditedDeposits = uncreditedRes.rows;
    const uncreditedTotal = uncreditedDeposits.reduce((acc, c) => acc + Number(c.total_net_received), 0);

    // 5. Actual Bank Statement Balance from latest statement line on or before cutoffDate
    const stmtBalSql = `
      SELECT running_balance
      FROM tbl_acc_bank_statement_line
      WHERE bank_account_id = $1
        AND txn_date <= $2
        AND is_active = TRUE
      ORDER BY txn_date DESC, statement_line_id DESC
      LIMIT 1;
    `;
    const stmtBalRes = await this.pool.query(stmtBalSql, [bankAccountId, cutoffDate]);
    const actualStatementBalance = Number(stmtBalRes.rows[0]?.running_balance || bank.current_balance);

    // 6. Classical BRS Formula:
    // Balance as per ERP General Ledger Bank Book: glBookBalance
    // Add: Cheques Issued but Not Yet Presented in Bank: unpresentedTotal
    // Less: Cheques Deposited but Not Yet Credited by Bank: uncreditedTotal
    // Computed Bank Balance = glBookBalance + unpresentedTotal - uncreditedTotal
    const computedBankBalance = Math.round((glBookBalance + unpresentedTotal - uncreditedTotal) * 100) / 100;
    const varianceAmount = Math.round((actualStatementBalance - computedBankBalance) * 100) / 100;
    const isBalanced = Math.abs(varianceAmount) <= 0.05;

    return {
      bankAccountId,
      bankAccountName: bank.account_name,
      accountNumber: bank.account_number,
      cutoffDate,
      glBookBalance,
      unpresentedTotal,
      unpresentedCheques,
      uncreditedTotal,
      uncreditedDeposits,
      computedBankBalance,
      actualStatementBalance,
      varianceAmount,
      isBalanced,
    };
  }

  async autoMatch(bankAccountId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;

    let matchedCount = 0;

    // 1. Fetch unreconciled statement lines
    const stmtRes = await this.pool.query(
      `SELECT statement_line_id, ref_cheque_no, debit_withdrawal, credit_deposit
       FROM tbl_acc_bank_statement_line
       WHERE bank_account_id = $1 AND comp_id = $2 AND reconciliation_status = 'UNRECONCILED' AND is_active = TRUE;`,
      [bankAccountId, compId]
    );

    for (const stmt of stmtRes.rows) {
      if (!stmt.ref_cheque_no) continue;

      // Check against disbursements (debit from bank = withdrawal)
      if (Number(stmt.debit_withdrawal) > 0) {
        const disbRes = await this.pool.query(
          `SELECT disbursement_id FROM tbl_acc_payment_disbursement
           WHERE bank_account_id = $1 AND comp_id = $2 AND payment_ref_no = $3 AND total_net_paid = $4
           LIMIT 1;`,
          [bankAccountId, compId, stmt.ref_cheque_no, stmt.debit_withdrawal]
        );
        if (disbRes.rows.length > 0) {
          const disbId = disbRes.rows[0].disbursement_id;
          await this.pool.query(
            `UPDATE tbl_acc_bank_statement_line
             SET reconciliation_status = 'MATCHED', matched_entity_type = 'DISBURSEMENT', matched_entity_id = $1, reconciled_date = CURRENT_TIMESTAMP, reconciled_by = $2
             WHERE statement_line_id = $3;`,
            [disbId, userId, stmt.statement_line_id]
          );
          await this.pool.query(
            `UPDATE tbl_acc_payment_disbursement SET cheque_clearance_status = 'CLEARED', clearance_date = CURRENT_DATE WHERE disbursement_id = $1;`,
            [disbId]
          );
          matchedCount++;
          continue;
        }
      }

      // Check against customer receipts (credit into bank = deposit)
      if (Number(stmt.credit_deposit) > 0) {
        const recRes = await this.pool.query(
          `SELECT receipt_id FROM tbl_acc_customer_receipt
           WHERE bank_account_id = $1 AND comp_id = $2 AND instrument_ref_no = $3 AND total_net_received = $4
           LIMIT 1;`,
          [bankAccountId, compId, stmt.ref_cheque_no, stmt.credit_deposit]
        );
        if (recRes.rows.length > 0) {
          const recId = recRes.rows[0].receipt_id;
          await this.pool.query(
            `UPDATE tbl_acc_bank_statement_line
             SET reconciliation_status = 'MATCHED', matched_entity_type = 'RECEIPT', matched_entity_id = $1, reconciled_date = CURRENT_TIMESTAMP, reconciled_by = $2
             WHERE statement_line_id = $3;`,
            [recId, userId, stmt.statement_line_id]
          );
          await this.pool.query(
            `UPDATE tbl_acc_customer_receipt SET clearance_status = 'CLEARED', clearance_date = CURRENT_DATE WHERE receipt_id = $1;`,
            [recId]
          );
          matchedCount++;
        }
      }
    }

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'BANKING_ACCOUNTS',
      actionType: 'RECONCILE',
      entityTable: 'tbl_acc_bank_statement_line',
      recordId: bankAccountId,
      newValue: { bankAccountId, matchedCount },
      compId,
      branchId: user.branchId || 1001,
      fyearId: user.fyearId || 1001,
    });

    return { matchedCount };
  }

  async finalizeBrs(dto: FinalizeBrsDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    // Calculate current BRS figures
    const summary = await this.getReconciliationSummary(dto.bankAccountId, dto.cutoffDate, user);

    // Fetch next BRS doc number from series
    const seriesRes = await this.pool.query(
      `SELECT prefix_template, current_next_no, padding_digits
       FROM tbl_sys_doc_number_series
       WHERE target_comp_id = $1 AND target_branch_id = $2 AND series_code = 'AHM-BRS-2627'
       FOR UPDATE;`,
      [compId, branchId]
    );

    let brsNo: string;
    if (seriesRes.rows.length > 0) {
      const s = seriesRes.rows[0];
      brsNo = `${s.prefix_template}${String(s.current_next_no).padStart(s.padding_digits || 4, '0')}`;
      await this.pool.query(
        `UPDATE tbl_sys_doc_number_series SET current_next_no = current_next_no + 1 WHERE target_comp_id = $1 AND target_branch_id = $2 AND series_code = 'AHM-BRS-2627';`,
        [compId, branchId]
      );
    } else {
      brsNo = `BRS-AHM-2627-${Date.now().toString().slice(-4)}`;
    }

    const insertSql = `
      INSERT INTO tbl_acc_bank_reconciliation (
        brs_statement_no, bank_account_id, cutoff_date, gl_book_balance,
        unpresented_cheques_total, uncredited_deposits_total, bank_adjustments_net,
        computed_bank_balance, actual_statement_balance, variance_amount,
        reconciliation_status, verified_by, verified_date, remarks, is_active,
        comp_id, branch_id, fyear_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, 0.00, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, $12, TRUE, $13, $14, $15, $11)
      ON CONFLICT (comp_id, branch_id, bank_account_id, cutoff_date)
      DO UPDATE SET
        gl_book_balance = EXCLUDED.gl_book_balance,
        unpresented_cheques_total = EXCLUDED.unpresented_cheques_total,
        uncredited_deposits_total = EXCLUDED.uncredited_deposits_total,
        computed_bank_balance = EXCLUDED.computed_bank_balance,
        actual_statement_balance = EXCLUDED.actual_statement_balance,
        variance_amount = EXCLUDED.variance_amount,
        reconciliation_status = EXCLUDED.reconciliation_status,
        verified_by = EXCLUDED.verified_by,
        verified_date = CURRENT_TIMESTAMP,
        remarks = EXCLUDED.remarks
      RETURNING *;
    `;
    const recStatus = summary.isBalanced ? 'RECONCILED' : 'VARIANCE_FLAGGED';
    const res = await this.pool.query(insertSql, [
      brsNo,
      dto.bankAccountId,
      dto.cutoffDate,
      summary.glBookBalance,
      summary.unpresentedTotal,
      summary.uncreditedTotal,
      summary.computedBankBalance,
      summary.actualStatementBalance,
      summary.varianceAmount,
      recStatus,
      userId,
      dto.remarks || `Statutory BRS reconciliation authorized on ${dto.cutoffDate}`,
      compId,
      branchId,
      fyearId,
    ]);

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'BANKING_ACCOUNTS',
      actionType: 'RECONCILE',
      entityTable: 'tbl_acc_bank_reconciliation',
      recordId: res.rows[0].brs_id,
      newValue: { brsNo, ...dto, summary },
      compId,
      branchId,
      fyearId,
    });

    return res.rows[0];
  }
}
