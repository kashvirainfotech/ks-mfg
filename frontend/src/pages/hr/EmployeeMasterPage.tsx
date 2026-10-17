import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  Edit3,
  Filter,
  GitBranch,
  Landmark,
  Mail,
  Phone,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  MasterDataTable,
  type GroupByOption,
  type MasterTableColumn,
} from '../../components/common/MasterDataTable';
import {
  ConfirmDeleteModal,
  type DependencyConflictItem,
} from '../../components/common/ConfirmDeleteModal';
import { PermissionGate } from '../../components/common/PermissionGate';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';

export type EmploymentType =
  | 'PERMANENT'
  | 'CONTRACT'
  | 'PROBATION'
  | 'TRAINEE'
  | 'CONSULTANT';

export type EmploymentStatus =
  | 'ACTIVE'
  | 'ON_NOTICE'
  | 'SUSPENDED'
  | 'RELIEVED';

export interface EmployeeEntity {
  employeeId: number;
  compId: number;
  compCode: string;
  compName: string;
  branchId: number;
  empCode: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth: string | null;
  dateOfJoining: string;
  deptId: number;
  deptCode: string;
  deptName: string;
  desigId: number;
  desigCode: string;
  desigName: string;
  gradeCode: string | null;
  primaryBranchId: number;
  primaryBranchCode: string;
  primaryBranchName: string;
  reportingManagerId: number | null;
  reportingManagerCode: string | null;
  reportingManagerName: string | null;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  workEmail: string | null;
  mobileNo: string;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bloodGroup: string | null;
  panNo: string | null;
  aadhaarMasked: string | null;
  pfUanNo: string | null;
  esiNo: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  bankIfscCode: string | null;
  addressLine1: string | null;
  city: string | null;
  stateName: string | null;
  pincode: string | null;
  remarks: string | null;
  directReportCount: number;
  isActive: boolean;
}

interface CompanyLookup {
  compId: number;
  compCode: string;
  compName: string;
}

interface BranchLookup {
  branchId: number;
  compId: number;
  branchCode: string;
  branchName: string;
}

interface DepartmentLookup {
  deptId: number;
  compId: number;
  deptCode: string;
  deptName: string;
  isActive: boolean;
}

interface DesignationLookup {
  desigId: number;
  compId: number;
  deptId: number | null;
  desigCode: string;
  desigName: string;
  gradeCode: string;
  isActive: boolean;
}

const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  PERMANENT: 'Permanent On-Roll',
  PROBATION: 'Probation Period',
  CONTRACT: 'Contractual / Third-Party',
  TRAINEE: 'GET / Apprentice Trainee',
  CONSULTANT: 'Technical Consultant',
};

