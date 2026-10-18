import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  Factory,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Gauge,
  HelpCircle,
  Layers,
  MapPin,
  PauseCircle,
  PlayCircle,
  Plus,
  Power,
  Printer,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  User,
  Users,
  Wrench,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { apiClient, type ApiResponse } from '../../lib/apiClient';
import {
  MasterDataTable,
  type MasterTableColumn,
  type GroupByOption,
} from '../../components/common/MasterDataTable';
import {
  ConfirmDeleteModal,
  type DependencyConflictItem,
} from '../../components/common/ConfirmDeleteModal';
import { PermissionGate } from '../../components/common/PermissionGate';

// ============================================================================
// TYPES & CATALOGUES
// ============================================================================

export type WorkCenterType =
  | 'MACHINE'
  | 'LINE_ASSEMBLY'
  | 'MANUAL'
  | 'FURNACE'
  | 'TEST_BENCH'
  | 'SUBCONTRACTOR';

export type WorkCenterStatus = 'ACTIVE' | 'UNDER_MAINTENANCE' | 'INACTIVE';

export type MachineStatus =
  | 'OPERATIONAL'
  | 'BREAKDOWN'
  | 'STANDBY'
  | 'DECOMMISSIONED';

export interface WorkCenterMachineRecord {
  wcMachineId?: number;
  workCenterId?: number;
  machineCode: string;
  machineName: string;
  modelNo?: string | null;
  serialNo?: string | null;
  manufacturer?: string | null;
  installationDate?: string | null;
  warrantyExpiryDate?: string | null;
  powerRatingKw?: number;
  status: MachineStatus;
  lastMaintenanceDate?: string | null;
  nextMaintenanceDue?: string | null;
  remarks?: string | null;
}

export interface WorkCenterShiftRecord {
  wcShiftId?: number;
  workCenterId?: number;
  shiftId: number;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  breakDurationMins: number;
  effectiveWorkingHours: number;
  isNightShift: boolean;
  daysOfWeek: string;
  operatorCount: number;
  remarks?: string | null;
}

export interface WorkCenterRecord {
  workCenterId: number;
  compId: number;
  branchId: number;
  fyearId?: number | null;
  workCenterCode: string;
  workCenterName: string;
  workCenterType: WorkCenterType;
  deptId?: number | null;
  deptCode?: string | null;
  deptName?: string | null;
  locationDesc?: string | null;
  capacityPerDayHours: number;
  efficiencyPercent: number;
  capacityUom: string;
  costPerHour: number;
  labourCostPerHour: number;
  overheadCostPerHour: number;
  totalHourlyRate: number;
  status: WorkCenterStatus;
  remarks?: string | null;
  createdDate: string;
  createdBy: number;
  createdByName?: string;
  machineCount?: number;
  operationalMachineCount?: number;
  shiftCount?: number;
  machines?: WorkCenterMachineRecord[];
  shifts?: WorkCenterShiftRecord[];
}

export interface WorkCenterSummary {
  totalWorkCenters: number;
  activeWorkCenters: number;
  totalDailyCapacityHours: number;
  avgEfficiencyPercent: number;
  totalMachines: number;
  operationalMachines: number;
}

export interface ShiftOption {
  shiftId: number;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  breakDurationMins: number;
  effectiveWorkingHours: number;
  isNightShift: boolean;
  remarks?: string | null;
}

export interface DepartmentOption {
  deptId: number;
  deptCode: string;
  deptName: string;
  deptCategory: string;
}

// Visual badging maps
const WORK_CENTER_STATUS_MAP: Record<
  WorkCenterStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  ACTIVE: {
    label: 'Operational Active',
    bg: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  UNDER_MAINTENANCE: {
    label: 'Under Maintenance',
    bg: 'bg-amber-500/10 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  INACTIVE: {
    label: 'Decommissioned / Inactive',
    bg: 'bg-rose-500/10 dark:bg-rose-950/30',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-300 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
};

const MACHINE_STATUS_MAP: Record<
  MachineStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  OPERATIONAL: {
    label: 'Operational',
    bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  BREAKDOWN: {
    label: 'Breakdown / Repair',
    bg: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800',
  },
  STANDBY: {
    label: 'Standby / Idle',
    bg: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
  },
  DECOMMISSIONED: {
    label: 'Decommissioned',
    bg: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800',
    text: 'text-slate-700 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-800',
  },
};

const WORK_CENTER_TYPE_MAP: Record<
  WorkCenterType,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  MACHINE: {
    label: 'Machining Center / CNC',
    bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
    icon: Cpu,
  },
  LINE_ASSEMBLY: {
    label: 'Assembly / Packaging Line',
    bg: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-800',
    icon: Factory,
  },
  MANUAL: {
    label: 'Manual Workstation',
    bg: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800',
    text: 'text-teal-700 dark:text-teal-400',
    border: 'border-teal-200 dark:border-teal-800',
    icon: Users,
  },
  FURNACE: {
    label: 'Furnace / Heat Treatment',
    bg: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
    icon: Flame,
  },
  TEST_BENCH: {
    label: 'Testing & QC Bench',
    bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
    icon: Gauge,
  },
  SUBCONTRACTOR: {
    label: 'External Subcontractor',
    bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    icon: Building2,
  },
};

// ============================================================================
// MAIN COMPONENT: WorkCenterMasterPage
// ============================================================================

