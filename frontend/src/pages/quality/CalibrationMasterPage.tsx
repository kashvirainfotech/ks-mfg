import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Gauge,
  HelpCircle,
  History,
  Layers,
  Lock,
  Package,
  Plus,
  Printer,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Tag,
  Trash2,
  Unlock,
  User,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { apiClient, type ApiResponse } from '../../lib/apiClient';
import {
  MasterDataTable,
  type MasterTableColumn,
  type GroupByOption,
} from '../../components/common/MasterDataTable';
import { ConfirmDeleteModal } from '../../components/common/ConfirmDeleteModal';
import { PermissionGate } from '../../components/common/PermissionGate';

// ============================================================================
// Types & Interfaces
// ============================================================================
export type GaugeType =
  | 'VERNIER_CALIPER'
  | 'MICROMETER'
  | 'DIAL_INDICATOR'
  | 'PRESSURE_GAUGE'
  | 'TORQUE_WRENCH'
  | 'TEMPERATURE_CONTROLLER'
  | 'HARDNESS_TESTER'
  | 'CMM_PROBE'
  | 'HEIGHT_GAUGE'
  | 'BORE_GAUGE'
  | 'SURFACE_ROUGHNESS_TESTER';

export type GaugeStatus =
  | 'VALID'
  | 'CALIBRATION_DUE'
  | 'OVERDUE'
  | 'UNDER_CALIBRATION'
  | 'OUT_OF_TOLERANCE_LOCKOUT'
  | 'SCRAPPED';

export type CalibrationAgencyType = 'INTERNAL_LAB' | 'NABL_EXTERNAL_LAB' | 'OEM_MANUFACTURER';

export type CalibrationResult = 'PASS' | 'PASS_WITH_CORRECTION' | 'FAIL_OUT_OF_TOLERANCE';

export interface CalibrationHistoryEvent {
  historyId: number;
  gaugeId: number;
  calibrationEventNo: string;
  calibrationDate: string;
  certificateNo: string;
  calibratedByAgency: string;
  calibratorName: string;
  masterInstrumentTraceability: string;
  nominalValue: number;
  observedValue: number;
  errorVal: number;
  permissibleTolerance: number;
  calibrationResult: CalibrationResult;
  nextDueDate: string;
  environmentalConditions?: string;
  certificateUrl?: string;
  verifiedByUserId?: number | null;
  verifiedByName?: string;
  remarks?: string;
  createdDate: string;
}

export interface GaugeRecord {
  gaugeId: number;
  gaugeCode: string;
  gaugeName: string;
  gaugeType: GaugeType;
  makeManufacturer: string;
  modelNo?: string | null;
  serialNo: string;
  rangeMin: number;
  rangeMax: number;
  uom: string;
  leastCount: number;
  maxPermissibleError: number;
  locationCustody: string;
  custodianId?: number | null;
  custodianName?: string | null;
  calibrationFrequencyDays: number;
  lastCalibrationDate: string;
  nextCalibrationDueDate: string;
  daysUntilDue?: number | null;
  calibrationAgencyType: CalibrationAgencyType;
  agencyName: string;
  calibrationCertificateNo: string;
  currentStatus: GaugeStatus;
  remarks?: string | null;
  createdBy: number;
  createdDate: string;
  calibrationEventCount?: number;
  history?: CalibrationHistoryEvent[];
}

interface CalibrationSummary {
  totalGauges: number;
  validActive: number;
  dueSoon: number;
  overdueExpired: number;
  lockedOut: number;
}

interface LookupsData {
  custodians: { userId: number; userName: string; fullName: string }[];
  gaugeTypes: { value: string; label: string }[];
  gaugeStatuses: { value: string; label: string }[];
  agencyTypes: { value: string; label: string }[];
  calibrationResults: { value: string; label: string }[];
}