const EMPLOYMENT_STATUS_BADGES: Record<
  EmploymentStatus,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: 'Active On-Duty',
    className:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  ON_NOTICE: {
    label: 'Serving Notice',
    className:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  SUSPENDED: {
    label: 'Suspended / Hold',
    className:
      'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  },
  RELIEVED: {
    label: 'Relieved / Exited',
    className:
      'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  },
};

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

const EMPTY_EMP_FORM = {
  compId: 1001,
  empCode: '',
  firstName: '',
  lastName: '',
  gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
  dateOfBirth: '',
  dateOfJoining: new Date().toISOString().slice(0, 10),
  deptId: '' as string | number,
  desigId: '' as string | number,
  primaryBranchId: '' as string | number,
  reportingManagerId: '' as string | number,
  employmentType: 'PERMANENT' as EmploymentType,
  employmentStatus: 'ACTIVE' as EmploymentStatus,
  workEmail: '',
  mobileNo: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  bloodGroup: '',
  panNo: '',
  aadhaarMasked: '',
  pfUanNo: '',
  esiNo: '',
  bankName: '',
  bankAccountNo: '',
  bankIfscCode: '',
  addressLine1: '',
  city: '',
  stateName: 'Gujarat',
  pincode: '',
  remarks: '',
  isActive: true,
};

export const EmployeeMasterPage: React.FC = () => {
  const activeContext = useAuthStore((s) => s.activeContext);

  const [companies, setCompanies] = useState<CompanyLookup[]>([]);
  const [branches, setBranches] = useState<BranchLookup[]>([]);
  const [departments, setDepartments] = useState<DepartmentLookup[]>([]);
  const [designations, setDesignations] = useState<DesignationLookup[]>([]);
  const [employees, setEmployees] = useState<EmployeeEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Filters
  const [selectedCompId, setSelectedCompId] = useState<number | 'ALL'>('ALL');
  const [selectedBranchId, setSelectedBranchId] = useState<number | 'ALL'>('ALL');
  const [selectedDeptId, setSelectedDeptId] = useState<number | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<EmploymentStatus | 'ALL'>(
    'ALL',
  );

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeEntity | null>(
    null,
  );
  const [empForm, setEmpForm] = useState(EMPTY_EMP_FORM);
  const [formTab, setFormTab] = useState<'ORG' | 'PERSONAL' | 'STATUTORY'>(
    'ORG',
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    name: string;
    code: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<
    DependencyConflictItem[]
  >([]);

  // Close form modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen && !isSaving) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isSaving]);

  const fetchAllData = async () => {
    setIsLoading(true);
    setBannerMessage(null);
    try {
      const [compRes, branchRes, deptRes, desigRes, empRes] = await Promise.all([
        apiClient.get('/org/companies'),
        apiClient.get('/org/branches'),
        apiClient.get('/hr/departments'),
        apiClient.get('/hr/designations'),
        apiClient.get('/hr/employees'),
      ]);

      const compData = compRes.data?.data ?? compRes.data;
      const branchData = branchRes.data?.data ?? branchRes.data;
      const deptData = deptRes.data?.data ?? deptRes.data;
      const desigData = desigRes.data?.data ?? desigRes.data;
      const empData = empRes.data?.data ?? empRes.data;

      setCompanies(Array.isArray(compData) ? compData : []);
      setBranches(Array.isArray(branchData) ? branchData : []);
      setDepartments(Array.isArray(deptData) ? deptData : []);
      setDesignations(Array.isArray(desigData) ? desigData : []);
      setEmployees(Array.isArray(empData) ? empData : []);
    } catch (err: any) {
      setCompanies([]);
      setBranches([]);
      setDepartments([]);
      setDesignations([]);
      setEmployees([]);
      setBannerMessage({
        type: 'error',
        text:
          err?.response?.data?.error?.message ||
          'Unable to load Employee Master data from the server. Please verify backend connectivity.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Filtered datasets
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (selectedCompId !== 'ALL' && e.compId !== selectedCompId) return false;
      if (
        selectedBranchId !== 'ALL' &&
        e.primaryBranchId !== selectedBranchId
      ) {
        return false;
      }
      if (selectedDeptId !== 'ALL' && e.deptId !== selectedDeptId) return false;
      if (selectedStatus !== 'ALL' && e.employmentStatus !== selectedStatus) {
        return false;
      }
      return true;
    });
  }, [
    employees,
    selectedCompId,
    selectedBranchId,
    selectedDeptId,
    selectedStatus,
  ]);

  // KPI Metrics
  const kpiStats = useMemo(() => {
    const totalCount = filteredEmployees.length;
    const activeCount = filteredEmployees.filter(
      (e) => e.isActive && e.employmentStatus === 'ACTIVE',
    ).length;
    const uniqueBranches = new Set(
      filteredEmployees.map((e) => e.primaryBranchId),
    ).size;
    const managersCount = filteredEmployees.filter(
      (e) => e.directReportCount > 0,
    ).length;
    return { totalCount, activeCount, uniqueBranches, managersCount };
  }, [filteredEmployees]);

  // Modal Handlers
  const openCreateModal = () => {
    const defaultCompId =
      selectedCompId !== 'ALL'
        ? selectedCompId
        : activeContext?.compId || companies[0]?.compId || 1001;
    const compBranches = branches.filter((b) => b.compId === defaultCompId);
    const compDepts = departments.filter((d) => d.compId === defaultCompId);
    const defaultDeptId =
      selectedDeptId !== 'ALL'
        ? selectedDeptId
        : compDepts[0]?.deptId || '';
    const compDesigs = designations.filter(
      (dg) =>
        dg.compId === defaultCompId &&
        (!defaultDeptId || !dg.deptId || dg.deptId === Number(defaultDeptId)),
    );

    setEditingEmployee(null);
    setEmpForm({
      ...EMPTY_EMP_FORM,
      compId: defaultCompId,
      primaryBranchId:
        selectedBranchId !== 'ALL'
          ? selectedBranchId
          : compBranches[0]?.branchId || '',
      deptId: defaultDeptId,
      desigId: compDesigs[0]?.desigId || '',
    });
    setFormTab('ORG');
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (emp: EmployeeEntity) => {
    setEditingEmployee(emp);
    setEmpForm({
      compId: emp.compId,
      empCode: emp.empCode,
      firstName: emp.firstName,
      lastName: emp.lastName || '',
      gender: emp.gender || 'MALE',
      dateOfBirth: emp.dateOfBirth || '',
      dateOfJoining: emp.dateOfJoining,
      deptId: emp.deptId,
      desigId: emp.desigId,
      primaryBranchId: emp.primaryBranchId,
      reportingManagerId: emp.reportingManagerId || '',
      employmentType: emp.employmentType,
      employmentStatus: emp.employmentStatus,
      workEmail: emp.workEmail || '',
      mobileNo: emp.mobileNo,
      emergencyContactName: emp.emergencyContactName || '',
      emergencyContactPhone: emp.emergencyContactPhone || '',
      bloodGroup: emp.bloodGroup || '',
      panNo: emp.panNo || '',
      aadhaarMasked: emp.aadhaarMasked || '',
      pfUanNo: emp.pfUanNo || '',
      esiNo: emp.esiNo || '',
      bankName: emp.bankName || '',
      bankAccountNo: emp.bankAccountNo || '',
      bankIfscCode: emp.bankIfscCode || '',
      addressLine1: emp.addressLine1 || '',
      city: emp.city || '',
      stateName: emp.stateName || 'Gujarat',
      pincode: emp.pincode || '',
      remarks: emp.remarks || '',
      isActive: emp.isActive,
    });
    setFormTab('ORG');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (
      !empForm.empCode.trim() ||
      !empForm.firstName.trim() ||
      !empForm.dateOfJoining ||
      !empForm.deptId ||
      !empForm.desigId ||
      !empForm.primaryBranchId ||
      !empForm.mobileNo.trim()
    ) {
      setFormError(
        'Employee Code, First Name, Date of Joining, Primary Plant/Branch, Department, Designation, and Mobile Number are mandatory.',
      );
      return;
    }

    setIsSaving(true);
    const payload = {
      compId: Number(empForm.compId),
      empCode: empForm.empCode.trim().toUpperCase(),
      firstName: empForm.firstName.trim(),
      lastName: empForm.lastName.trim() || null,
      gender: empForm.gender,
      dateOfBirth: empForm.dateOfBirth || null,
      dateOfJoining: empForm.dateOfJoining,
      deptId: Number(empForm.deptId),
      desigId: Number(empForm.desigId),
      primaryBranchId: Number(empForm.primaryBranchId),
      reportingManagerId: empForm.reportingManagerId
        ? Number(empForm.reportingManagerId)
        : null,
      employmentType: empForm.employmentType,
      employmentStatus: empForm.employmentStatus,
      workEmail: empForm.workEmail.trim() || null,
      mobileNo: empForm.mobileNo.trim(),
      emergencyContactName: empForm.emergencyContactName.trim() || null,
      emergencyContactPhone: empForm.emergencyContactPhone.trim() || null,
      bloodGroup: empForm.bloodGroup || null,
      panNo: empForm.panNo.trim().toUpperCase() || null,
      aadhaarMasked: empForm.aadhaarMasked.trim() || null,
      pfUanNo: empForm.pfUanNo.trim() || null,
      esiNo: empForm.esiNo.trim() || null,
      bankName: empForm.bankName.trim() || null,
      bankAccountNo: empForm.bankAccountNo.trim() || null,
      bankIfscCode: empForm.bankIfscCode.trim().toUpperCase() || null,
      addressLine1: empForm.addressLine1.trim() || null,
      city: empForm.city.trim() || null,
      stateName: empForm.stateName.trim() || null,
      pincode: empForm.pincode.trim() || null,
      remarks: empForm.remarks.trim() || null,
      isActive: empForm.isActive,
    };

    try {
      if (editingEmployee) {
        await apiClient.put(
          `/hr/employees/${editingEmployee.employeeId}`,
          payload,
        );
      } else {
        await apiClient.post('/hr/employees', payload);
      }
      await fetchAllData();
      setIsModalOpen(false);
      setBannerMessage({
        type: 'success',
        text: editingEmployee
          ? `Employee "${payload.firstName}" (${payload.empCode}) updated successfully.`
          : `Employee "${payload.firstName}" (${payload.empCode}) created successfully.`,
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to save employee record.';
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Handlers
  const openDeleteConfirm = (emp: EmployeeEntity) => {
    setDeleteError(null);
    setDeleteDependencies([]);
    setDeleteTarget({
      id: emp.employeeId,
      name: emp.fullName,
      code: emp.empCode,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    setDeleteDependencies([]);

    try {
      await apiClient.delete(`/hr/employees/${deleteTarget.id}`);
      await fetchAllData();
      const deletedLabel = `${deleteTarget.name} (${deleteTarget.code})`;
      setDeleteTarget(null);
      setBannerMessage({
        type: 'success',
        text: `Employee "${deletedLabel}" deleted permanently.`,
      });
    } catch (err: any) {
      const errPayload = err?.response?.data?.error;
      const conflicts: DependencyConflictItem[] =
        errPayload?.details?.dependencies || [];
      setDeleteDependencies(conflicts);
      setDeleteError(
        errPayload?.message ||
          'Cannot delete this employee record because dependent records exist.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Export & Print Handlers
  const handleExportCsv = async (rows: EmployeeEntity[]) => {
    try {
      await apiClient.post('/hr/employees/action/EXPORT');
    } catch {
      // Non-blocking audit notification
    }

    const headers = [
      'Employee Code',
      'Full Name',
      'Company',
      'Primary Plant / Branch',
      'Department',
      'Designation',
      'Grade',
      'Reporting Manager',
      'Date of Joining',
      'Employment Type',
      'Employment Status',
      'Mobile No',
      'Work Email',
      'Active',
    ];
    const csvLines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.empCode,
          `"${(r.fullName || '').replace(/"/g, '""')}"`,
          `"${(r.compName || '').replace(/"/g, '""')}"`,
          `"${(r.primaryBranchName || '').replace(/"/g, '""')}"`,
          `"${(r.deptName || '').replace(/"/g, '""')}"`,
          `"${(r.desigName || '').replace(/"/g, '""')}"`,
          r.gradeCode || '',
          `"${(r.reportingManagerName || '').replace(/"/g, '""')}"`,
          r.dateOfJoining,
          r.employmentType,
          r.employmentStatus,
          r.mobileNo,
          r.workEmail || '',
          r.isActive ? 'ACTIVE' : 'INACTIVE',
        ].join(','),
      ),
    ];

    const blob = new Blob([csvLines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KS_MFG_Employee_Directory_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = async () => {
    try {
      await apiClient.post('/hr/employees/action/PRINT');
    } catch {
      // Non-blocking audit notification
    }
    window.print();
  };

  // Columns for Employee Master
  const employeeColumns: MasterTableColumn<EmployeeEntity>[] = useMemo(
    () => [
      {
        key: 'empCode',
        header: 'Emp Code',
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
              {row.empCode}
            </span>
            <span className="text-[11px] text-slate-400">{row.compCode}</span>
          </div>
        ),
      },
      {
        key: 'fullName',
        header: 'Employee Name & Contact',
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {row.fullName}
            </span>
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3 text-slate-400" />
                {row.mobileNo}
              </span>
              {row.workEmail && (
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3 text-slate-400" />
                  {row.workEmail}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'deptName',
        header: 'Department & Designation',
        render: (row) => (
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {row.desigName}{' '}
              {row.gradeCode && (
                <span className="ml-1 rounded bg-brand-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-600 dark:text-brand-400">
                  {row.gradeCode}
                </span>
              )}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {row.deptName} ({row.deptCode})
            </span>
          </div>
        ),
      },
      {
        key: 'primaryBranchName',
        header: 'Primary Plant / Branch',
        render: (row) => (
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
              {row.primaryBranchName}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {row.primaryBranchCode}
            </span>
          </div>
        ),
      },
      {
        key: 'reportingManagerName',
        header: 'Reporting Manager',
        render: (row) =>
          row.reportingManagerName ? (
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                {row.reportingManagerName}
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                {row.reportingManagerCode}
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
              Top Level / Board
            </span>
          ),
      },
      {
        key: 'dateOfJoining',
        header: 'Joining & Type',
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
              DOJ: {row.dateOfJoining}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {EMPLOYMENT_TYPE_LABELS[row.employmentType] || row.employmentType}
            </span>
          </div>
        ),
      },
      {
        key: 'employmentStatus',
        header: 'Status',
        align: 'center',
        render: (row) => {
          const badge = EMPLOYMENT_STATUS_BADGES[row.employmentStatus] || {
            label: row.employmentStatus,
            className: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
          };
          return (
            <div className="flex flex-col items-center gap-1">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
              >
                {badge.label}
              </span>
              {row.directReportCount > 0 && (
                <span className="text-[10px] font-medium text-slate-400">
                  {row.directReportCount} direct report
                  {row.directReportCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          );
        },
      },
    ],
    [],
  );

  const groupByOptions: GroupByOption<EmployeeEntity>[] = [
    {
      key: 'deptName',
      label: 'Department',
      groupValue: (row) => `${row.deptName} (${row.deptCode})`,
    },
    {
      key: 'primaryBranchName',
      label: 'Primary Plant / Branch',
      groupValue: (row) =>
        `${row.primaryBranchName} (${row.primaryBranchCode})`,
    },
    {
      key: 'employmentType',
      label: 'Employment Type',
      groupValue: (row) =>
        EMPLOYMENT_TYPE_LABELS[row.employmentType] || row.employmentType,
    },
    {
      key: 'employmentStatus',
      label: 'Employment Status',
      groupValue: (row) =>
        EMPLOYMENT_STATUS_BADGES[row.employmentStatus]?.label ||
        row.employmentStatus,
    },
    {
      key: 'compName',
      label: 'Company',
      groupValue: (row) => `${row.compCode} — ${row.compName}`,
    },
  ];

  // Dynamic dropdown lookups scoped to selected company in modal
  const modalBranches = useMemo(
    () => branches.filter((b) => b.compId === Number(empForm.compId)),
    [branches, empForm.compId],
  );

  const modalDepartments = useMemo(
    () => departments.filter((d) => d.compId === Number(empForm.compId)),
    [departments, empForm.compId],
  );

  const modalDesignations = useMemo(
    () =>
      designations.filter(
        (dg) =>
          dg.compId === Number(empForm.compId) &&
          (!empForm.deptId ||
            !dg.deptId ||
            dg.deptId === Number(empForm.deptId)),
      ),
    [designations, empForm.compId, empForm.deptId],
  );

  const modalManagers = useMemo(
    () =>
      employees.filter(
        (e) =>
          e.compId === Number(empForm.compId) &&
          (!editingEmployee || e.employeeId !== editingEmployee.employeeId),
      ),
    [employees, empForm.compId, editingEmployee],
  );

  return (
    <div className="space-y-5">
      {/* Top Header & KPI Cards */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
              <Users className="h-3.5 w-3.5" />
              Phase 2 • Step 2.2 — HR & Workforce Directory
            </span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Employee Master Directory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage plant and corporate employees, department & designation
            assignments, reporting hierarchies, statutory PF/ESI/PAN identifiers,
            and payroll bank records.
          </p>
        </div>

        {/* Multi-Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs shadow-sm">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-medium text-slate-500 dark:text-slate-400">
              Company:
            </span>
            <select
              value={selectedCompId}
              onChange={(e) => {
                const val =
                  e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                setSelectedCompId(val);
                setSelectedBranchId('ALL');
                setSelectedDeptId('ALL');
              }}
              className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Companies</option>
              {companies.map((c) => (
                <option key={c.compId} value={c.compId}>
                  {c.compCode} — {c.compName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs shadow-sm">
            <GitBranch className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-medium text-slate-500 dark:text-slate-400">
              Plant:
            </span>
            <select
              value={selectedBranchId}
              onChange={(e) =>
                setSelectedBranchId(
                  e.target.value === 'ALL' ? 'ALL' : Number(e.target.value),
                )
              }
              className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Plants / Branches</option>
              {branches
                .filter(
                  (b) =>
                    selectedCompId === 'ALL' || b.compId === selectedCompId,
                )
                .map((b) => (
                  <option key={b.branchId} value={b.branchId}>
                    {b.branchCode} — {b.branchName}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs shadow-sm">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-medium text-slate-500 dark:text-slate-400">
              Dept:
            </span>
            <select
              value={selectedDeptId}
              onChange={(e) =>
                setSelectedDeptId(
                  e.target.value === 'ALL' ? 'ALL' : Number(e.target.value),
                )
              }
              className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Departments</option>
              {departments
                .filter(
                  (d) =>
                    selectedCompId === 'ALL' || d.compId === selectedCompId,
                )
                .map((d) => (
                  <option key={d.deptId} value={d.deptId}>
                    {d.deptCode} — {d.deptName}
                  </option>
                ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs shadow-sm">
            <UserCheck className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-medium text-slate-500 dark:text-slate-400">
              Status:
            </span>
            <select
              value={selectedStatus}
              onChange={(e) =>
                setSelectedStatus(e.target.value as EmploymentStatus | 'ALL')
              }
              className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active On-Duty</option>
              <option value="ON_NOTICE">Serving Notice</option>
              <option value="SUSPENDED">Suspended / Hold</option>
              <option value="RELIEVED">Relieved / Exited</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Registered Employees
            </span>
            <Users className="h-4 w-4 text-brand-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
            {kpiStats.totalCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Active On-Duty Workforce
            </span>
            <BadgeCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {kpiStats.activeCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Plants / Branches Covered
            </span>
            <GitBranch className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
            {kpiStats.uniqueBranches}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Reporting Managers / HODs
            </span>
            <ShieldCheck className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
            {kpiStats.managersCount}
          </p>
        </div>
      </div>

      {/* Feedback Banner */}
      {bannerMessage && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-medium ${
            bannerMessage.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
          }`}
        >
          <span>{bannerMessage.text}</span>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="ml-4 rounded p-1 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Employee Master Data Table */}
      <MasterDataTable<EmployeeEntity>
        title="Employee Master Records"
        subtitle="Complete manufacturing and corporate workforce registry linked to Departments, Designations, Plants, and Security User Accounts."
        screenCode="EMPLOYEE_MASTER"
        tableNameBadge="tbl_hr_employee"
        data={filteredEmployees}
        columns={employeeColumns}
        rowKey={(r) => r.employeeId}
        searchPlaceholder="Search by emp code, employee name, mobile, email, department, designation, plant, or manager..."
        searchPredicate={(r, q) =>
          r.empCode.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q) ||
          r.mobileNo.toLowerCase().includes(q) ||
          (r.workEmail || '').toLowerCase().includes(q) ||
          r.deptName.toLowerCase().includes(q) ||
          r.deptCode.toLowerCase().includes(q) ||
          r.desigName.toLowerCase().includes(q) ||
          r.primaryBranchName.toLowerCase().includes(q) ||
          (r.reportingManagerName || '').toLowerCase().includes(q)
        }
        groupByOptions={groupByOptions}
        isLoading={isLoading}
        addButtonLabel="Add Employee"
        onAddClick={openCreateModal}
        onExportClick={() => {
          void handleExportCsv(filteredEmployees);
        }}
        onPrintClick={() => {
          void handlePrint();
        }}
        renderRowActions={(row) => (
          <div className="inline-flex items-center gap-1">
            <PermissionGate screen="EMPLOYEE_MASTER" action="EDIT">
              <button
                type="button"
                onClick={() => openEditModal(row)}
                title="Edit Employee"
                className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--brand-500)] transition cursor-pointer"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </PermissionGate>
            <PermissionGate screen="EMPLOYEE_MASTER" action="DELETE">
              <button
                type="button"
                onClick={() => openDeleteConfirm(row)}
                title="Delete Employee (Pre-Checked by DependencyCheckService)"
                className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          </div>
        )}
      />

      {/* Employee Create / Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!isSaving) setIsModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingEmployee
                    ? `Edit Employee — ${editingEmployee.empCode} (${editingEmployee.fullName})`
                    : 'Register New Employee'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Link employee to Company, Primary Plant/Branch, Department,
                  Designation, and Reporting Manager.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Section Tabs inside Modal */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 px-6">
              <button
                type="button"
                onClick={() => setFormTab('ORG')}
                className={`inline-flex items-center gap-2 border-b-2 py-2.5 px-3 text-xs font-semibold transition ${
                  formTab === 'ORG'
                    ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                1. Organization & Role Assignment
              </button>
              <button
                type="button"
                onClick={() => setFormTab('PERSONAL')}
                className={`inline-flex items-center gap-2 border-b-2 py-2.5 px-3 text-xs font-semibold transition ${
                  formTab === 'PERSONAL'
                    ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Phone className="h-3.5 w-3.5" />
                2. Contact, Emergency & Address
              </button>
              <button
                type="button"
                onClick={() => setFormTab('STATUTORY')}
                className={`inline-flex items-center gap-2 border-b-2 py-2.5 px-3 text-xs font-semibold transition ${
                  formTab === 'STATUTORY'
                    ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Landmark className="h-3.5 w-3.5" />
                3. Statutory (PAN/PF/ESI) & Payroll Bank
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-medium text-rose-600 dark:text-rose-300">
                  {formError}
                </div>
              )}

              {/* TAB 1: ORGANIZATION & ROLE ASSIGNMENT */}
              {formTab === 'ORG' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Company *
                    </label>
                    <select
                      value={empForm.compId}
                      onChange={(e) => {
                        const newCompId = Number(e.target.value);
                        const firstBranch = branches.find(
                          (b) => b.compId === newCompId,
                        );
                        const firstDept = departments.find(
                          (d) => d.compId === newCompId,
                        );
                        const firstDesig = designations.find(
                          (dg) => dg.compId === newCompId,
                        );
                        setEmpForm({
                          ...empForm,
                          compId: newCompId,
                          primaryBranchId: firstBranch?.branchId || '',
                          deptId: firstDept?.deptId || '',
                          desigId: firstDesig?.desigId || '',
                          reportingManagerId: '',
                        });
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    >
                      {companies.map((c) => (
                        <option key={c.compId} value={c.compId}>
                          {c.compCode} — {c.compName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Employee Code *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={30}
                      placeholder="e.g., EMP-1007"
                      value={empForm.empCode}
                      onChange={(e) =>
                        setEmpForm({
                          ...empForm,
                          empCode: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono text-xs uppercase text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Date of Joining (DOJ) *
                    </label>
                    <input
                      type="date"
                      required
                      value={empForm.dateOfJoining}
                      onChange={(e) =>
                        setEmpForm({
                          ...empForm,
                          dateOfJoining: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      placeholder="e.g.,Vikram"
                      value={empForm.firstName}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, firstName: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Last Name / Surname
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      placeholder="e.g., Rathod"
                      value={empForm.lastName}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, lastName: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Mobile Number *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={25}
                      placeholder="e.g., +91-9825011223"
                      value={empForm.mobileNo}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, mobileNo: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Primary Plant / Branch *
                    </label>
                    <select
                      required
                      value={empForm.primaryBranchId}
                      onChange={(e) =>
                        setEmpForm({
                          ...empForm,
                          primaryBranchId: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    >
                      <option value="">— Select Plant / Branch —</option>
                      {modalBranches.map((b) => (
                        <option key={b.branchId} value={b.branchId}>
                          {b.branchCode} — {b.branchName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Department *
                    </label>
                    <select
                      required
                      value={empForm.deptId}
                      onChange={(e) => {
                        const newDeptId = e.target.value;
                        const matchingDesigs = designations.filter(
                          (dg) =>
                            dg.compId === Number(empForm.compId) &&
                            (!newDeptId ||
                              !dg.deptId ||
                              dg.deptId === Number(newDeptId)),
                        );
                        setEmpForm({
                          ...empForm,
                          deptId: newDeptId,
                          desigId: matchingDesigs[0]?.desigId || '',
                        });
                      }}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    >
                      <option value="">— Select Department —</option>
                      {modalDepartments.map((d) => (
                        <option key={d.deptId} value={d.deptId}>
                          {d.deptCode} — {d.deptName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Job Designation *
                    </label>
                    <select
                      required
                      value={empForm.desigId}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, desigId: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    >
                      <option value="">— Select Designation —</option>
                      {modalDesignations.map((dg) => (
                        <option key={dg.desigId} value={dg.desigId}>
                          {dg.desigCode} — {dg.desigName} ({dg.gradeCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Reporting Manager (HOD / Supervisor)
                    </label>
                    <select
                      value={empForm.reportingManagerId}
                      onChange={(e) =>
                        setEmpForm({
                          ...empForm,
                          reportingManagerId: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    >
                      <option value="">— Top Level / Board —</option>
                      {modalManagers.map((m) => (
                        <option key={m.employeeId} value={m.employeeId}>
                          {m.empCode} — {m.fullName} ({m.desigName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Employment Type *
                    </label>
                    <select
                      value={empForm.employmentType}
                      onChange={(e) =>
                        setEmpForm({
                          ...empForm,
                          employmentType: e.target.value as EmploymentType,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    >
                      {(
                        Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[]
                      ).map((t) => (
                        <option key={t} value={t}>
                          {EMPLOYMENT_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Employment Status *
                    </label>
                    <select
                      value={empForm.employmentStatus}
                      onChange={(e) =>
                        setEmpForm({
                          ...empForm,
                          employmentStatus: e.target.value as EmploymentStatus,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    >
                      <option value="ACTIVE">Active On-Duty</option>
                      <option value="ON_NOTICE">Serving Notice Period</option>
                      <option value="SUSPENDED">Suspended / On Hold</option>
                      <option value="RELIEVED">Relieved / Exited</option>
                    </select>
                  </div>
                </div>
              )}

              {/* TAB 2: PERSONAL, CONTACT & ADDRESS */}
              {formTab === 'PERSONAL' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Official Work Email
                    </label>
                    <input
                      type="email"
                      maxLength={150}
                      placeholder="e.g., vikram.r@kashviramfg.com"
                      value={empForm.workEmail}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, workEmail: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Gender
                    </label>
                    <select
                      value={empForm.gender}
                      onChange={(e) =>
                        setEmpForm({
                          ...empForm,
                          gender: e.target.value as 'MALE' | 'FEMALE' | 'OTHER',
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={empForm.dateOfBirth}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, dateOfBirth: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Blood Group
                    </label>
                    <select
                      value={empForm.bloodGroup}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, bloodGroup: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    >
                      <option value="">— Select —</option>
                      {BLOOD_GROUPS.map((bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Emergency Contact Name
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      placeholder="e.g., Meera Rathod (Spouse)"
                      value={empForm.emergencyContactName}
                      onChange={(e) =>
                        setEmpForm({
                          ...empForm,
                          emergencyContactName: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Emergency Contact Phone
                    </label>
                    <input
                      type="text"
                      maxLength={25}
                      placeholder="e.g., +91-9825099887"
                      value={empForm.emergencyContactPhone}
                      onChange={(e) =>
                        setEmpForm({
                          ...empForm,
                          emergencyContactPhone: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Residential Address
                    </label>
                    <input
                      type="text"
                      maxLength={200}
                      placeholder="Flat / House No., Society, Landmark"
                      value={empForm.addressLine1}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, addressLine1: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      placeholder="e.g., Ahmedabad"
                      value={empForm.city}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, city: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      maxLength={80}
                      placeholder="e.g., Gujarat"
                      value={empForm.stateName}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, stateName: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      PIN Code
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="e.g., 380015"
                      value={empForm.pincode}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, pincode: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: STATUTORY & PAYROLL BANK */}
              {formTab === 'STATUTORY' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      PAN Number
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="e.g., ABCDE1234F"
                      value={empForm.panNo}
                      onChange={(e) =>
                        setEmpForm({
                          ...empForm,
                          panNo: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono text-xs uppercase text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Masked Aadhaar (Last 4 Digits)
                    </label>
                    <input
                      type="text"
                      maxLength={20}
                      placeholder="e.g., XXXX-XXXX-4589"
                      value={empForm.aadhaarMasked}
                      onChange={(e) =>
                        setEmpForm({
                          ...empForm,
                          aadhaarMasked: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      EPFO PF UAN Number
                    </label>
                    <input
                      type="text"
                      maxLength={25}
                      placeholder="e.g., 100987654321"
                      value={empForm.pfUanNo}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, pfUanNo: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      ESIC Insurance Number
                    </label>
                    <input
                      type="text"
                      maxLength={25}
                      placeholder="e.g., 3712345678"
                      value={empForm.esiNo}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, esiNo: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Payroll Bank Name
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      placeholder="e.g., HDFC Bank"
                      value={empForm.bankName}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, bankName: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Bank Account Number
                    </label>
                    <input
                      type="text"
                      maxLength={40}
                      placeholder="e.g., 50100234987654"
                      value={empForm.bankAccountNo}
                      onChange={(e) =>
                        setEmpForm({
                          ...empForm,
                          bankAccountNo: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Bank IFSC Code
                    </label>
                    <input
                      type="text"
                      maxLength={20}
                      placeholder="e.g., HDFC0000123"
                      value={empForm.bankIfscCode}
                      onChange={(e) =>
                        setEmpForm({
                          ...empForm,
                          bankIfscCode: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono text-xs uppercase text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      HR Remarks / Shopfloor Skill Notes
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      placeholder="Certifications, shift eligibility, or special authorization notes"
                      value={empForm.remarks}
                      onChange={(e) =>
                        setEmpForm({ ...empForm, remarks: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Active Toggle & Modal Footer */}
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={empForm.isActive}
                    onChange={(e) =>
                      setEmpForm({ ...empForm, isActive: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  Record Active for Attendance, Shopfloor & Security User Linking
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-500 disabled:opacity-50 transition"
                  >
                    {isSaving
                      ? 'Saving...'
                      : editingEmployee
                        ? 'Update Employee'
                        : 'Create Employee'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pre-Delete Dependency Verification Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        entityType="Employee"
        entityName={deleteTarget?.name || ''}
        entityCode={deleteTarget?.code}
        isDeleting={isDeleting}
        errorMessage={deleteError}
        dependencies={deleteDependencies}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
          setDeleteDependencies([]);
        }}
      />
    </div>
  );
};