export const WorkCenterMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Modals State
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingWcId, setEditingWcId] = useState<number | null>(null);
  const [editorActiveTab, setEditorActiveTab] = useState<'GENERAL' | 'MACHINES' | 'SHIFTS_COSTING'>('GENERAL');

  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [selectedWcId, setSelectedWcId] = useState<number | null>(null);

  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState<boolean>(false);
  const [maintenanceTargetWc, setMaintenanceTargetWc] = useState<WorkCenterRecord | null>(null);
  const [selectedMachineToMaintain, setSelectedMachineToMaintain] = useState<WorkCenterMachineRecord | null>(null);
  const [maintStatus, setMaintStatus] = useState<MachineStatus>('OPERATIONAL');
  const [maintRemarks, setMaintRemarks] = useState<string>('');
  const [maintLastDate, setMaintLastDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [maintNextDue, setMaintNextDue] = useState<string>(
    new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
  );

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printTargetWcId, setPrintTargetWcId] = useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<WorkCenterRecord | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [deleteConflicts, setDeleteConflicts] = useState<DependencyConflictItem[]>([]);

  // Shift Quick Add Modal
  const [isShiftModalOpen, setIsShiftModalOpen] = useState<boolean>(false);
  const [shiftCodeInput, setShiftCodeInput] = useState<string>('');
  const [shiftNameInput, setShiftNameInput] = useState<string>('');
  const [shiftStartInput, setShiftStartInput] = useState<string>('08:00:00');
  const [shiftEndInput, setShiftEndInput] = useState<string>('16:30:00');
  const [shiftBreakInput, setShiftBreakInput] = useState<number>(30);
  const [shiftWorkingHoursInput, setShiftWorkingHoursInput] = useState<number>(8.0);
  const [shiftIsNightInput, setShiftIsNightInput] = useState<boolean>(false);

  // Form State for Work Center Creation / Editing
  const [formCode, setFormCode] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formType, setFormType] = useState<WorkCenterType>('MACHINE');
  const [formDeptId, setFormDeptId] = useState<number | ''>('');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formCapacityPerDayHours, setFormCapacityPerDayHours] = useState<number>(8.0);
  const [formEfficiencyPercent, setFormEfficiencyPercent] = useState<number>(85.0);
  const [formCapacityUom, setFormCapacityUom] = useState<string>('HOURS');
  const [formCostPerHour, setFormCostPerHour] = useState<number>(0);
  const [formLabourCostPerHour, setFormLabourCostPerHour] = useState<number>(0);
  const [formOverheadCostPerHour, setFormOverheadCostPerHour] = useState<number>(0);
  const [formStatus, setFormStatus] = useState<WorkCenterStatus>('ACTIVE');
  const [formRemarks, setFormRemarks] = useState<string>('');

  // Form Machines Array
  const [formMachines, setFormMachines] = useState<
    {
      wcMachineId?: number;
      machineCode: string;
      machineName: string;
      modelNo: string;
      serialNo: string;
      manufacturer: string;
      installationDate: string;
      warrantyExpiryDate: string;
      powerRatingKw: number;
      status: MachineStatus;
      lastMaintenanceDate: string;
      nextMaintenanceDue: string;
      remarks: string;
    }[]
  >([]);

  // Form Shifts Array
  const [formShifts, setFormShifts] = useState<
    {
      wcShiftId?: number;
      shiftId: number;
      daysOfWeek: string;
      operatorCount: number;
      remarks: string;
    }[]
  >([]);

  // --------------------------------------------------------------------------
  // Server Queries
  // --------------------------------------------------------------------------

  // 1. KPI Summary
  const { data: summary, isLoading: isSummaryLoading } = useQuery<WorkCenterSummary>({
    queryKey: ['manufacturing', 'work-centers', 'summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<WorkCenterSummary>>(
        '/manufacturing/work-centers/summary',
      );
      return res.data.data;
    },
  });

  // 2. Work Center Listing
  const {
    data: workCenters = [],
    isLoading: isListLoading,
    refetch: refetchWorkCenters,
  } = useQuery<WorkCenterRecord[]>({
    queryKey: [
      'manufacturing',
      'work-centers',
      statusFilter,
      typeFilter,
      deptFilter,
      globalSearch,
    ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (typeFilter !== 'ALL') params.workCenterType = typeFilter;
      if (deptFilter !== 'ALL') params.deptId = deptFilter;
      if (globalSearch.trim()) params.search = globalSearch.trim();

      const res = await apiClient.get<ApiResponse<WorkCenterRecord[]>>(
        '/manufacturing/work-centers',
        { params },
      );
      return res.data.data;
    },
  });

  // 3. Departments Lookup
  const { data: departments = [] } = useQuery<DepartmentOption[]>({
    queryKey: ['manufacturing', 'work-centers', 'departments'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<DepartmentOption[]>>(
        '/manufacturing/work-centers/departments',
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });

  // 4. Shifts Lookup
  const { data: shiftsCatalog = [], refetch: refetchShifts } = useQuery<ShiftOption[]>({
    queryKey: ['manufacturing', 'work-centers', 'shifts'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ShiftOption[]>>(
        '/manufacturing/work-centers/shifts',
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });

  // 5. Single Work Center Detail Query
  const detailQueryId = selectedWcId || printTargetWcId || (isEditorOpen && editingWcId ? editingWcId : null);
  const { data: selectedWcDetail } = useQuery<WorkCenterRecord>({
    queryKey: ['manufacturing', 'work-centers', 'detail', detailQueryId],
    queryFn: async () => {
      if (!detailQueryId) throw new Error('No Work Center selected');
      const res = await apiClient.get<ApiResponse<WorkCenterRecord>>(
        `/manufacturing/work-centers/${detailQueryId}`,
      );
      return res.data.data;
    },
    enabled: Boolean(detailQueryId),
  });

  // --------------------------------------------------------------------------
  // Cost & Capacity Computations
  // --------------------------------------------------------------------------
  const calculatedTotalHourlyRate = useMemo(() => {
    const m = Number(formCostPerHour) || 0;
    const l = Number(formLabourCostPerHour) || 0;
    const o = Number(formOverheadCostPerHour) || 0;
    return Math.round((m + l + o) * 100) / 100;
  }, [formCostPerHour, formLabourCostPerHour, formOverheadCostPerHour]);

  const calculatedDailyEffectiveHours = useMemo(() => {
    const rawHrs = Number(formCapacityPerDayHours) || 0;
    const eff = Number(formEfficiencyPercent) || 0;
    return Math.round(rawHrs * (eff / 100) * 10) / 10;
  }, [formCapacityPerDayHours, formEfficiencyPercent]);

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  // Save Work Center (Create or Edit)
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formName.trim()) throw new Error('Work Center Name is required.');

      const payload = {
        workCenterCode: formCode.trim() || undefined,
        workCenterName: formName.trim(),
        workCenterType: formType,
        deptId: formDeptId ? Number(formDeptId) : undefined,
        locationDesc: formLocation.trim() || undefined,
        capacityPerDayHours: Number(formCapacityPerDayHours) || 8.0,
        efficiencyPercent: Number(formEfficiencyPercent) || 85.0,
        capacityUom: formCapacityUom || 'HOURS',
        costPerHour: Number(formCostPerHour) || 0,
        labourCostPerHour: Number(formLabourCostPerHour) || 0,
        overheadCostPerHour: Number(formOverheadCostPerHour) || 0,
        status: formStatus,
        remarks: formRemarks.trim() || undefined,
        machines: formMachines.map((m) => ({
          wcMachineId: m.wcMachineId,
          machineCode: m.machineCode.trim() || undefined,
          machineName: m.machineName.trim(),
          modelNo: m.modelNo?.trim() || undefined,
          serialNo: m.serialNo?.trim() || undefined,
          manufacturer: m.manufacturer?.trim() || undefined,
          installationDate: m.installationDate || undefined,
          warrantyExpiryDate: m.warrantyExpiryDate || undefined,
          powerRatingKw: Number(m.powerRatingKw) || 0,
          status: m.status,
          lastMaintenanceDate: m.lastMaintenanceDate || undefined,
          nextMaintenanceDue: m.nextMaintenanceDue || undefined,
          remarks: m.remarks?.trim() || undefined,
        })),
        shifts: formShifts.map((s) => ({
          wcShiftId: s.wcShiftId,
          shiftId: Number(s.shiftId),
          daysOfWeek: s.daysOfWeek || 'MON,TUE,WED,THU,FRI,SAT',
          operatorCount: Number(s.operatorCount) || 1,
          remarks: s.remarks?.trim() || undefined,
        })),
      };

      if (editingWcId) {
        return apiClient.put(`/manufacturing/work-centers/${editingWcId}`, payload);
      } else {
        return apiClient.post('/manufacturing/work-centers', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing', 'work-centers'] });
      setIsEditorOpen(false);
      resetForm();
    },
  });

  // Machine Maintenance Status Update
  const maintenanceMutation = useMutation({
    mutationFn: async () => {
      if (!maintenanceTargetWc || !selectedMachineToMaintain) return;
      return apiClient.post(
        `/manufacturing/work-centers/${maintenanceTargetWc.workCenterId}/machines/${selectedMachineToMaintain.wcMachineId}/maintenance`,
        {
          status: maintStatus,
          remarks: maintRemarks.trim() || undefined,
          lastMaintenanceDate: maintLastDate || undefined,
          nextMaintenanceDue: maintNextDue || undefined,
        },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing', 'work-centers'] });
      setIsMaintenanceModalOpen(false);
      setMaintenanceTargetWc(null);
      setSelectedMachineToMaintain(null);
    },
  });

  // Shift Creation
  const createShiftMutation = useMutation({
    mutationFn: async () => {
      if (!shiftCodeInput.trim()) throw new Error('Shift Code is required.');
      if (!shiftNameInput.trim()) throw new Error('Shift Name is required.');
      return apiClient.post('/manufacturing/work-centers/shifts', {
        shiftCode: shiftCodeInput.trim().toUpperCase(),
        shiftName: shiftNameInput.trim(),
        startTime: shiftStartInput,
        endTime: shiftEndInput,
        breakDurationMins: Number(shiftBreakInput) || 30,
        effectiveWorkingHours: Number(shiftWorkingHoursInput) || 8.0,
        isNightShift: shiftIsNightInput,
      });
    },
    onSuccess: () => {
      refetchShifts();
      setIsShiftModalOpen(false);
      setShiftCodeInput('');
      setShiftNameInput('');
    },
  });

  // Delete Work Center
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      return apiClient.delete(`/manufacturing/work-centers/${deleteTarget.workCenterId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing', 'work-centers'] });
      setDeleteTarget(null);
      setDeleteErrorMessage(null);
      setDeleteConflicts([]);
    },
    onError: (err: any) => {
      const resp = err.response?.data;
      setDeleteErrorMessage(resp?.message || 'Failed to delete Work Center.');
      if (resp?.details?.conflicts) {
        setDeleteConflicts(resp.details.conflicts);
      }
    },
  });

  // --------------------------------------------------------------------------
  // Form Handlers
  // --------------------------------------------------------------------------
  const resetForm = () => {
    setEditingWcId(null);
    setFormCode('');
    setFormName('');
    setFormType('MACHINE');
    setFormDeptId('');
    setFormLocation('');
    setFormCapacityPerDayHours(8.0);
    setFormEfficiencyPercent(85.0);
    setFormCapacityUom('HOURS');
    setFormCostPerHour(0);
    setFormLabourCostPerHour(0);
    setFormOverheadCostPerHour(0);
    setFormStatus('ACTIVE');
    setFormRemarks('');
    setFormMachines([]);
    setFormShifts([]);
    setEditorActiveTab('GENERAL');
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = (wc: WorkCenterRecord) => {
    setEditingWcId(wc.workCenterId);
    setFormCode(wc.workCenterCode);
    setFormName(wc.workCenterName);
    setFormType(wc.workCenterType);
    setFormDeptId(wc.deptId || '');
    setFormLocation(wc.locationDesc || '');
    setFormCapacityPerDayHours(Number(wc.capacityPerDayHours) || 8.0);
    setFormEfficiencyPercent(Number(wc.efficiencyPercent) || 85.0);
    setFormCapacityUom(wc.capacityUom || 'HOURS');
    setFormCostPerHour(Number(wc.costPerHour) || 0);
    setFormLabourCostPerHour(Number(wc.labourCostPerHour) || 0);
    setFormOverheadCostPerHour(Number(wc.overheadCostPerHour) || 0);
    setFormStatus(wc.status);
    setFormRemarks(wc.remarks || '');

    // Fetch full detail with machines and shifts
    apiClient
      .get<ApiResponse<WorkCenterRecord>>(`/manufacturing/work-centers/${wc.workCenterId}`)
      .then((res) => {
        const d = res.data.data;
        if (d.machines) {
          setFormMachines(
            d.machines.map((m) => ({
              wcMachineId: m.wcMachineId,
              machineCode: m.machineCode,
              machineName: m.machineName,
              modelNo: m.modelNo || '',
              serialNo: m.serialNo || '',
              manufacturer: m.manufacturer || '',
              installationDate: m.installationDate ? m.installationDate.split('T')[0] : '',
              warrantyExpiryDate: m.warrantyExpiryDate ? m.warrantyExpiryDate.split('T')[0] : '',
              powerRatingKw: Number(m.powerRatingKw) || 0,
              status: m.status,
              lastMaintenanceDate: m.lastMaintenanceDate ? m.lastMaintenanceDate.split('T')[0] : '',
              nextMaintenanceDue: m.nextMaintenanceDue ? m.nextMaintenanceDue.split('T')[0] : '',
              remarks: m.remarks || '',
            })),
          );
        }
        if (d.shifts) {
          setFormShifts(
            d.shifts.map((s) => ({
              wcShiftId: s.wcShiftId,
              shiftId: s.shiftId,
              daysOfWeek: s.daysOfWeek || 'MON,TUE,WED,THU,FRI,SAT',
              operatorCount: s.operatorCount || 1,
              remarks: s.remarks || '',
            })),
          );
        }
      });

    setEditorActiveTab('GENERAL');
    setIsEditorOpen(true);
  };

  const handleAddMachineRow = () => {
    setFormMachines((prev) => [
      ...prev,
      {
        machineCode: '',
        machineName: 'New Machine / Asset',
        modelNo: '',
        serialNo: '',
        manufacturer: '',
        installationDate: new Date().toISOString().split('T')[0],
        warrantyExpiryDate: '',
        powerRatingKw: 15.0,
        status: 'OPERATIONAL',
        lastMaintenanceDate: '',
        nextMaintenanceDue: '',
        remarks: '',
      },
    ]);
  };

  const handleUpdateMachineRow = (index: number, patch: Partial<(typeof formMachines)[0]>) => {
    setFormMachines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleRemoveMachineRow = (index: number) => {
    setFormMachines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToggleShiftSelection = (shiftId: number) => {
    setFormShifts((prev) => {
      const exists = prev.find((s) => s.shiftId === shiftId);
      if (exists) {
        return prev.filter((s) => s.shiftId !== shiftId);
      } else {
        return [
          ...prev,
          {
            shiftId,
            daysOfWeek: 'MON,TUE,WED,THU,FRI,SAT',
            operatorCount: 1,
            remarks: '',
          },
        ];
      }
    });
  };

  // --------------------------------------------------------------------------
  // MasterDataTable Columns Configuration
  // --------------------------------------------------------------------------
  const columns: MasterTableColumn<WorkCenterRecord>[] = [
    {
      key: 'workCenterCode',
      header: 'Work Center',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 font-semibold text-primary">
            <Cpu className="h-4 w-4 text-blue-500 shrink-0" />
            <span>{row.workCenterCode}</span>
          </div>
          <span className="text-xs text-foreground font-medium truncate max-w-[220px]">
            {row.workCenterName}
          </span>
          {row.locationDesc && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-2.5 w-2.5" />
              {row.locationDesc}
            </span>
          )}
        </div>
      ),
      sortValue: (row) => row.workCenterCode,
    },
    {
      key: 'workCenterType',
      header: 'Classification',
      sortable: true,
      align: 'center',
      render: (row) => {
        const meta = WORK_CENTER_TYPE_MAP[row.workCenterType] || WORK_CENTER_TYPE_MAP.MACHINE;
        const IconComponent = meta.icon;
        return (
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full border ${meta.bg}`}
          >
            <IconComponent className="h-3 w-3 shrink-0" />
            {meta.label}
          </span>
        );
      },
      sortValue: (row) => row.workCenterType,
    },
    {
      key: 'deptName',
      header: 'Department / Shopfloor',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-foreground">
            {row.deptName || 'Plant General'}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {row.deptCode || 'PROD'}
          </span>
        </div>
      ),
      sortValue: (row) => row.deptName || '',
    },
    {
      key: 'capacity',
      header: 'Rated Capacity & OEE',
      align: 'right',
      render: (row) => {
        const effHrs = Math.round(Number(row.capacityPerDayHours) * (Number(row.efficiencyPercent) / 100) * 10) / 10;
        return (
          <div className="text-right">
            <div className="font-semibold text-foreground font-mono">
              {Number(row.capacityPerDayHours).toFixed(1)} hrs/day
            </div>
            <span className="text-[10px] text-muted-foreground">
              Eff: {effHrs} hrs ({row.efficiencyPercent}%)
            </span>
          </div>
        );
      },
    },
    {
      key: 'totalHourlyRate',
      header: 'Total Hourly Rate',
      align: 'right',
      sortable: true,
      render: (row) => (
        <div className="text-right">
          <div className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
            ₹{Number(row.totalHourlyRate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}/hr
          </div>
          <span className="text-[10px] text-muted-foreground">
            Mch: ₹{Number(row.costPerHour).toFixed(0)} · Lab: ₹{Number(row.labourCostPerHour).toFixed(0)}
          </span>
        </div>
      ),
      sortValue: (row) => row.totalHourlyRate,
    },
    {
      key: 'machines',
      header: 'Machines & Assets',
      align: 'center',
      render: (row) => {
        const total = row.machineCount || 0;
        const op = row.operationalMachineCount || 0;
        const hasBreakdown = op < total;
        return (
          <div className="inline-flex flex-col items-center">
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border ${
                hasBreakdown
                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800'
                  : 'bg-secondary text-foreground border-border'
              }`}
            >
              <Wrench className="h-3 w-3" />
              {op}/{total} Operational
            </span>
            {hasBreakdown && (
              <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                {total - op} Machine(s) Down
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'shifts',
      header: 'Shifts',
      align: 'center',
      render: (row) => (
        <span className="text-xs font-medium text-foreground bg-muted/60 px-2 py-0.5 rounded-full">
          {row.shiftCount || 0} Shift(s) Active
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      align: 'center',
      render: (row) => {
        const meta = WORK_CENTER_STATUS_MAP[row.status] || WORK_CENTER_STATUS_MAP.ACTIVE;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        );
      },
      sortValue: (row) => row.status,
    },
  ];

  // Group By Options
  const groupByOptions: GroupByOption<WorkCenterRecord>[] = [
    {
      key: 'status',
      label: 'Status (Active / Under Maintenance / Inactive)',
      groupValue: (row) => row.status,
    },
    {
      key: 'workCenterType',
      label: 'Classification (Machine / Assembly Line / Furnace)',
      groupValue: (row) => row.workCenterType,
    },
    {
      key: 'deptName',
      label: 'Department (Machine Shop / Foundry / Assembly)',
      groupValue: (row) => row.deptName || 'Unassigned Dept',
    },
  ];

  // Search Predicate
  const searchPredicate = (row: WorkCenterRecord, query: string): boolean => {
    const q = query.toLowerCase();
    return (
      row.workCenterCode.toLowerCase().includes(q) ||
      row.workCenterName.toLowerCase().includes(q) ||
      (row.locationDesc || '').toLowerCase().includes(q) ||
      (row.deptName || '').toLowerCase().includes(q) ||
      (row.remarks || '').toLowerCase().includes(q)
    );
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      'Work Center Code',
      'Name',
      'Type',
      'Department',
      'Location / Bay',
      'Daily Capacity (Hours)',
      'Efficiency %',
      'Machine Cost (₹/hr)',
      'Labour Cost (₹/hr)',
      'Overhead Cost (₹/hr)',
      'Total Hourly Rate (₹/hr)',
      'Status',
    ];
    const rows = workCenters.map((wc) => [
      `"${wc.workCenterCode}"`,
      `"${wc.workCenterName.replace(/"/g, '""')}"`,
      `"${wc.workCenterType}"`,
      `"${wc.deptName || ''}"`,
      `"${(wc.locationDesc || '').replace(/"/g, '""')}"`,
      wc.capacityPerDayHours,
      wc.efficiencyPercent,
      wc.costPerHour,
      wc.labourCostPerHour,
      wc.overheadCostPerHour,
      wc.totalHourlyRate,
      `"${wc.status}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Work_Centers_Register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header Section */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Cpu className="h-6 w-6 text-primary" />
            Work Centers, Plant Capacities & Machinery Assets
          </h1>
          <p className="text-sm text-muted-foreground">
            Production cells, shift calendars, machine breakdown logs, capacity planning & hourly absorption rates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Shift Master Shortcut */}
          <button
            type="button"
            onClick={() => setIsShiftModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-input bg-background text-foreground text-xs font-medium hover:bg-muted transition-colors shadow-xs"
          >
            <Clock className="h-3.5 w-3.5 text-primary" />
            Shift Calendars ({shiftsCatalog.length})
          </button>

          <PermissionGate screen="MFG_WORK_CENTER" action="ADD">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm shadow hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Work Center
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. KPI Summary Cards */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Work Centers */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Work Centers</span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {isSummaryLoading ? '...' : summary?.totalWorkCenters || 0}
            </span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
              {summary?.activeWorkCenters || 0} Active
            </span>
          </div>
        </div>

        {/* KPI 2: Daily Rated Capacity */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Daily Rated Capacity</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {isSummaryLoading ? '...' : summary?.totalDailyCapacityHours || 0}
            </span>
            <span className="text-xs text-muted-foreground">Hours / Day Available</span>
          </div>
        </div>

        {/* KPI 3: Machinery Assets */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Machinery & Equipment</span>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Wrench className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {isSummaryLoading ? '...' : summary?.totalMachines || 0}
            </span>
            <span className="text-xs text-muted-foreground">
              ({summary?.operationalMachines || 0} Operational)
            </span>
          </div>
        </div>

        {/* KPI 4: Weighted OEE Efficiency */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Weighted Factory Efficiency</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {isSummaryLoading ? '...' : `${summary?.avgEfficiencyPercent || 0}%`}
            </span>
            <span className="text-xs text-muted-foreground">OEE Standard Rating</span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. Filter Toolbar Slot */}
      {/* -------------------------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs rounded-md border border-input bg-background px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Operational Active</option>
                <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                <option value="INACTIVE">Inactive / Decommissioned</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Classification:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs rounded-md border border-input bg-background px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Classifications</option>
                <option value="MACHINE">Machining Center / CNC</option>
                <option value="LINE_ASSEMBLY">Assembly Line</option>
                <option value="MANUAL">Manual Workstation</option>
                <option value="FURNACE">Furnace / Heat Treatment</option>
                <option value="TEST_BENCH">Testing Bench</option>
                <option value="SUBCONTRACTOR">External Subcontractor</option>
              </select>
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Department:</span>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="text-xs rounded-md border border-input bg-background px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.deptId} value={d.deptId}>
                    {d.deptName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setTypeFilter('ALL');
                setDeptFilter('ALL');
                setGlobalSearch('');
              }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-muted transition-colors flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 4. Master Data Table */}
      {/* -------------------------------------------------------------------- */}
      <MasterDataTable<WorkCenterRecord>
        title="Work Centers & Machine Cells Register"
        subtitle="Manage shopfloor workstations, machine tool assets, shift schedules, and capacity costing"
        screenCode="MFG_WORK_CENTER"
        tableNameBadge="tbl_mfg_work_center"
        data={workCenters}
        rowKey={(row) => row.workCenterId}
        columns={columns}
        searchPlaceholder="Search by work center code, description, location bay, or department..."
        searchPredicate={searchPredicate}
        groupByOptions={groupByOptions}
        addButtonLabel="New Work Center"
        onAddClick={handleOpenCreateModal}
        onExportClick={handleExportCsv}
        pageSize={15}
        isLoading={isListLoading}
        renderRowActions={(row) => (
          <div className="flex items-center justify-end gap-1">
            {/* View Details */}
            <button
              type="button"
              title="View Work Center Details"
              onClick={() => {
                setSelectedWcId(row.workCenterId);
                setIsDetailOpen(true);
              }}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              <Eye className="h-4 w-4" />
            </button>

            {/* Maintenance & Status Log */}
            <PermissionGate screen="MFG_WORK_CENTER" action="MAINTENANCE">
              <button
                type="button"
                title="Log Machinery Maintenance / Breakdown"
                onClick={() => {
                  setMaintenanceTargetWc(row);
                  // Load full detail to get machines
                  apiClient
                    .get<ApiResponse<WorkCenterRecord>>(`/manufacturing/work-centers/${row.workCenterId}`)
                    .then((res) => {
                      const d = res.data.data;
                      if (d.machines && d.machines.length > 0) {
                        setSelectedMachineToMaintain(d.machines[0]);
                        setMaintStatus(d.machines[0].status);
                        setMaintRemarks(d.machines[0].remarks || '');
                      }
                    });
                  setIsMaintenanceModalOpen(true);
                }}
                className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-md transition-colors"
              >
                <Wrench className="h-4 w-4" />
              </button>
            </PermissionGate>

            {/* Edit */}
            <PermissionGate screen="MFG_WORK_CENTER" action="EDIT">
              <button
                type="button"
                title="Edit Work Center"
                onClick={() => handleOpenEditModal(row)}
                className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </PermissionGate>

            {/* Print Datasheet */}
            <PermissionGate screen="MFG_WORK_CENTER" action="PRINT">
              <button
                type="button"
                title="Print Work Center Capacity Sheet"
                onClick={() => {
                  setPrintTargetWcId(row.workCenterId);
                  setIsPrintModalOpen(true);
                }}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              >
                <Printer className="h-4 w-4" />
              </button>
            </PermissionGate>

            {/* Delete */}
            <PermissionGate screen="MFG_WORK_CENTER" action="DELETE">
              <button
                type="button"
                title="Delete Work Center"
                onClick={() => {
                  setDeleteTarget(row);
                  setDeleteErrorMessage(null);
                  setDeleteConflicts([]);
                }}
                className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          </div>
        )}
      />

      {/* -------------------------------------------------------------------- */}
      {/* 5. Work Center Creation / Edit Multi-Tab Modal */}
      {/* -------------------------------------------------------------------- */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Cpu className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {editingWcId ? `Edit Work Center: ${formCode}` : 'Create New Work Center'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Define production cell capacity, installed machine tools, shifts & cost absorption
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center border-b border-border bg-muted/20 px-6">
              <button
                type="button"
                onClick={() => setEditorActiveTab('GENERAL')}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                  editorActiveTab === 'GENERAL'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Tag className="h-4 w-4" />
                1. General Specifications & Capacity
              </button>

              <button
                type="button"
                onClick={() => setEditorActiveTab('MACHINES')}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                  editorActiveTab === 'MACHINES'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Wrench className="h-4 w-4" />
                2. Machinery & Equipment ({formMachines.length})
              </button>

              <button
                type="button"
                onClick={() => setEditorActiveTab('SHIFTS_COSTING')}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                  editorActiveTab === 'SHIFTS_COSTING'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <DollarSign className="h-4 w-4" />
                3. Shifts & Hourly Cost Rates
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Tab 1: General */}
              {editorActiveTab === 'GENERAL' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Code */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Work Center Code (Blank for auto-seq)
                    </label>
                    <input
                      type="text"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="e.g. WC-CNC-01"
                      className="w-full text-xs font-mono rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Name */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Work Center Name / Production Bay <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. CNC Precision Turning & Milling Cell 1"
                      className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Classification Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Classification <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as WorkCenterType)}
                      className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="MACHINE">Machining Center / CNC</option>
                      <option value="LINE_ASSEMBLY">Assembly Line</option>
                      <option value="MANUAL">Manual Workstation</option>
                      <option value="FURNACE">Furnace / Heat Treatment</option>
                      <option value="TEST_BENCH">Testing Bench</option>
                      <option value="SUBCONTRACTOR">External Subcontractor</option>
                    </select>
                  </div>

                  {/* Department */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Shopfloor Department</label>
                    <select
                      value={formDeptId}
                      onChange={(e) => setFormDeptId(e.target.value ? Number(e.target.value) : '')}
                      className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select Department...</option>
                      {departments.map((d) => (
                        <option key={d.deptId} value={d.deptId}>
                          {d.deptName} ({d.deptCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Operational Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as WorkCenterStatus)}
                      className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="ACTIVE">Operational Active</option>
                      <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                      <option value="INACTIVE">Decommissioned / Inactive</option>
                    </select>
                  </div>

                  {/* Physical Location / Bay */}
                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Physical Shopfloor Location / Bay Details
                    </label>
                    <input
                      type="text"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder="e.g. Bay 1 - North Machining Annex, Ground Floor"
                      className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Capacity Per Day (Hours) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Standard Daily Capacity (Hours) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={formCapacityPerDayHours}
                      onChange={(e) => setFormCapacityPerDayHours(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Efficiency Percent */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Efficiency / OEE Rating (%) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={formEfficiencyPercent}
                      onChange={(e) => setFormEfficiencyPercent(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Capacity Summary Note */}
                  <div className="p-3 bg-muted/40 rounded-lg text-xs flex flex-col justify-center">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                      Calculated Effective Capacity
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {calculatedDailyEffectiveHours} Effective Hours / Day
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Theoretical Monthly (25 Days): {Math.round(calculatedDailyEffectiveHours * 25)} hrs
                    </span>
                  </div>

                  {/* Remarks */}
                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Operational Notes & Remarks</label>
                    <textarea
                      rows={2}
                      value={formRemarks}
                      onChange={(e) => setFormRemarks(e.target.value)}
                      placeholder="Add cell capabilities, tooling restrictions or technical notes..."
                      className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Machines */}
              {editorActiveTab === 'MACHINES' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Installed Machines & Tooling Assets</h3>
                      <p className="text-xs text-muted-foreground">
                        Register CNC machines, automated equipment, furnaces or test rigs assigned to this work center
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMachineRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Machine
                    </button>
                  </div>

                  {formMachines.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                      <Wrench className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-medium text-foreground">No machines assigned to this work center</p>
                      <p className="text-xs text-muted-foreground mt-1 mb-4">
                        If this work center has capital equipment, click below to assign machinery.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddMachineRow}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add First Machine
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-border rounded-xl">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 border-b border-border">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                            <th className="px-3 py-2 text-left font-semibold text-muted-foreground min-w-[140px]">
                              Machine Code
                            </th>
                            <th className="px-3 py-2 text-left font-semibold text-muted-foreground min-w-[200px]">
                              Machine Name & Model
                            </th>
                            <th className="px-3 py-2 text-left font-semibold text-muted-foreground min-w-[120px]">
                              Manufacturer
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-muted-foreground w-20">
                              Power (kW)
                            </th>
                            <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Status</th>
                            <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {formMachines.map((m, idx) => (
                            <tr key={idx} className="hover:bg-muted/20">
                              <td className="px-3 py-2 text-muted-foreground font-mono">{idx + 1}</td>

                              {/* Code */}
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={m.machineCode}
                                  onChange={(e) =>
                                    handleUpdateMachineRow(idx, { machineCode: e.target.value })
                                  }
                                  placeholder="Auto / Code"
                                  className="w-full text-xs font-mono rounded border border-input bg-background px-2 py-1 focus:ring-1 focus:ring-primary"
                                />
                              </td>

                              {/* Name & Model */}
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={m.machineName}
                                  onChange={(e) =>
                                    handleUpdateMachineRow(idx, { machineName: e.target.value })
                                  }
                                  placeholder="Machine Name"
                                  className="w-full text-xs font-medium rounded border border-input bg-background px-2 py-1 mb-1 focus:ring-1 focus:ring-primary"
                                />
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={m.modelNo}
                                    onChange={(e) =>
                                      handleUpdateMachineRow(idx, { modelNo: e.target.value })
                                    }
                                    placeholder="Model No"
                                    className="w-1/2 text-[10px] rounded border border-input bg-background px-1.5 py-0.5"
                                  />
                                  <input
                                    type="text"
                                    value={m.serialNo}
                                    onChange={(e) =>
                                      handleUpdateMachineRow(idx, { serialNo: e.target.value })
                                    }
                                    placeholder="Serial No"
                                    className="w-1/2 text-[10px] rounded border border-input bg-background px-1.5 py-0.5"
                                  />
                                </div>
                              </td>

                              {/* Manufacturer */}
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={m.manufacturer}
                                  onChange={(e) =>
                                    handleUpdateMachineRow(idx, { manufacturer: e.target.value })
                                  }
                                  placeholder="OEM Manufacturer"
                                  className="w-full text-xs rounded border border-input bg-background px-2 py-1 focus:ring-1 focus:ring-primary"
                                />
                              </td>

                              {/* Power kW */}
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={m.powerRatingKw}
                                  onChange={(e) =>
                                    handleUpdateMachineRow(idx, {
                                      powerRatingKw: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-16 text-xs text-right font-mono rounded border border-input bg-background px-2 py-1 focus:ring-1 focus:ring-primary"
                                />
                              </td>

                              {/* Status */}
                              <td className="px-3 py-2 text-center">
                                <select
                                  value={m.status}
                                  onChange={(e) =>
                                    handleUpdateMachineRow(idx, {
                                      status: e.target.value as MachineStatus,
                                    })
                                  }
                                  className="text-[11px] rounded border border-input bg-background px-2 py-1 focus:ring-1 focus:ring-primary"
                                >
                                  <option value="OPERATIONAL">OPERATIONAL</option>
                                  <option value="BREAKDOWN">BREAKDOWN</option>
                                  <option value="STANDBY">STANDBY</option>
                                  <option value="DECOMMISSIONED">DECOMMISSIONED</option>
                                </select>
                              </td>

                              {/* Delete */}
                              <td className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMachineRow(idx)}
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Shifts & Hourly Costing */}
              {editorActiveTab === 'SHIFTS_COSTING' && (
                <div className="space-y-6">
                  {/* Shifts allocation */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          Assigned Factory Production Shifts
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Select the operational shifts that run in this work center
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      {shiftsCatalog.map((s) => {
                        const isSelected = formShifts.some((fs) => fs.shiftId === s.shiftId);
                        const assignedShift = formShifts.find((fs) => fs.shiftId === s.shiftId);

                        return (
                          <div
                            key={s.shiftId}
                            onClick={() => handleToggleShiftSelection(s.shiftId)}
                            className={`p-3 rounded-lg border transition-colors cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-primary/10 border-primary text-foreground'
                                : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`h-5 w-5 rounded flex items-center justify-center border ${
                                  isSelected
                                    ? 'bg-primary border-primary text-primary-foreground'
                                    : 'border-input bg-background'
                                }`}
                              >
                                {isSelected && <Check className="h-3.5 w-3.5" />}
                              </div>
                              <div>
                                <span className="font-bold text-xs text-foreground block">
                                  {s.shiftName} ({s.shiftCode})
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)} ({s.effectiveWorkingHours} hrs working)
                                </span>
                              </div>
                            </div>

                            {isSelected && (
                              <div
                                className="flex items-center gap-1.5 text-xs"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Users className="h-3.5 w-3.5 text-primary" />
                                <input
                                  type="number"
                                  min="1"
                                  value={assignedShift?.operatorCount || 1}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1;
                                    setFormShifts((prev) =>
                                      prev.map((item) =>
                                        item.shiftId === s.shiftId ? { ...item, operatorCount: val } : item,
                                      ),
                                    );
                                  }}
                                  className="w-12 text-center text-xs rounded border border-input bg-background px-1 py-0.5"
                                  title="Staff / Operator Count"
                                />
                                <span className="text-[10px] text-muted-foreground">staff</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hourly Cost Absorption */}
                  <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-500" />
                      Standard Hourly Cost Absorption Matrix
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Rates used to calculate standard cycle costing in Production Routings and Work Orders
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                      <div>
                        <label className="text-xs font-medium text-foreground">
                          Direct Machine Cost (₹/hr)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={formCostPerHour}
                          onChange={(e) => setFormCostPerHour(parseFloat(e.target.value) || 0)}
                          className="mt-1 w-full text-xs font-mono rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                        />
                        <span className="text-[10px] text-muted-foreground block mt-1">
                          Depreciation, tooling & maintenance
                        </span>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-foreground">
                          Direct Labor Cost (₹/hr)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={formLabourCostPerHour}
                          onChange={(e) => setFormLabourCostPerHour(parseFloat(e.target.value) || 0)}
                          className="mt-1 w-full text-xs font-mono rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                        />
                        <span className="text-[10px] text-muted-foreground block mt-1">
                          Operator & helper wages
                        </span>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-foreground">
                          Factory Overhead / Power (₹/hr)
                        </label>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={formOverheadCostPerHour}
                          onChange={(e) => setFormOverheadCostPerHour(parseFloat(e.target.value) || 0)}
                          className="mt-1 w-full text-xs font-mono rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                        />
                        <span className="text-[10px] text-muted-foreground block mt-1">
                          Electric power & plant overhead
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-300 dark:border-emerald-800">
                      <div>
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block">
                          Total Standard Hourly Cost Rate
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Machine (₹{formCostPerHour}) + Labor (₹{formLabourCostPerHour}) + Overhead (₹{formOverheadCostPerHour})
                        </span>
                      </div>
                      <span className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{calculatedTotalHourlyRate.toFixed(2)} / hr
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/30">
              <div className="text-xs text-muted-foreground">
                Total Hourly Rate: <span className="font-mono font-bold text-emerald-600">₹{calculatedTotalHourlyRate.toFixed(2)}/hr</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-lg border border-input text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saveMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {editingWcId ? 'Save Changes' : 'Create Work Center'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 6. Machine Maintenance & Status Update Modal */}
      {/* -------------------------------------------------------------------- */}
      {isMaintenanceModalOpen && maintenanceTargetWc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-border px-6 py-4 bg-amber-500/10">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
                  <Wrench className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Machinery Maintenance & Status</h3>
                  <p className="text-xs text-muted-foreground">
                    Work Center: {maintenanceTargetWc.workCenterCode} ({maintenanceTargetWc.workCenterName})
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Machine Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Select Machine / Asset</label>
                <select
                  value={selectedMachineToMaintain?.wcMachineId || ''}
                  onChange={(e) => {
                    const mId = Number(e.target.value);
                    const m = (maintenanceTargetWc.machines || []).find((x) => x.wcMachineId === mId);
                    if (m) {
                      setSelectedMachineToMaintain(m);
                      setMaintStatus(m.status);
                      setMaintRemarks(m.remarks || '');
                      setMaintLastDate(m.lastMaintenanceDate || new Date().toISOString().split('T')[0]);
                      setMaintNextDue(m.nextMaintenanceDue || '');
                    }
                  }}
                  className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                >
                  {(maintenanceTargetWc.machines || []).map((m) => (
                    <option key={m.wcMachineId} value={m.wcMachineId}>
                      [{m.machineCode}] {m.machineName} ({m.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Operational Status</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['OPERATIONAL', 'BREAKDOWN', 'STANDBY', 'DECOMMISSIONED'] as MachineStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setMaintStatus(st)}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                        maintStatus === st
                          ? st === 'OPERATIONAL'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : st === 'BREAKDOWN'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-amber-600 text-white border-amber-600'
                          : 'bg-background text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Maintenance Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Last Serviced Date</label>
                  <input
                    type="date"
                    value={maintLastDate}
                    onChange={(e) => setMaintLastDate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Next PM Due Date</label>
                  <input
                    type="date"
                    value={maintNextDue}
                    onChange={(e) => setMaintNextDue(e.target.value)}
                    className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Maintenance / Service Notes</label>
                <textarea
                  rows={2}
                  value={maintRemarks}
                  onChange={(e) => setMaintRemarks(e.target.value)}
                  placeholder="e.g. Spindle bearing vibration inspected, lubricating oil topped up..."
                  className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4 bg-muted/30">
              <button
                type="button"
                onClick={() => {
                  setIsMaintenanceModalOpen(false);
                  setMaintenanceTargetWc(null);
                  setSelectedMachineToMaintain(null);
                }}
                className="px-4 py-2 rounded-lg border border-input text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={maintenanceMutation.isPending || !selectedMachineToMaintain}
                onClick={() => maintenanceMutation.mutate()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {maintenanceMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Save Maintenance Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 7. Shift Quick-Add Modal */}
      {/* -------------------------------------------------------------------- */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Factory Shift Calendars</h3>
                  <p className="text-xs text-muted-foreground">
                    Define factory work schedules and standard working hours
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Existing Shifts List */}
              <div className="space-y-2">
                <span className="font-bold text-xs text-foreground uppercase tracking-wider block">
                  Active Plant Shifts
                </span>
                <div className="divide-y divide-border border border-border rounded-xl max-h-48 overflow-y-auto">
                  {shiftsCatalog.map((s) => (
                    <div key={s.shiftId} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-foreground">{s.shiftName}</span>{' '}
                        <span className="font-mono text-[10px] text-muted-foreground">({s.shiftCode})</span>
                        <div className="text-[10px] text-muted-foreground">
                          {s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)} · Break: {s.breakDurationMins}m
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-emerald-600 block">
                          {s.effectiveWorkingHours} hrs
                        </span>
                        {s.isNightShift && (
                          <span className="text-[9px] uppercase px-1 py-0.2 bg-purple-500/15 text-purple-600 font-bold rounded">
                            Night
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Shift Form */}
              <div className="p-3 bg-muted/30 rounded-xl space-y-3 border border-border">
                <span className="font-bold text-xs text-foreground uppercase tracking-wider block">
                  Register New Shift
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground">Shift Code</label>
                    <input
                      type="text"
                      value={shiftCodeInput}
                      onChange={(e) => setShiftCodeInput(e.target.value)}
                      placeholder="e.g. SHIFT-M2"
                      className="w-full text-xs font-mono rounded border border-input bg-background px-2 py-1 mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground">Shift Name</label>
                    <input
                      type="text"
                      value={shiftNameInput}
                      onChange={(e) => setShiftNameInput(e.target.value)}
                      placeholder="e.g. Morning Shift 2"
                      className="w-full text-xs rounded border border-input bg-background px-2 py-1 mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground">Start Time</label>
                    <input
                      type="time"
                      value={shiftStartInput}
                      onChange={(e) => setShiftStartInput(e.target.value)}
                      className="w-full text-xs rounded border border-input bg-background px-2 py-1 mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground">End Time</label>
                    <input
                      type="time"
                      value={shiftEndInput}
                      onChange={(e) => setShiftEndInput(e.target.value)}
                      className="w-full text-xs rounded border border-input bg-background px-2 py-1 mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground">Break (Mins)</label>
                    <input
                      type="number"
                      value={shiftBreakInput}
                      onChange={(e) => setShiftBreakInput(parseInt(e.target.value) || 0)}
                      className="w-full text-xs rounded border border-input bg-background px-2 py-1 mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground">Effective Working Hours</label>
                    <input
                      type="number"
                      step="0.1"
                      value={shiftWorkingHoursInput}
                      onChange={(e) => setShiftWorkingHoursInput(parseFloat(e.target.value) || 8.0)}
                      className="w-full text-xs font-mono rounded border border-input bg-background px-2 py-1 mt-0.5"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isNightCheck"
                      checked={shiftIsNightInput}
                      onChange={(e) => setShiftIsNightInput(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border text-primary"
                    />
                    <label htmlFor="isNightCheck" className="text-xs text-foreground cursor-pointer">
                      Night Shift (Overnight)
                    </label>
                  </div>

                  <button
                    type="button"
                    disabled={createShiftMutation.isPending}
                    onClick={() => createShiftMutation.mutate()}
                    className="px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-semibold shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    Add Shift
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end border-t border-border px-6 py-3 bg-muted/30">
              <button
                type="button"
                onClick={() => setIsShiftModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 8. Work Center Detail Drawer / Modal */}
      {/* -------------------------------------------------------------------- */}
      {isDetailOpen && selectedWcDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Eye className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground">{selectedWcDetail.workCenterCode}</h2>
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-muted border border-border">
                      {selectedWcDetail.workCenterType}
                    </span>
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                      {selectedWcDetail.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedWcDetail.workCenterName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Specs Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/30 border border-border text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Department</span>
                  <span className="font-bold text-foreground">
                    {selectedWcDetail.deptName || 'Plant General'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Shopfloor Location</span>
                  <span className="font-bold text-foreground">
                    {selectedWcDetail.locationDesc || 'Main Factory Bay'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Daily Capacity</span>
                  <span className="font-mono font-bold text-foreground">
                    {selectedWcDetail.capacityPerDayHours} hrs/day ({selectedWcDetail.efficiencyPercent}% OEE)
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Total Hourly Rate</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    ₹{Number(selectedWcDetail.totalHourlyRate).toFixed(2)}/hr
                  </span>
                </div>
              </div>

              {/* Machinery Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Installed Machinery & Equipment ({selectedWcDetail.machines?.length || 0})
                </h4>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Machine Code</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Equipment Name</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Model & Serial</th>
                        <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Power</th>
                        <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Status</th>
                        <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Next PM Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(selectedWcDetail.machines || []).map((m, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono font-bold text-foreground">{m.machineCode}</td>
                          <td className="px-3 py-2 font-medium text-foreground">{m.machineName}</td>
                          <td className="px-3 py-2 text-muted-foreground text-[11px]">
                            {m.modelNo || '-'} / {m.serialNo || '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{m.powerRatingKw || 0} kW</td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                m.status === 'OPERATIONAL'
                                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                  : m.status === 'BREAKDOWN'
                                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400'
                                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                              }`}
                            >
                              {m.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-muted-foreground">
                            {m.nextMaintenanceDue ? m.nextMaintenanceDue.split('T')[0] : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Shifts Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Operating Shift Schedules ({selectedWcDetail.shifts?.length || 0})
                </h4>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Shift Code</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Shift Name</th>
                        <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Timings</th>
                        <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Operating Days</th>
                        <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Working Hours</th>
                        <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Staffing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(selectedWcDetail.shifts || []).map((s, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-mono font-bold text-foreground">{s.shiftCode}</td>
                          <td className="px-3 py-2 font-medium text-foreground">{s.shiftName}</td>
                          <td className="px-3 py-2 text-center font-mono">
                            {s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)}
                          </td>
                          <td className="px-3 py-2 text-center text-muted-foreground">{s.daysOfWeek}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600">
                            {s.effectiveWorkingHours} hrs
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="font-semibold text-foreground">{s.operatorCount} Operators</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-border px-6 py-3 bg-muted/30">
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 9. Printable Work Center Capacity & Machinery Datasheet Modal */}
      {/* -------------------------------------------------------------------- */}
      {isPrintModalOpen && selectedWcDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
            {/* Modal Controls Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-3 bg-muted/40">
              <span className="text-xs font-bold text-foreground">Print Work Center Capacity & Asset Sheet</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Document
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPrintModalOpen(false);
                    setPrintTargetWcId(null);
                  }}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="flex-1 overflow-y-auto p-8 bg-white text-slate-900 font-sans print:p-0">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900">
                    KS-MFG ENTERPRISE ERP
                  </h1>
                  <p className="text-xs font-semibold text-slate-600">
                    Manufacturing Operations & Shopfloor Resource Management
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Plant 1: Manufacturing Division · Thane Industrial Estate, MH, India
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black tracking-widest uppercase bg-slate-900 text-white px-2 py-1 rounded">
                    WORK CENTER DATASHEET
                  </span>
                  <div className="font-mono text-xs font-bold mt-1 text-slate-900">
                    {selectedWcDetail.workCenterCode}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Type: {selectedWcDetail.workCenterType} · Status: {selectedWcDetail.status}
                  </div>
                </div>
              </div>

              {/* Specifications Card */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Work Center Name</span>
                  <span className="font-bold text-slate-900">{selectedWcDetail.workCenterName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Department</span>
                  <span className="font-bold text-slate-900">{selectedWcDetail.deptName || 'Plant General'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Daily Rated Capacity</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedWcDetail.capacityPerDayHours} hrs ({selectedWcDetail.efficiencyPercent}% OEE)
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Standard Hourly Rate</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    ₹{Number(selectedWcDetail.totalHourlyRate).toFixed(2)}/hr
                  </span>
                </div>
              </div>

              {/* Machinery Breakdown */}
              <div className="my-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 border-b border-slate-200 pb-1">
                  1. Installed Machinery & Capital Asset Inventory
                </h3>
                <table className="w-full text-xs border border-slate-300 border-collapse">
                  <thead className="bg-slate-100 font-bold text-slate-800">
                    <tr>
                      <th className="border border-slate-300 px-2 py-1.5 text-center w-8">#</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Asset Code</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Equipment / Machine Name</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Model / Serial No</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Manufacturer</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right w-20">Power (kW)</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-center w-24">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedWcDetail.machines || []).map((m, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="border border-slate-300 px-2 py-1 text-center font-mono">{idx + 1}</td>
                        <td className="border border-slate-300 px-2 py-1 font-mono font-bold text-slate-900">
                          {m.machineCode}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 font-semibold text-slate-900">
                          {m.machineName}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-slate-600">
                          {m.modelNo || '-'} / {m.serialNo || '-'}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-slate-600">{m.manufacturer || '-'}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono">{m.powerRatingKw} kW</td>
                        <td className="border border-slate-300 px-2 py-1 text-center font-semibold text-slate-900">
                          {m.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Shifts Breakdown */}
              <div className="my-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 border-b border-slate-200 pb-1">
                  2. Operational Shift Schedules
                </h3>
                <table className="w-full text-xs border border-slate-300 border-collapse">
                  <thead className="bg-slate-100 font-bold text-slate-800">
                    <tr>
                      <th className="border border-slate-300 px-2 py-1 text-left">Shift Code</th>
                      <th className="border border-slate-300 px-2 py-1 text-left">Shift Name</th>
                      <th className="border border-slate-300 px-2 py-1 text-center">Timings</th>
                      <th className="border border-slate-300 px-2 py-1 text-center">Effective Hours</th>
                      <th className="border border-slate-300 px-2 py-1 text-center">Operator Staffing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedWcDetail.shifts || []).map((s, idx) => (
                      <tr key={idx}>
                        <td className="border border-slate-300 px-2 py-1 font-mono font-bold text-slate-900">
                          {s.shiftCode}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 font-semibold text-slate-900">
                          {s.shiftName}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-center font-mono">
                          {s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-center font-mono font-bold">
                          {s.effectiveWorkingHours} hrs
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-center">
                          {s.operatorCount} Operators
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Absorption Rates Box & Signatures */}
              <div className="grid grid-cols-2 gap-6 my-6 text-xs">
                {/* Cost Breakdown Box */}
                <div className="p-3 border border-slate-300 rounded bg-slate-50 space-y-1">
                  <span className="font-bold uppercase tracking-wider text-slate-700 block text-[10px] mb-1">
                    3. Standard Cost Absorption Breakdown
                  </span>
                  <div className="flex justify-between text-slate-700">
                    <span>Direct Machine Cost Rate:</span>
                    <span className="font-mono">₹{Number(selectedWcDetail.costPerHour).toFixed(2)}/hr</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Direct Labor Rate:</span>
                    <span className="font-mono">₹{Number(selectedWcDetail.labourCostPerHour).toFixed(2)}/hr</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Factory Overhead & Power:</span>
                    <span className="font-mono">₹{Number(selectedWcDetail.overheadCostPerHour).toFixed(2)}/hr</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-300 pt-1 font-bold text-slate-900">
                    <span>Total Standard Absorption Rate:</span>
                    <span className="font-mono text-emerald-800 text-sm">
                      ₹{Number(selectedWcDetail.totalHourlyRate).toFixed(2)} / hr
                    </span>
                  </div>
                </div>

                {/* Sign-off Box */}
                <div className="p-3 border border-slate-300 rounded bg-slate-50 flex flex-col justify-between">
                  <span className="font-bold uppercase tracking-wider text-slate-700 block text-[10px]">
                    4. Plant Authorization & Operations Verification
                  </span>
                  <div className="grid grid-cols-2 gap-4 pt-8 text-[11px] text-slate-600">
                    <div className="border-t border-slate-400 pt-1 text-center">
                      <span className="block font-semibold">Maintenance Engineer</span>
                      <span className="text-[10px] text-slate-500">Authorized Signature</span>
                    </div>
                    <div className="border-t border-slate-400 pt-1 text-center">
                      <span className="block font-semibold">Works Manager</span>
                      <span className="text-[10px] text-slate-500">Plant Operations Head</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-300 pt-2 text-[10px] text-slate-500 flex justify-between">
                <span>Computer Generated Work Center Sheet · KS-MFG ERP</span>
                <span>Page 1 of 1 · Print Date: {new Date().toLocaleDateString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 10. Delete Confirmation Modal */}
      {/* -------------------------------------------------------------------- */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        entityType="Work Center"
        entityName={deleteTarget?.workCenterName || ''}
        entityCode={deleteTarget?.workCenterCode}
        isDeleting={deleteMutation.isPending}
        errorMessage={deleteErrorMessage}
        dependencies={deleteConflicts}
        onConfirm={() => deleteMutation.mutate()}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteErrorMessage(null);
          setDeleteConflicts([]);
        }}
      />
    </div>
  );
};