// ============================================================================
// Main Component: CalibrationMasterPage
// ============================================================================
export const CalibrationMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'ALL' | 'VALID' | 'DUE_SOON' | 'OVERDUE_LOCKOUT'>('ALL');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [agencyFilter, setAgencyFilter] = useState('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<GaugeRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<GaugeRecord | null>(null);
  const [calibratingRecord, setCalibratingRecord] = useState<GaugeRecord | null>(null);
  const [lockoutRecord, setLockoutRecord] = useState<GaugeRecord | null>(null);
  const [printingRecord, setPrintingRecord] = useState<GaugeRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<GaugeRecord | null>(null);

  // Form State for Add / Edit Gauge
  const [formState, setFormState] = useState<{
    gaugeCode: string;
    gaugeName: string;
    gaugeType: GaugeType;
    makeManufacturer: string;
    modelNo: string;
    serialNo: string;
    rangeMin: number;
    rangeMax: number;
    uom: string;
    leastCount: number;
    maxPermissibleError: number;
    locationCustody: string;
    custodianId: number | '';
    calibrationFrequencyDays: number;
    lastCalibrationDate: string;
    calibrationAgencyType: CalibrationAgencyType;
    agencyName: string;
    calibrationCertificateNo: string;
    remarks: string;
  }>({
    gaugeCode: '',
    gaugeName: '',
    gaugeType: 'MICROMETER',
    makeManufacturer: 'Mitutoyo',
    modelNo: '',
    serialNo: '',
    rangeMin: 0,
    rangeMax: 25,
    uom: 'mm',
    leastCount: 0.001,
    maxPermissibleError: 0.002,
    locationCustody: 'CNC Machining Cell 01 - Quality Inspection Station',
    custodianId: '',
    calibrationFrequencyDays: 180,
    lastCalibrationDate: new Date().toISOString().split('T')[0],
    calibrationAgencyType: 'NABL_EXTERNAL_LAB',
    agencyName: 'Central Metallurgical & Gauge Metrology Lab (NABL Cert #CC-2914)',
    calibrationCertificateNo: 'NABL-CAL-2026-9912',
    remarks: '',
  });

  // Form State for Logging Calibration Event
  const [eventForm, setEventForm] = useState<{
    calibrationDate: string;
    certificateNo: string;
    calibratedByAgency: string;
    calibratorName: string;
    masterInstrumentTraceability: string;
    nominalValue: number;
    observedValue: number;
    errorVal: number;
    permissibleTolerance: number;
    calibrationResult: CalibrationResult;
    nextDueDate: string;
    environmentalConditions: string;
    remarks: string;
  }>({
    calibrationDate: new Date().toISOString().split('T')[0],
    certificateNo: '',
    calibratedByAgency: 'Apex NABL Calibration Metrology Lab (Cert #TC-5120)',
    calibratorName: 'Er. Deepak Verma (Metrologist)',
    masterInstrumentTraceability: 'Grade-0 Ceramic Gauge Block Set (NPL / NIST Traceable Standard)',
    nominalValue: 25.0,
    observedValue: 25.0004,
    errorVal: 0.0004,
    permissibleTolerance: 0.002,
    calibrationResult: 'PASS',
    nextDueDate: '',
    environmentalConditions: 'Temp: 20.0 ± 0.5 °C, Humidity: 50 ± 5% RH',
    remarks: 'Instrument verified within ISO/IEC 17025 permissible tolerances.',
  });

  // Lockout Form
  const [lockoutForm, setLockoutForm] = useState<{
    lockoutReason: string;
    newStatus: 'OUT_OF_TOLERANCE_LOCKOUT' | 'SCRAPPED';
  }>({
    lockoutReason: 'Excessive zero error observed during morning shift calibration check.',
    newStatus: 'OUT_OF_TOLERANCE_LOCKOUT',
  });

  // --------------------------------------------------------------------------
  // API Queries & Mutations
  // --------------------------------------------------------------------------
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<CalibrationSummary>({
    queryKey: ['calibration-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<CalibrationSummary>>('/quality/calibration/summary');
      return (res.data.data ?? res.data) as CalibrationSummary;
    },
  });

  const { data: lookupsData } = useQuery<LookupsData>({
    queryKey: ['calibration-lookups'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<LookupsData>>('/quality/calibration/lookups');
      return (res.data.data ?? res.data) as LookupsData;
    },
  });

  const { data: recordsData, isLoading: isRecordsLoading } = useQuery<GaugeRecord[]>({
    queryKey: ['calibration-records', typeFilter, statusFilter, agencyFilter, searchTerm],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (typeFilter !== 'ALL') params.gaugeType = typeFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (agencyFilter !== 'ALL') params.agencyType = agencyFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await apiClient.get<ApiResponse<{ items: GaugeRecord[]; total: number }>>(
        '/quality/calibration',
        { params },
      );
      const data = res.data.data ?? res.data;
      return (data as any)?.items || (Array.isArray(data) ? data : []);
    },
  });

  // Mutation: Create Gauge
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<GaugeRecord>>('/quality/calibration', payload);
      return res.data.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration-records'] });
      queryClient.invalidateQueries({ queryKey: ['calibration-summary'] });
      setIsCreateModalOpen(false);
    },
  });

  // Mutation: Update Gauge
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.put<ApiResponse<GaugeRecord>>(`/quality/calibration/${id}`, payload);
      return res.data.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration-records'] });
      queryClient.invalidateQueries({ queryKey: ['calibration-summary'] });
      setEditingRecord(null);
    },
  });

  // Mutation: Log Event
  const logEventMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post<ApiResponse<GaugeRecord>>(
        `/quality/calibration/${id}/events`,
        payload,
      );
      return res.data.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration-records'] });
      queryClient.invalidateQueries({ queryKey: ['calibration-summary'] });
      setCalibratingRecord(null);
    },
  });

  // Mutation: Lockout
  const lockoutMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post<ApiResponse<GaugeRecord>>(
        `/quality/calibration/${id}/lockout`,
        payload,
      );
      return res.data.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration-records'] });
      queryClient.invalidateQueries({ queryKey: ['calibration-summary'] });
      setLockoutRecord(null);
    },
  });

  // Mutation: Delete Gauge
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete<ApiResponse<any>>(`/quality/calibration/${id}`);
      return res.data.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration-records'] });
      queryClient.invalidateQueries({ queryKey: ['calibration-summary'] });
      setDeletingRecord(null);
    },
  });

  // Filter records by tab
  const filteredRecords = useMemo(() => {
    if (!recordsData) return [];
    if (activeTab === 'VALID') {
      return recordsData.filter((r: GaugeRecord) => r.currentStatus === 'VALID');
    }
    if (activeTab === 'DUE_SOON') {
      return recordsData.filter(
        (r: GaugeRecord) =>
          r.currentStatus === 'CALIBRATION_DUE' ||
          (r.daysUntilDue !== null && r.daysUntilDue !== undefined && r.daysUntilDue >= 0 && r.daysUntilDue <= 15),
      );
    }
    if (activeTab === 'OVERDUE_LOCKOUT') {
      return recordsData.filter(
        (r: GaugeRecord) =>
          r.currentStatus === 'OVERDUE' ||
          r.currentStatus === 'OUT_OF_TOLERANCE_LOCKOUT' ||
          r.currentStatus === 'SCRAPPED' ||
          (r.daysUntilDue !== null && r.daysUntilDue !== undefined && r.daysUntilDue < 0),
      );
    }
    return recordsData;
  }, [recordsData, activeTab]);

  // Open Edit Modal
  const handleOpenEdit = (rec: GaugeRecord) => {
    setEditingRecord(rec);
    setFormState({
      gaugeCode: rec.gaugeCode,
      gaugeName: rec.gaugeName,
      gaugeType: rec.gaugeType,
      makeManufacturer: rec.makeManufacturer,
      modelNo: rec.modelNo || '',
      serialNo: rec.serialNo,
      rangeMin: rec.rangeMin,
      rangeMax: rec.rangeMax,
      uom: rec.uom,
      leastCount: rec.leastCount,
      maxPermissibleError: rec.maxPermissibleError,
      locationCustody: rec.locationCustody,
      custodianId: rec.custodianId || '',
      calibrationFrequencyDays: rec.calibrationFrequencyDays,
      lastCalibrationDate: rec.lastCalibrationDate?.slice(0, 10) || '',
      calibrationAgencyType: rec.calibrationAgencyType,
      agencyName: rec.agencyName,
      calibrationCertificateNo: rec.calibrationCertificateNo,
      remarks: rec.remarks || '',
    });
  };

  // Open Calibrate Event Modal
  const handleOpenCalibrate = (rec: GaugeRecord) => {
    setCalibratingRecord(rec);
    const nominal = (rec.rangeMin + rec.rangeMax) / 2 || rec.rangeMax;
    setEventForm({
      calibrationDate: new Date().toISOString().split('T')[0],
      certificateNo: `CAL-${new Date().getFullYear()}-CERT-${Math.floor(1000 + Math.random() * 9000)}`,
      calibratedByAgency: rec.agencyName || 'Apex NABL Calibration Metrology Lab',
      calibratorName: 'Er. Deepak Verma (Metrologist)',
      masterInstrumentTraceability: 'Grade-0 Ceramic Gauge Block Set (NPL / NIST Traceable Standard)',
      nominalValue: nominal,
      observedValue: nominal + 0.0004,
      errorVal: 0.0004,
      permissibleTolerance: rec.maxPermissibleError || 0.002,
      calibrationResult: 'PASS',
      nextDueDate: '',
      environmentalConditions: 'Temp: 20.0 ± 0.5 °C, Humidity: 50 ± 5% RH',
      remarks: 'Verified within permissible tolerance limits per ISO/IEC 17025.',
    });
  };

  // Open View History
  const handleOpenView = async (rec: GaugeRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<GaugeRecord>>(`/quality/calibration/${rec.gaugeId}`);
      setViewingRecord((res.data.data ?? res.data) as GaugeRecord);
    } catch {
      setViewingRecord(rec);
    }
  };

  // Open Print Passport
  const handleOpenPrint = async (rec: GaugeRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<GaugeRecord>>(`/quality/calibration/${rec.gaugeId}`);
      setPrintingRecord((res.data.data ?? res.data) as GaugeRecord);
    } catch {
      setPrintingRecord(rec);
    }
  };

  // Submit Gauge Create/Edit
  const handleSubmitGauge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.gaugeName.trim() || !formState.serialNo.trim()) return;

    if (editingRecord) {
      updateMutation.mutate({
        id: editingRecord.gaugeId,
        payload: {
          ...formState,
          custodianId: Number(formState.custodianId) || undefined,
        },
      });
    } else {
      createMutation.mutate({
        ...formState,
        custodianId: Number(formState.custodianId) || undefined,
      });
    }
  };

  // Columns for MasterDataTable
  const columns: MasterTableColumn<GaugeRecord>[] = [
    {
      key: 'gaugeCode',
      header: 'Instrument ID & Name',
      sortValue: (r: GaugeRecord) => r.gaugeCode,
      render: (r: GaugeRecord) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
            <Gauge className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>{r.gaugeCode}</span>
          </div>
          <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate max-w-[220px]">
            {r.gaugeName}
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            {r.makeManufacturer} {r.modelNo ? `(${r.modelNo})` : ''} | SN: {r.serialNo}
          </span>
        </div>
      ),
    },
    {
      key: 'gaugeType',
      header: 'Instrument Type',
      sortValue: (r: GaugeRecord) => r.gaugeType,
      render: (r: GaugeRecord) => {
        const typeLabels: Record<string, string> = {
          MICROMETER: 'Micrometer',
          VERNIER_CALIPER: 'Vernier Caliper',
          PRESSURE_GAUGE: 'Pressure Gauge',
          TORQUE_WRENCH: 'Torque Wrench',
          DIAL_INDICATOR: 'Dial Indicator',
          HEIGHT_GAUGE: 'Height Gauge',
          BORE_GAUGE: 'Bore Gauge',
          SURFACE_ROUGHNESS_TESTER: 'Surface Tester (Ra)',
          HARDNESS_TESTER: 'Hardness Tester',
          TEMPERATURE_CONTROLLER: 'Temp Controller',
          CMM_PROBE: 'CMM Probe',
        };
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            {typeLabels[r.gaugeType] || r.gaugeType}
          </span>
        );
      },
    },
    {
      key: 'rangeResolution',
      header: 'Range & Precision',
      sortValue: (r: GaugeRecord) => r.rangeMax,
      render: (r: GaugeRecord) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {r.rangeMin} - {r.rangeMax} {r.uom}
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            Least Count: {r.leastCount} {r.uom}
          </span>
          <span className="text-[11px] text-slate-400">
            Max Error: ±{r.maxPermissibleError} {r.uom}
          </span>
        </div>
      ),
    },
    {
      key: 'custody',
      header: 'Location & Custodian',
      sortValue: (r: GaugeRecord) => r.locationCustody,
      render: (r: GaugeRecord) => (
        <div className="flex flex-col max-w-[200px]">
          <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
            {r.locationCustody}
          </span>
          {r.custodianName && (
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
              <User className="h-3 w-3" /> {r.custodianName}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'calibrationSchedule',
      header: 'Calibration Schedule',
      sortValue: (r: GaugeRecord) => r.nextCalibrationDueDate,
      render: (r: GaugeRecord) => {
        const days = r.daysUntilDue !== undefined && r.daysUntilDue !== null ? r.daysUntilDue : 999;
        let badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300';
        let statusText = `${days} days left`;

        if (r.currentStatus === 'OUT_OF_TOLERANCE_LOCKOUT' || r.currentStatus === 'SCRAPPED') {
          badgeColor = 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300';
          statusText = 'LOCKED OUT';
        } else if (days < 0 || r.currentStatus === 'OVERDUE') {
          badgeColor = 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300';
          statusText = `${Math.abs(days)} days OVERDUE`;
        } else if (days <= 15) {
          badgeColor = 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300';
          statusText = `Due in ${days} days`;
        }

        return (
          <div className="flex flex-col gap-1">
            <div className="text-xs text-slate-900 dark:text-slate-100 font-medium">
              Due: {r.nextCalibrationDueDate ? new Date(r.nextCalibrationDueDate).toLocaleDateString() : 'N/A'}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${badgeColor}`}>
                {statusText}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              Freq: Every {r.calibrationFrequencyDays} days
            </span>
          </div>
        );
      },
    },
    {
      key: 'currentStatus',
      header: 'Status',
      sortValue: (r: GaugeRecord) => r.currentStatus,
      render: (r: GaugeRecord) => {
        const statusMap: Record<string, { label: string; badge: string }> = {
          VALID: { label: 'Valid / In Spec', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
          CALIBRATION_DUE: { label: 'Calibration Due Soon', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
          OVERDUE: { label: 'Overdue / Expired', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' },
          UNDER_CALIBRATION: { label: 'At Calibration Lab', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
          OUT_OF_TOLERANCE_LOCKOUT: { label: 'Locked Out (Defective)', badge: 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300' },
          SCRAPPED: { label: 'Scrapped / Condemned', badge: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400' },
        };
        const conf = statusMap[r.currentStatus] || { label: r.currentStatus, badge: 'bg-slate-100 text-slate-700' };
        return (
          <div className="flex flex-col gap-0.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold w-fit ${conf.badge}`}>
              {conf.label}
            </span>
            {r.calibrationEventCount !== undefined && r.calibrationEventCount > 0 && (
              <span className="text-[11px] text-slate-400">
                {r.calibrationEventCount} calibration cycle{r.calibrationEventCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r: GaugeRecord) => (
        <div className="flex items-center gap-1">
          {/* View Passport & History */}
          <button
            onClick={() => handleOpenView(r)}
            title="View Instrument Passport & History Log"
            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800"
          >
            <History className="h-4 w-4" />
          </button>

          {/* Log Calibration Event */}
          <PermissionGate screen="CALIBRATION_QC" action="CALIBRATE">
            <button
              onClick={() => handleOpenCalibrate(r)}
              title="Log Calibration Verification Event"
              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          </PermissionGate>

          {/* Lockout Instrument */}
          <PermissionGate screen="CALIBRATION_QC" action="LOCKOUT">
            <button
              onClick={() => {
                setLockoutRecord(r);
                setLockoutForm({
                  lockoutReason: '',
                  newStatus: 'OUT_OF_TOLERANCE_LOCKOUT',
                });
              }}
              title="Quarantine / Lockout Out-of-Tolerance Instrument"
              className="p-1 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
            >
              <Lock className="h-4 w-4" />
            </button>
          </PermissionGate>

          {/* Print Passport / Certificate */}
          <PermissionGate screen="CALIBRATION_QC" action="PRINT">
            <button
              onClick={() => handleOpenPrint(r)}
              title="Print Gauge Calibration Certificate & Passport"
              className="p-1 rounded text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
            </button>
          </PermissionGate>

          {/* Edit */}
          <PermissionGate screen="CALIBRATION_QC" action="EDIT">
            <button
              onClick={() => handleOpenEdit(r)}
              title="Edit Gauge Details"
              className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          </PermissionGate>

          {/* Delete */}
          <PermissionGate screen="CALIBRATION_QC" action="DELETE">
            <button
              onClick={() => setDeletingRecord(r)}
              title="Delete Instrument"
              className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  const groupByOptions: GroupByOption<GaugeRecord>[] = [
    { label: 'Instrument Type', key: 'gaugeType', groupValue: (r: GaugeRecord) => r.gaugeType },
    { label: 'Calibration Status', key: 'currentStatus', groupValue: (r: GaugeRecord) => r.currentStatus },
    { label: 'Physical Custody Location', key: 'locationCustody', groupValue: (r: GaugeRecord) => r.locationCustody },
    { label: 'Agency Type', key: 'calibrationAgencyType', groupValue: (r: GaugeRecord) => r.calibrationAgencyType },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* 1. Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Quality Assurance & QC</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-800 dark:text-slate-200 font-medium">Instruments & Gauges Calibration</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
            Gauge & Measuring Instrument Calibration Register
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Metrology equipment passport, periodic recalibration scheduling, NABL traceability certificates, and automatic out-of-tolerance lockouts.
          </p>
        </div>

        <PermissionGate screen="CALIBRATION_QC" action="ADD">
          <button
            onClick={() => {
              setEditingRecord(null);
              setFormState({
                gaugeCode: '',
                gaugeName: '',
                gaugeType: 'MICROMETER',
                makeManufacturer: 'Mitutoyo (Japan)',
                modelNo: '293-240-30',
                serialNo: '',
                rangeMin: 0,
                rangeMax: 25,
                uom: 'mm',
                leastCount: 0.001,
                maxPermissibleError: 0.002,
                locationCustody: 'CNC Machining Cell 01 - Quality Inspection Station',
                custodianId: lookupsData?.custodians[0]?.userId || '',
                calibrationFrequencyDays: 180,
                lastCalibrationDate: new Date().toISOString().split('T')[0],
                calibrationAgencyType: 'NABL_EXTERNAL_LAB',
                agencyName: 'Central Metallurgical & Gauge Metrology Lab (NABL Cert #CC-2914)',
                calibrationCertificateNo: 'NABL-CAL-2026-9912',
                remarks: '',
              });
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Register Measuring Instrument
          </button>
        </PermissionGate>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Instruments</div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {isSummaryLoading ? '...' : summaryData?.totalGauges || 0}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Valid / In Tolerance</div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {isSummaryLoading ? '...' : summaryData?.validActive || 0}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Due Soon (≤ 15 Days)</div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {isSummaryLoading ? '...' : summaryData?.dueSoon || 0}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
            <AlertOctagon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Overdue / Expired</div>
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
              {isSummaryLoading ? '...' : summaryData?.overdueExpired || 0}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 col-span-2 md:col-span-4 lg:col-span-1">
          <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Lockout / Quarantined</div>
            <div className="text-xl font-bold text-red-600 dark:text-red-400">
              {isSummaryLoading ? '...' : summaryData?.lockedOut || 0}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-4">
        {[
          { id: 'ALL', label: 'All Measuring Instruments' },
          { id: 'VALID', label: 'Valid / In Specification' },
          { id: 'DUE_SOON', label: 'Recalibration Due (≤ 15 Days)' },
          { id: 'OVERDUE_LOCKOUT', label: 'Overdue & Quarantined Lockouts' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-2.5 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. Master Data Table */}
      <MasterDataTable<GaugeRecord>
        title="Calibration Master Register"
        subtitle="Full metrological traceability, ISO/IEC 17025 certificates, and instrument recalibration histories"
        screenCode="CALIBRATION_QC"
        tableNameBadge="tbl_qc_gauge_master"
        data={filteredRecords}
        columns={columns}
        rowKey={(r: GaugeRecord) => r.gaugeId}
        searchPlaceholder="Search by Gauge Code, Name, Serial No, Location, Custodian..."
        searchPredicate={(r: GaugeRecord, q: string) => {
          const query = q.toLowerCase();
          return (
            r.gaugeCode.toLowerCase().includes(query) ||
            r.gaugeName.toLowerCase().includes(query) ||
            r.serialNo.toLowerCase().includes(query) ||
            r.makeManufacturer.toLowerCase().includes(query) ||
            r.locationCustody.toLowerCase().includes(query) ||
            (Boolean(r.custodianName) && r.custodianName!.toLowerCase().includes(query))
          );
        }}
        groupByOptions={groupByOptions}
        addButtonLabel="Register Measuring Instrument"
        onAddClick={() => {
          setEditingRecord(null);
          setIsCreateModalOpen(true);
        }}
      />

      {/* 5. Create / Edit Gauge Master Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                  {editingRecord ? `Edit Instrument #${editingRecord.gaugeCode}` : 'Register Measuring Instrument'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingRecord(null);
                }}
                className="text-slate-400 hover:text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitGauge} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Instrument Type
                  </label>
                  <select
                    value={formState.gaugeType}
                    onChange={(e) => setFormState({ ...formState, gaugeType: e.target.value as GaugeType })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    {lookupsData?.gaugeTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Custom Gauge ID / Asset Tag (Leave blank for auto)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GAG-MIC-001"
                    value={formState.gaugeCode}
                    onChange={(e) => setFormState({ ...formState, gaugeCode: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Instrument Name / Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Digital Outside Micrometer 25-50mm"
                  value={formState.gaugeName}
                  onChange={(e) => setFormState({ ...formState, gaugeName: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Manufacturer / Brand
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mitutoyo, WIKA, Baker"
                    value={formState.makeManufacturer}
                    onChange={(e) => setFormState({ ...formState, makeManufacturer: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Model Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 293-240-30"
                    value={formState.modelNo}
                    onChange={(e) => setFormState({ ...formState, modelNo: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Serial Number (Mandatory)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SN-MIT-992144"
                    value={formState.serialNo}
                    onChange={(e) => setFormState({ ...formState, serialNo: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Range Min
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formState.rangeMin}
                    onChange={(e) => setFormState({ ...formState, rangeMin: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Range Max
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formState.rangeMax}
                    onChange={(e) => setFormState({ ...formState, rangeMax: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Least Count
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    required
                    value={formState.leastCount}
                    onChange={(e) => setFormState({ ...formState, leastCount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Permissible Error (±)
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    required
                    value={formState.maxPermissibleError}
                    onChange={(e) => setFormState({ ...formState, maxPermissibleError: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Location / Work Center Custody
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.locationCustody}
                    onChange={(e) => setFormState({ ...formState, locationCustody: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Custodian
                  </label>
                  <select
                    value={formState.custodianId}
                    onChange={(e) => setFormState({ ...formState, custodianId: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="">-- Select Custodian Engineer --</option>
                    {lookupsData?.custodians.map((c) => (
                      <option key={c.userId} value={c.userId}>
                        {c.fullName} ({c.userName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Frequency (Days)
                  </label>
                  <input
                    type="number"
                    required
                    value={formState.calibrationFrequencyDays}
                    onChange={(e) => setFormState({ ...formState, calibrationFrequencyDays: parseInt(e.target.value, 10) || 180 })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Last Calibration Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formState.lastCalibrationDate}
                    onChange={(e) => setFormState({ ...formState, lastCalibrationDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Agency Category
                  </label>
                  <select
                    value={formState.calibrationAgencyType}
                    onChange={(e) => setFormState({ ...formState, calibrationAgencyType: e.target.value as CalibrationAgencyType })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    {lookupsData?.agencyTypes.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Calibrating Agency / NABL Lab Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.agencyName}
                    onChange={(e) => setFormState({ ...formState, agencyName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Calibration Certificate No
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.calibrationCertificateNo}
                    onChange={(e) => setFormState({ ...formState, calibrationCertificateNo: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Instrument Passport Remarks & Metrology Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Special handling instructions, master standard reference, or zero calibration offset..."
                  value={formState.remarks}
                  onChange={(e) => setFormState({ ...formState, remarks: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingRecord(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingRecord
                    ? 'Update Instrument'
                    : 'Register Instrument Passport'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Log Calibration Verification Event Modal */}
      {calibratingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                  Log Calibration Event for #{calibratingRecord.gaugeCode}
                </h3>
              </div>
              <button onClick={() => setCalibratingRecord(null)} className="text-slate-400 hover:text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-indigo-900 dark:text-indigo-200">
                {calibratingRecord.gaugeName} (SN: {calibratingRecord.serialNo})
              </div>
              <div className="text-indigo-800 dark:text-indigo-300">
                Range: {calibratingRecord.rangeMin} - {calibratingRecord.rangeMax} {calibratingRecord.uom} | Permissible Error: ±{calibratingRecord.maxPermissibleError} {calibratingRecord.uom}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                logEventMutation.mutate({
                  id: calibratingRecord.gaugeId,
                  payload: eventForm,
                });
              }}
              className="mt-4 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Calibration Verification Date
                  </label>
                  <input
                    type="date"
                    required
                    value={eventForm.calibrationDate}
                    onChange={(e) => setEventForm({ ...eventForm, calibrationDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Calibration Certificate No
                  </label>
                  <input
                    type="text"
                    required
                    value={eventForm.certificateNo}
                    onChange={(e) => setEventForm({ ...eventForm, certificateNo: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Calibrated by Agency / Lab
                  </label>
                  <input
                    type="text"
                    required
                    value={eventForm.calibratedByAgency}
                    onChange={(e) => setEventForm({ ...eventForm, calibratedByAgency: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Certified Metrologist Name
                  </label>
                  <input
                    type="text"
                    required
                    value={eventForm.calibratorName}
                    onChange={(e) => setEventForm({ ...eventForm, calibratorName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Master Standard Traceability (NPL / NIST Traceable Standard)
                </label>
                <input
                  type="text"
                  required
                  value={eventForm.masterInstrumentTraceability}
                  onChange={(e) => setEventForm({ ...eventForm, masterInstrumentTraceability: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Nominal Value
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    required
                    value={eventForm.nominalValue}
                    onChange={(e) => {
                      const nom = parseFloat(e.target.value) || 0;
                      const err = Math.abs((eventForm.observedValue || 0) - nom);
                      setEventForm({ ...eventForm, nominalValue: nom, errorVal: parseFloat(err.toFixed(5)) });
                    }}
                    className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Observed Value
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    required
                    value={eventForm.observedValue}
                    onChange={(e) => {
                      const obs = parseFloat(e.target.value) || 0;
                      const err = Math.abs(obs - (eventForm.nominalValue || 0));
                      setEventForm({ ...eventForm, observedValue: obs, errorVal: parseFloat(err.toFixed(5)) });
                    }}
                    className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Calculated Error
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    readOnly
                    value={eventForm.errorVal}
                    className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 font-bold text-indigo-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Permissible Tolerance
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    required
                    value={eventForm.permissibleTolerance}
                    onChange={(e) => setEventForm({ ...eventForm, permissibleTolerance: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Calibration Verification Verdict
                  </label>
                  <select
                    value={eventForm.calibrationResult}
                    onChange={(e) => setEventForm({ ...eventForm, calibrationResult: e.target.value as CalibrationResult })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold"
                  >
                    <option value="PASS">PASS (Within Tolerance)</option>
                    <option value="PASS_WITH_CORRECTION">PASS with Correction Factor</option>
                    <option value="FAIL_OUT_OF_TOLERANCE">FAIL (Out of Tolerance - Auto Lockout)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Environmental Conditions
                  </label>
                  <input
                    type="text"
                    value={eventForm.environmentalConditions}
                    onChange={(e) => setEventForm({ ...eventForm, environmentalConditions: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Metrology Remarks
                </label>
                <textarea
                  rows={2}
                  value={eventForm.remarks}
                  onChange={(e) => setEventForm({ ...eventForm, remarks: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCalibratingRecord(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={logEventMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                >
                  {logEventMutation.isPending ? 'Logging...' : 'Certify Calibration & Update Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Quarantine / Lockout Instrument Modal */}
      {lockoutRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-rose-600" />
                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                  Quarantine / Lockout Instrument
                </h3>
              </div>
              <button onClick={() => setLockoutRecord(null)} className="text-slate-400 hover:text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-rose-900 dark:text-rose-200">
                Immediate Lockout for #{lockoutRecord.gaugeCode}
              </div>
              <div className="text-rose-800 dark:text-rose-300">
                {lockoutRecord.gaugeName} (SN: {lockoutRecord.serialNo})
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                lockoutMutation.mutate({
                  id: lockoutRecord.gaugeId,
                  payload: lockoutForm,
                });
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Lockout Action
                </label>
                <select
                  value={lockoutForm.newStatus}
                  onChange={(e) => setLockoutForm({ ...lockoutForm, newStatus: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                >
                  <option value="OUT_OF_TOLERANCE_LOCKOUT">Lockout / Quarantine (Out of Tolerance)</option>
                  <option value="SCRAPPED">Decommission & Scrap Permanently</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Quarantine / Lockout
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Excessive zero drift, physical drop damage, broken ratchet stop, defective LCD..."
                  value={lockoutForm.lockoutReason}
                  onChange={(e) => setLockoutForm({ ...lockoutForm, lockoutReason: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setLockoutRecord(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={lockoutMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
                >
                  {lockoutMutation.isPending ? 'Locking...' : 'Lockout & Tag Quarantined'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. View Passport & Calibration History Timeline Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Gauge className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                  Instrument Passport: {viewingRecord.gaugeCode}
                </h3>
              </div>
              <button onClick={() => setViewingRecord(null)} className="text-slate-400 hover:text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg">
                <div>Description: <strong>{viewingRecord.gaugeName}</strong></div>
                <div>Make / Model: <strong>{viewingRecord.makeManufacturer} {viewingRecord.modelNo || ''}</strong></div>
                <div>Serial Number: <strong className="font-mono">{viewingRecord.serialNo}</strong></div>
                <div>Type: <strong>{viewingRecord.gaugeType}</strong></div>
                <div>Range: <strong>{viewingRecord.rangeMin} - {viewingRecord.rangeMax} {viewingRecord.uom}</strong></div>
                <div>Permissible Error: <strong>±{viewingRecord.maxPermissibleError} {viewingRecord.uom}</strong></div>
                <div>Location: <strong>{viewingRecord.locationCustody}</strong></div>
                <div>Custodian: <strong>{viewingRecord.custodianName || 'Unassigned'}</strong></div>
              </div>

              {/* History Timeline */}
              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                  <History className="h-4 w-4 text-indigo-600" />
                  <span>Historical Verification Events & Calibration Traceability Log</span>
                </div>

                {viewingRecord.history && viewingRecord.history.length > 0 ? (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {viewingRecord.history.map((h) => (
                      <div key={h.historyId} className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-1">
                        <div className="flex justify-between items-center font-medium">
                          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{h.calibrationEventNo}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            h.calibrationResult === 'PASS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {h.calibrationResult}
                          </span>
                        </div>
                        <div className="text-slate-600 dark:text-slate-400">
                          Date: <strong>{new Date(h.calibrationDate).toLocaleDateString()}</strong> | Cert: <span className="font-mono">{h.certificateNo}</span>
                        </div>
                        <div className="text-slate-500">
                          Lab: {h.calibratedByAgency} ({h.calibratorName})
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          Nominal: {h.nominalValue} | Observed: {h.observedValue} | Error: {h.errorVal} (Tol: ±{h.permissibleTolerance})
                        </div>
                        {h.remarks && <p className="text-slate-600 italic mt-0.5">{h.remarks}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No calibration events recorded yet.</p>
                )}
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setViewingRecord(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. Printable Calibration Certificate / Passport Modal */}
      {printingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-xl max-w-3xl w-full p-8 shadow-2xl my-8">
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight uppercase">Kashvira Infotech Metrology Laboratory</h2>
                <p className="text-xs text-slate-600">Central Metrology & Calibration Standards Bay | ISO/IEC 17025 Accredited</p>
                <h1 className="text-lg font-black text-indigo-700 mt-2">CERTIFICATE OF CALIBRATION & INSTRUMENT PASSPORT</h1>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-base">{printingRecord.gaugeCode}</div>
                <div className="text-xs text-slate-500">Cert: {printingRecord.calibrationCertificateNo}</div>
                <div className="mt-1 inline-block px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-xs font-bold rounded">
                  STATUS: {printingRecord.currentStatus}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 my-4 text-xs">
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <div className="font-semibold text-slate-700 mb-1">EQUIPMENT UNDER TEST (EUT):</div>
                <div>Description: <strong>{printingRecord.gaugeName}</strong></div>
                <div>Manufacturer: <strong>{printingRecord.makeManufacturer}</strong></div>
                <div>Model No: <strong>{printingRecord.modelNo || 'N/A'}</strong></div>
                <div>Serial Number: <strong className="font-mono">{printingRecord.serialNo}</strong></div>
                <div>Location / Station: <strong>{printingRecord.locationCustody}</strong></div>
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <div className="font-semibold text-slate-700 mb-1">METROLOGICAL SPECIFICATIONS:</div>
                <div>Range Capacity: <strong>{printingRecord.rangeMin} - {printingRecord.rangeMax} {printingRecord.uom}</strong></div>
                <div>Least Count: <strong>{printingRecord.leastCount} {printingRecord.uom}</strong></div>
                <div>Max Permissible Error (MPE): <strong>±{printingRecord.maxPermissibleError} {printingRecord.uom}</strong></div>
                <div>Last Calibration: <strong>{new Date(printingRecord.lastCalibrationDate).toLocaleDateString()}</strong></div>
                <div>Next Due Date: <strong className="text-indigo-600">{new Date(printingRecord.nextCalibrationDueDate).toLocaleDateString()}</strong></div>
              </div>
            </div>

            <div className="my-3 text-xs p-3 bg-slate-50 border rounded">
              <div className="font-semibold text-slate-700 mb-1">TRACEABILITY & ACCREDITATION:</div>
              <div>Calibration Agency: <strong>{printingRecord.agencyName} ({printingRecord.calibrationAgencyType})</strong></div>
              <div>Reference Standard: <strong>Grade-0 Ceramic Gauge Block Set (NPL / NIST Traceable Standards)</strong></div>
              <div>Environmental Conditions: <strong>Temp: 20.0 ± 0.5 °C, Humidity: 50 ± 5% RH per ISO 1</strong></div>
            </div>

            {printingRecord.history && printingRecord.history.length > 0 && (
              <div className="my-4 text-xs">
                <div className="font-bold text-slate-800 mb-2">RECENT CALIBRATION VERIFICATION RECORD:</div>
                <table className="w-full border-collapse border border-slate-200 text-center">
                  <thead className="bg-slate-100 font-semibold">
                    <tr>
                      <th className="border p-1.5">Event No</th>
                      <th className="border p-1.5">Date</th>
                      <th className="border p-1.5">Nominal</th>
                      <th className="border p-1.5">Observed</th>
                      <th className="border p-1.5">Error</th>
                      <th className="border p-1.5">Permissible Tol</th>
                      <th className="border p-1.5">Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printingRecord.history.slice(0, 3).map((h) => (
                      <tr key={h.historyId}>
                        <td className="border p-1.5 font-mono">{h.calibrationEventNo}</td>
                        <td className="border p-1.5">{new Date(h.calibrationDate).toLocaleDateString()}</td>
                        <td className="border p-1.5">{h.nominalValue}</td>
                        <td className="border p-1.5">{h.observedValue}</td>
                        <td className="border p-1.5 font-bold text-indigo-700">{h.errorVal}</td>
                        <td className="border p-1.5">±{h.permissibleTolerance}</td>
                        <td className="border p-1.5 font-bold text-emerald-700">{h.calibrationResult}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="grid grid-cols-2 gap-8 mt-8 pt-4 border-t border-slate-300 text-center text-xs">
              <div>
                <div className="h-10 border-b border-slate-300 flex items-end justify-center pb-1 text-slate-400 italic">Signed</div>
                <div className="mt-1 font-semibold">Certified Metrologist / Calibrating Engineer</div>
              </div>
              <div>
                <div className="h-10 border-b border-slate-300 flex items-end justify-center pb-1 text-slate-400 italic">Authorized</div>
                <div className="mt-1 font-semibold">Head of Metrology & Quality Assurance</div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 print:hidden">
              <button
                onClick={() => setPrintingRecord(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-black rounded-lg flex items-center gap-1.5 shadow"
              >
                <Printer className="h-4 w-4" /> Print Calibration Certificate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. Confirm Delete Modal */}
      {deletingRecord && (
        <ConfirmDeleteModal
          isOpen={Boolean(deletingRecord)}
          entityType="Measuring Instrument"
          entityName={deletingRecord.gaugeName}
          entityCode={deletingRecord.gaugeCode}
          onConfirm={() => deleteMutation.mutate(deletingRecord.gaugeId)}
          onClose={() => setDeletingRecord(null)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
};
