import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Download,
  Edit3,
  Filter,
  Layers,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { PermissionGate } from '../../components/common/PermissionGate';

export interface CustomerRecord {
  partyId: number;
  partyCode: string;
  partyName: string;
  customerGroup: 'OEM Automotive' | 'Process & Chemical' | 'Heavy Engineering' | 'Export Tier-1';
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  stateName: string;
  gstin: string;
  creditLimit: number;
  outstandingBalance: number;
  status: 'ACTIVE' | 'ON_HOLD' | 'INACTIVE';
}

const INITIAL_CUSTOMERS: CustomerRecord[] = [
  {
    partyId: 1001,
    partyCode: 'CUST-1001',
    partyName: 'Bharat Forge & Powertrain Ltd.',
    customerGroup: 'OEM Automotive',
    contactPerson: 'Vikram Deshmukh',
    phone: '+91-20-66218900',
    email: 'procurement@bharatforge-demo.in',
    city: 'Pune',
    stateName: 'Maharashtra',
    gstin: '27AABCB1234D1Z1',
    creditLimit: 2500000,
    outstandingBalance: 640000,
    status: 'ACTIVE',
  },
  {
    partyId: 1002,
    partyCode: 'CUST-1002',
    partyName: 'Reliance Petrochem Valves Division',
    customerGroup: 'Process & Chemical',
    contactPerson: 'Suresh Mehta',
    phone: '+91-261-2894411',
    email: 'suresh.m@relpetro-demo.com',
    city: 'Surat',
    stateName: 'Gujarat',
    gstin: '24AAACR5055K1Z8',
    creditLimit: 5000000,
    outstandingBalance: 1420000,
    status: 'ACTIVE',
  },
  {
    partyId: 1003,
    partyCode: 'CUST-1003',
    partyName: 'Thermax Industrial Boilers Pvt. Ltd.',
    customerGroup: 'Heavy Engineering',
    contactPerson: 'Ananya Kulkarni',
    phone: '+91-20-67123300',
    email: 'ananya.k@thermax-demo.in',
    city: 'Pune',
    stateName: 'Maharashtra',
    gstin: '27AAACT4412M1Z5',
    creditLimit: 1800000,
    outstandingBalance: 315000,
    status: 'ACTIVE',
  },
  {
    partyId: 1004,
    partyCode: 'CUST-1004',
    partyName: 'Aarti Specialty Chemicals Ltd.',
    customerGroup: 'Process & Chemical',
    contactPerson: 'Harshad Shah',
    phone: '+91-265-2341190',
    email: 'purchase@aartichem-demo.com',
    city: 'Vadodara',
    stateName: 'Gujarat',
    gstin: '24AAACA8821B1Z2',
    creditLimit: 1500000,
    outstandingBalance: 1490000,
    status: 'ON_HOLD',
  },
  {
    partyId: 1005,
    partyCode: 'CUST-1005',
    partyName: 'Mahindra Tractor Assemblies',
    customerGroup: 'OEM Automotive',
    contactPerson: 'Rajiv Nair',
    phone: '+91-79-29701234',
    email: 'rajiv.nair@mahindra-demo.in',
    city: 'Ahmedabad',
    stateName: 'Gujarat',
    gstin: '24AAACM3025E1Z9',
    creditLimit: 3500000,
    outstandingBalance: 890000,
    status: 'ACTIVE',
  },
  {
    partyId: 1006,
    partyCode: 'CUST-1006',
    partyName: 'Stuttgart FluidTek GmbH',
    customerGroup: 'Export Tier-1',
    contactPerson: 'Markus Weber',
    phone: '+49-711-890231',
    email: 'm.weber@fluidtek-demo.de',
    city: 'Stuttgart',
    stateName: 'International',
    gstin: 'EXPORT-LUT-2026',
    creditLimit: 4000000,
    outstandingBalance: 0,
    status: 'ACTIVE',
  },
  {
    partyId: 1007,
    partyCode: 'CUST-1007',
    partyName: 'Elecon Gear & Transmission Systems',
    customerGroup: 'Heavy Engineering',
    contactPerson: 'Ketan पटेल',
    phone: '+91-2692-227101',
    email: 'ketan@elecon-demo.com',
    city: 'Anand',
    stateName: 'Gujarat',
    gstin: '24AAACE1199F1Z4',
    creditLimit: 1200000,
    outstandingBalance: 0,
    status: 'INACTIVE',
  },
];

type GroupByField = 'NONE' | 'customerGroup' | 'stateName' | 'status';
type SortField = 'partyCode' | 'partyName' | 'creditLimit' | 'outstandingBalance';

export const CustomerMasterPage: React.FC = () => {
  const [customers, setCustomers] =
    useState<CustomerRecord[]>(INITIAL_CUSTOMERS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [groupBy, setGroupBy] = useState<GroupByField>('NONE');
  const [sortField, setSortField] = useState<SortField>('partyCode');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CustomerRecord | null>(
    null,
  );
  const [formState, setFormState] = useState<Omit<CustomerRecord, 'partyId'>>({
    partyCode: '',
    partyName: '',
    customerGroup: 'OEM Automotive',
    contactPerson: '',
    phone: '',
    email: '',
    city: '',
    stateName: 'Gujarat',
    gstin: '',
    creditLimit: 1000000,
    outstandingBalance: 0,
    status: 'ACTIVE',
  });

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = customers.filter((c) => {
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (groupFilter !== 'ALL' && c.customerGroup !== groupFilter)
        return false;
      if (!q) return true;
      return (
        c.partyCode.toLowerCase().includes(q) ||
        c.partyName.toLowerCase().includes(q) ||
        c.contactPerson.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.gstin.toLowerCase().includes(q)
      );
    });

    list.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      return sortDir === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

    return list;
  }, [customers, search, statusFilter, groupFilter, sortField, sortDir]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSorted.length / pageSize),
  );
  const paginatedRows = filteredAndSorted.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const groupedSections = useMemo(() => {
    if (groupBy === 'NONE') {
      return [{ groupTitle: null, rows: paginatedRows }];
    }
    const map = new Map<string, CustomerRecord[]>();
    for (const r of filteredAndSorted) {
      const key = String(r[groupBy]);
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([groupTitle, rows]) => ({
      groupTitle,
      rows,
    }));
  }, [groupBy, paginatedRows, filteredAndSorted]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const openAddModal = () => {
    const nextNum = Math.max(...customers.map((c) => c.partyId), 1000) + 1;
    setEditingRecord(null);
    setFormState({
      partyCode: `CUST-${nextNum}`,
      partyName: '',
      customerGroup: 'OEM Automotive',
      contactPerson: '',
      phone: '',
      email: '',
      city: 'Ahmedabad',
      stateName: 'Gujarat',
      gstin: '',
      creditLimit: 1000000,
      outstandingBalance: 0,
      status: 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (rec: CustomerRecord) => {
    setEditingRecord(rec);
    setFormState({
      partyCode: rec.partyCode,
      partyName: rec.partyName,
      customerGroup: rec.customerGroup,
      contactPerson: rec.contactPerson,
      phone: rec.phone,
      email: rec.email,
      city: rec.city,
      stateName: rec.stateName,
      gstin: rec.gstin,
      creditLimit: rec.creditLimit,
      outstandingBalance: rec.outstandingBalance,
      status: rec.status,
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRecord) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.partyId === editingRecord.partyId
            ? { ...formState, partyId: editingRecord.partyId }
            : c,
        ),
      );
    } else {
      const nextId = Math.max(...customers.map((c) => c.partyId), 1000) + 1;
      setCustomers((prev) => [{ ...formState, partyId: nextId }, ...prev]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (rec: CustomerRecord) => {
    if (
      window.confirm(
        `Verify Dependency Check & Delete Customer "${rec.partyName}" (${rec.partyCode})?`,
      )
    ) {
      setCustomers((prev) => prev.filter((c) => c.partyId !== rec.partyId));
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Customer Master (`tbl_crm_party`)
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Manage OEM customers, GSTIN compliance, credit limits, and tiered
            pricing groups
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PermissionGate screen="PARTY_MASTER" action="PRINT">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--brand-500)] transition cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
          </PermissionGate>

          <PermissionGate screen="PARTY_MASTER" action="EXPORT">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--brand-500)] transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </PermissionGate>

          <PermissionGate screen="PARTY_MASTER" action="ADD">
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Customer</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* Filter, Search, Sort & Group-By Toolbar */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          {/* Search Input */}
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search code, customer name, contact, city, GSTIN..."
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] pl-10 pr-4 py-2 text-xs font-medium text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-none"
            />
          </div>

          {/* Customer Group Filter */}
          <div className="md:col-span-3 flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-[var(--text-muted)] shrink-0" />
            <select
              value={groupFilter}
              onChange={(e) => {
                setGroupFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
            >
              <option value="ALL">All Customer Groups</option>
              <option value="OEM Automotive">OEM Automotive</option>
              <option value="Process & Chemical">Process & Chemical</option>
              <option value="Heavy Engineering">Heavy Engineering</option>
              <option value="Export Tier-1">Export Tier-1</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">Credit Hold</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {/* Group By Selector */}
          <div className="md:col-span-2 flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-[var(--brand-500)] shrink-0" />
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupByField)}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-2 text-xs font-semibold text-[var(--text-primary)]"
            >
              <option value="NONE">Group: None</option>
              <option value="customerGroup">Group: Segment</option>
              <option value="stateName">Group: State</option>
              <option value="status">Group: Status</option>
            </select>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('partyCode')}
                    className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <span>Code</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('partyName')}
                    className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <span>Customer & Segment</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-3 px-4">Primary Contact</th>
                <th className="py-3 px-4">City / GSTIN</th>
                <th className="py-3 px-4 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('creditLimit')}
                    className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    <span>Credit Limit</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
              {groupedSections.map((sec, idx) => (
                <React.Fragment key={sec.groupTitle || idx}>
                  {sec.groupTitle && (
                    <tr className="bg-[var(--brand-50)]/60 dark:bg-slate-800/90 border-y border-[var(--border-strong)]">
                      <td
                        colSpan={7}
                        className="py-2.5 px-4 text-xs font-extrabold text-[var(--brand-700)] dark:text-[var(--brand-300)]"
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="h-3.5 w-3.5" />
                          <span>{sec.groupTitle}</span>
                          <span className="rounded-full bg-[var(--brand-600)] px-2 py-0.5 text-[10px] font-bold text-white">
                            {sec.rows.length}{' '}
                            {sec.rows.length === 1 ? 'record' : 'records'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {sec.rows.map((row) => (
                    <tr
                      key={row.partyId}
                      className="hover:bg-[var(--bg-hover)] transition"
                    >
                      <td className="py-3.5 px-4 font-mono-code font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
                        {row.partyCode}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[var(--text-primary)]">
                          {row.partyName}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {row.customerGroup}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[var(--text-secondary)]">
                          {row.contactPerson}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          {row.phone}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-[var(--text-secondary)]">
                          {row.city}, {row.stateName}
                        </div>
                        <div className="text-[11px] font-mono-code text-[var(--text-muted)]">
                          {row.gstin}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-code">
                        <div className="font-bold text-[var(--text-primary)]">
                          ₹{row.creditLimit.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)]">
                          OS: ₹{row.outstandingBalance.toLocaleString('en-IN')}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {row.status === 'ACTIVE' && (
                          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
                            Active
                          </span>
                        )}
                        {row.status === 'ON_HOLD' && (
                          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-300">
                            Credit Hold
                          </span>
                        )}
                        {row.status === 'INACTIVE' && (
                          <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-300">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <PermissionGate screen="PARTY_MASTER" action="EDIT">
                            <button
                              type="button"
                              onClick={() => openEditModal(row)}
                              title="Edit Customer"
                              className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--brand-500)] transition cursor-pointer"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          </PermissionGate>
                          <PermissionGate screen="PARTY_MASTER" action="DELETE">
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              title="Delete Customer"
                              className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 text-xs">
          <span className="text-[var(--text-muted)]">
            Showing{' '}
            <strong className="text-[var(--text-primary)]">
              {filteredAndSorted.length === 0 ? 0 : (page - 1) * pageSize + 1}
            </strong>{' '}
            to{' '}
            <strong className="text-[var(--text-primary)]">
              {Math.min(page * pageSize, filteredAndSorted.length)}
            </strong>{' '}
            of{' '}
            <strong className="text-[var(--text-primary)]">
              {filteredAndSorted.length}
            </strong>{' '}
            customers
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 font-semibold text-[var(--text-secondary)] disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <span className="px-2 font-mono-code font-bold text-[var(--text-primary)]">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 font-semibold text-[var(--text-secondary)] disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  {editingRecord
                    ? `Edit Customer — ${editingRecord.partyCode}`
                    : 'Create New Customer Record'}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  All changes are logged with JSONB field-level deltas in
                  `tbl_sys_audit_log`
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Customer Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.partyCode}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, partyCode: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code font-bold text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Customer Group *
                  </label>
                  <select
                    value={formState.customerGroup}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        customerGroup: e.target
                          .value as CustomerRecord['customerGroup'],
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  >
                    <option value="OEM Automotive">OEM Automotive</option>
                    <option value="Process & Chemical">
                      Process & Chemical
                    </option>
                    <option value="Heavy Engineering">Heavy Engineering</option>
                    <option value="Export Tier-1">Export Tier-1</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-[var(--text-secondary)] mb-1">
                  Legal Customer Name *
                </label>
                <input
                  type="text"
                  required
                  value={formState.partyName}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, partyName: e.target.value }))
                  }
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Primary Contact Person *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.contactPerson}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        contactPerson: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    GSTIN / Tax Registration *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.gstin}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        gstin: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.city}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, city: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Credit Limit (INR)
                  </label>
                  <input
                    type="number"
                    value={formState.creditLimit}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        creditLimit: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Status
                  </label>
                  <select
                    value={formState.status}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        status: e.target.value as CustomerRecord['status'],
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="ON_HOLD">Credit Hold</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border-subtle)] pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 font-semibold text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] px-5 py-2 font-bold text-white shadow-xs cursor-pointer"
                >
                  {editingRecord ? 'Update Customer' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
