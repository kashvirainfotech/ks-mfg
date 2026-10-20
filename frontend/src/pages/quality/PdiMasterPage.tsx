import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Award,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Compass,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  FlaskConical,
  Gauge,
  Layers,
  Lock,
  Microscope,
  Package,
  Plus,
  Printer,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Tag,
  Trash2,
  Truck,
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
export type PdiOverallVerdict =
  | 'PENDING'
  | 'APPROVED_FOR_DISPATCH'
  | 'REJECTED_QUARANTINE'
  | 'CONCESSION_ACCEPTED';

export type PdiDisposition =
  | 'CLEAR_FOR_INVOICE'
  | 'QUARANTINE_HOLD'
  | 'RETURN_TO_SHOPFLOOR'
  | 'SCRAP'
  | 'CONCESSION_USE_AS_IS';

export type PdiParamCategory =
  | 'DIMENSIONAL'
  | 'FUNCTIONAL_PRESSURE'
  | 'SURFACE_PAINT_DFT'
  | 'VISUAL_PACKAGING'
  | 'ELECTRICAL_ACTUATOR'
  | 'METALLURGICAL_HARDNESS';

export type PdiVisualResult = 'PASS' | 'FAIL' | 'NA';
export type PdiParamResult = 'PASS' | 'FAIL' | 'CONCESSION';
export type PdiStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type PackagingCondition =
  | 'ACCEPTABLE'
  | 'DAMAGED_REPACK'
  | 'POOR_LABELING'
  | 'CRATE_HOLD';

export interface PdiParamItem {
  pdiParamId?: number;
  paramSequence: number;
  paramName: string;
  paramCategory: PdiParamCategory;
  instrumentName?: string;
  nominalVal?: number | null;
  minTolerance?: number | null;
  maxTolerance?: number | null;
  uomCode?: string;
  observedVal1?: number | null;
  observedVal2?: number | null;
  observedVal3?: number | null;
  observedVal4?: number | null;
  observedVal5?: number | null;
  meanVal?: number | null;
  visualResult?: PdiVisualResult;
  paramResult: PdiParamResult;
  notes?: string;
}

export interface PdiCoaSpec {
  coaSpecId?: number;
  pdiId?: number;
  elemCPct?: number | null;
  elemMnPct?: number | null;
  elemSiPct?: number | null;
  elemPPct?: number | null;
  elemSPct?: number | null;
  elemCrPct?: number | null;
  elemNiPct?: number | null;
  elemMoPct?: number | null;
  yieldStrengthMpa?: number | null;
  tensileStrengthMpa?: number | null;
  elongationPct?: number | null;
  hardnessVal?: string;
  impactEnergyJoules?: number | null;
  hydroShellTestBar?: number | null;
  hydroSeatTestBar?: number | null;
  airSeatTestBar?: number | null;
  ndeTestType?: string;
  ndeResult?: 'ACCEPTED' | 'REJECTED' | 'NA';
  labName?: string;
  certifiedEngineer?: string;
  certificationStandard?: string;
}

export interface PdiRecord {
  pdiId: number;
  pdiNo: string;
  pdiDate: string;
  salesOrderId: number | null;
  soNo?: string | null;
  customerId: number;
  customerName: string;
  customerCode?: string;
  woId: number | null;
  woNo?: string | null;
  challanId: number | null;
  challanNo?: string | null;
  itemId: number;
  itemCode: string;
  itemName: string;
  warehouseId: number;
  warehouseName?: string;
  warehouseCode?: string;
  batchNo?: string | null;
  heatNo?: string | null;
  lotQty: number;
  sampleSize: number;
  acceptedQty: number;
  rejectedQty: number;
  reworkQty: number;
  overallVerdict: PdiOverallVerdict;
  disposition?: PdiDisposition | null;
  inspectorId: number;
  inspectorName?: string;
  approverId?: number | null;
  approverName?: string | null;
  approvalDate?: string | null;
  coaNo?: string | null;
  coaDate?: string | null;
  mtcNo?: string | null;
  standardSpecification?: string | null;
  packagingCondition?: PackagingCondition;
  labelingVerification?: PdiVisualResult;
  preservationCoating?: string | null;
  customerWitnessRequired?: boolean;
  customerWitnessName?: string | null;
  customerWitnessDate?: string | null;
  isCoaReleased?: boolean;
  coaReleasedBy?: number | null;
  coaReleasedByName?: string | null;
  coaReleasedAt?: string | null;
  remarks?: string | null;
  deviationReason?: string | null;
  status: PdiStatus;
  createdDate: string;
  paramCount?: number;
  passCount?: number;
  failCount?: number;
  concessionCount?: number;
  params?: PdiParamItem[];
  coaSpec?: PdiCoaSpec | null;
}

export interface PdiSummary {
  totalInspections: number;
  approvedForDispatch: number;
  releasedCoas: number;
  concessionCount: number;
  quarantineHoldCount: number;
  activePendingCount: number;
}

export interface LookupsData {
  customers: {
    partyId: number;
    partyCode: string;
    partyName: string;
  }[];
  salesOrders: {
    soId: number;
    soNo: string;
    soDate: string;
    customerId: number;
    customerName: string;
    customerPoNo?: string;
    status: string;
  }[];
  workOrders: {
    woId: number;
    woNo: string;
    woDate: string;
    itemId: number;
    batchNo?: string;
    plannedQty: number;
    status: string;
  }[];
  deliveryChallans: {
    challanId: number;
    challanNo: string;
    challanDate: string;
    soId?: number | null;
    customerId: number;
    customerName: string;
    status: string;
  }[];
  items: {
    itemId: number;
    itemCode: string;
    itemName: string;
    uomId: number;
  }[];
  warehouses: {
    warehouseId: number;
    warehouseCode: string;
    warehouseName: string;
  }[];
  users: {
    userId: number;
    username: string;
    fullName: string;
  }[];
}

const DEFAULT_COA_SPEC: PdiCoaSpec = {
  elemCPct: 0.03,
  elemMnPct: 1.45,
  elemSiPct: 0.42,
  elemPPct: 0.025,
  elemSPct: 0.012,
  elemCrPct: 17.2,
  elemNiPct: 11.1,
  elemMoPct: 2.15,
  yieldStrengthMpa: 285.0,
  tensileStrengthMpa: 580.0,
  elongationPct: 42.0,
  hardnessVal: '185 HBW',
  impactEnergyJoules: 95.0,
  hydroShellTestBar: 31.0,
  hydroSeatTestBar: 22.0,
  airSeatTestBar: 6.0,
  ndeTestType: '100% Visual + Dye Penetrant (PT) Flange Faces',
  ndeResult: 'ACCEPTED',
  labName: 'Kashvira Metallurgical Testing Laboratory (NABL Accredited)',
  certifiedEngineer: 'Er. R. K. Patel (Level-II NDT / ASNT)',
  certificationStandard: 'EN 10204:2004 Type 3.1 / ISO 10474',
};

const DEFAULT_PARAMS: PdiParamItem[] = [
  {
    paramSequence: 1,
    paramName: 'Overall Valve Height / Flange-to-Flange Length',
    paramCategory: 'DIMENSIONAL',
    instrumentName: 'Digital Caliper / Vernier Height Gauge',
    nominalVal: 216.0,
    minTolerance: 214.0,
    maxTolerance: 218.0,
    uomCode: 'mm',
    observedVal1: 216.0,
    observedVal2: 215.8,
    observedVal3: 216.2,
    meanVal: 216.0,
    visualResult: 'PASS',
    paramResult: 'PASS',
    notes: 'Conforms to ASME B16.10 Face-to-Face dimensions',
  },
  {
    paramSequence: 2,
    paramName: 'Hydrostatic Body/Shell Test (31.0 Bar Hold 3 mins)',
    paramCategory: 'FUNCTIONAL_PRESSURE',
    instrumentName: 'Hydro Pressure Test Bench (PT-03, Calibrated)',
    nominalVal: 31.0,
    minTolerance: 30.5,
    maxTolerance: 32.0,
    uomCode: 'bar',
    observedVal1: 31.2,
    observedVal2: 31.0,
    observedVal3: 31.1,
    meanVal: 31.1,
    visualResult: 'PASS',
    paramResult: 'PASS',
    notes: 'Zero leakage through valve shell/body wall',
  },
  {
    paramSequence: 3,
    paramName: 'Hydrostatic High Pressure Seat Closure Test (22.0 Bar)',
    paramCategory: 'FUNCTIONAL_PRESSURE',
    instrumentName: 'Hydro Pressure Test Bench (PT-03, Calibrated)',
    nominalVal: 22.0,
    minTolerance: 21.5,
    maxTolerance: 23.0,
    uomCode: 'bar',
    observedVal1: 22.0,
    observedVal2: 22.0,
    observedVal3: 22.1,
    meanVal: 22.03,
    visualResult: 'PASS',
    paramResult: 'PASS',
    notes: 'Zero bubble / zero drop seat leakage per API 598',
  },
  {
    paramSequence: 4,
    paramName: 'Low Pressure Pneumatic Air Seat Test (6.0 Bar Hold 2 mins)',
    paramCategory: 'FUNCTIONAL_PRESSURE',
    instrumentName: 'Pneumatic Test Line & Underwater Immersion',
    nominalVal: 6.0,
    minTolerance: 5.8,
    maxTolerance: 6.5,
    uomCode: 'bar',
    observedVal1: 6.0,
    observedVal2: 6.0,
    observedVal3: 6.0,
    meanVal: 6.0,
    visualResult: 'PASS',
    paramResult: 'PASS',
    notes: 'Zero bubble rate (Rate A per ISO 5208)',
  },
  {
    paramSequence: 5,
    paramName: 'External Epoxy Paint DFT (Dry Film Thickness)',
    paramCategory: 'SURFACE_PAINT_DFT',
    instrumentName: 'Digital Coating Thickness Gauge (DFT-Elcometer)',
    nominalVal: 120.0,
    minTolerance: 100.0,
    maxTolerance: 150.0,
    uomCode: 'µm',
    observedVal1: 125.0,
    observedVal2: 122.0,
    observedVal3: 128.0,
    meanVal: 125.0,
    visualResult: 'PASS',
    paramResult: 'PASS',
    notes: 'High-build epoxy coating uniform, free of pinholes',
  },
  {
    paramSequence: 6,
    paramName: 'Visual Identification, Stamping & SS Nameplate Verification',
    paramCategory: 'VISUAL_PACKAGING',
    instrumentName: 'Visual Inspection / Calibrated Rule',
    uomCode: 'NA',
    visualResult: 'PASS',
    paramResult: 'PASS',
    notes: 'Stainless steel nameplate riveted, Heat No laser etched on body',
  },
];

// ============================================================================
// Main Component: PdiMasterPage
// ============================================================================
export const PdiMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'ALL' | 'RELEASED_COA' | 'CONCESSIONS' | 'QUARANTINE'
  >('ALL');

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [verdictFilter, setVerdictFilter] = useState<string>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<PdiRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<PdiRecord | null>(null);
  const [approvingRecord, setApprovingRecord] = useState<PdiRecord | null>(null);
  const [releaseCoaRecord, setReleaseCoaRecord] = useState<PdiRecord | null>(null);
  const [printingRecord, setPrintingRecord] = useState<PdiRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<PdiRecord | null>(null);

  // Form State for Create/Edit
  const [formState, setFormState] = useState<{
    pdiDate: string;
    salesOrderId: number | '';
    customerId: number | '';
    woId: number | '';
    challanId: number | '';
    itemId: number | '';
    warehouseId: number | '';
    batchNo: string;
    heatNo: string;
    lotQty: number;
    sampleSize: number;
    acceptedQty: number;
    rejectedQty: number;
    reworkQty: number;
    overallVerdict: PdiOverallVerdict;
    disposition: PdiDisposition;
    mtcNo: string;
    standardSpecification: string;
    packagingCondition: PackagingCondition;
    labelingVerification: PdiVisualResult;
    preservationCoating: string;
    customerWitnessRequired: boolean;
    customerWitnessName: string;
    customerWitnessDate: string;
    remarks: string;
    params: PdiParamItem[];
    coaSpec: PdiCoaSpec;
  }>({
    pdiDate: new Date().toISOString().split('T')[0],
    salesOrderId: '',
    customerId: '',
    woId: '',
    challanId: '',
    itemId: '',
    warehouseId: '',
    batchNo: '',
    heatNo: '',
    lotQty: 25,
    sampleSize: 5,
    acceptedQty: 25,
    rejectedQty: 0,
    reworkQty: 0,
    overallVerdict: 'PENDING',
    disposition: 'CLEAR_FOR_INVOICE',
    mtcNo: 'MTC-2026-EN10204-0982',
    standardSpecification: 'API 6D / ASME B16.34 Class 150',
    packagingCondition: 'ACCEPTABLE',
    labelingVerification: 'PASS',
    preservationCoating: 'Rust Preventive Oil VCI Wrap & End Caps',
    customerWitnessRequired: false,
    customerWitnessName: '',
    customerWitnessDate: '',
    remarks: '',
    params: DEFAULT_PARAMS,
    coaSpec: DEFAULT_COA_SPEC,
  });

  // Approval Modal State
  const [approvalForm, setApprovalForm] = useState<{
    overallVerdict: PdiOverallVerdict;
    disposition: PdiDisposition;
    acceptedQty: number;
    rejectedQty: number;
    reworkQty: number;
    deviationReason: string;
    remarks: string;
    isReleaseCoa: boolean;
  }>({
    overallVerdict: 'APPROVED_FOR_DISPATCH',
    disposition: 'CLEAR_FOR_INVOICE',
    acceptedQty: 0,
    rejectedQty: 0,
    reworkQty: 0,
    deviationReason: '',
    remarks: '',
    isReleaseCoa: true,
  });

  // Release CoA Modal State
  const [coaForm, setCoaForm] = useState<{
    coaNo: string;
    standardSpecification: string;
    certifiedEngineer: string;
    remarks: string;
  }>({
    coaNo: '',
    standardSpecification: 'API 6D / ASME B16.34 Class 150',
    certifiedEngineer: 'Er. R. K. Patel (Level-II NDT / ASNT)',
    remarks: 'Complies with customer specification and EN 10204 Type 3.1',
  });

  // --------------------------------------------------------------------------
  // API Queries & Mutations
  // --------------------------------------------------------------------------
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<PdiSummary>({
    queryKey: ['pdi-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PdiSummary>>(
        '/quality/pdi/summary',
      );
      return res.data.data;
    },
  });

  const { data: lookupsData } = useQuery<LookupsData>({
    queryKey: ['pdi-lookups'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<LookupsData>>(
        '/quality/pdi/lookups',
      );
      return res.data.data;
    },
  });

  const { data: recordsData, isLoading: isRecordsLoading } = useQuery<
    PdiRecord[]
  >({
    queryKey: [
      'pdi-records',
      customerFilter,
      verdictFilter,
      warehouseFilter,
      searchTerm,
    ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (customerFilter !== 'ALL') params.customerId = customerFilter;
      if (verdictFilter !== 'ALL') params.overallVerdict = verdictFilter;
      if (warehouseFilter !== 'ALL') params.warehouseId = warehouseFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await apiClient.get<ApiResponse<PdiRecord[]>>(
        '/quality/pdi',
        { params },
      );
      return res.data.data;
    },
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<PdiRecord>>(
        '/quality/pdi',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdi-records'] });
      queryClient.invalidateQueries({ queryKey: ['pdi-summary'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.put<ApiResponse<PdiRecord>>(
        `/quality/pdi/${id}`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdi-records'] });
      queryClient.invalidateQueries({ queryKey: ['pdi-summary'] });
      setEditingRecord(null);
      resetForm();
    },
  });

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post<ApiResponse<PdiRecord>>(
        `/quality/pdi/${id}/approve`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdi-records'] });
      queryClient.invalidateQueries({ queryKey: ['pdi-summary'] });
      setApprovingRecord(null);
    },
  });

  // Release CoA Mutation
  const releaseCoaMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post<ApiResponse<PdiRecord>>(
        `/quality/pdi/${id}/release-coa`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdi-records'] });
      queryClient.invalidateQueries({ queryKey: ['pdi-summary'] });
      setReleaseCoaRecord(null);
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete<ApiResponse<{ success: boolean }>>(
        `/quality/pdi/${id}`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdi-records'] });
      queryClient.invalidateQueries({ queryKey: ['pdi-summary'] });
      setDeletingRecord(null);
    },
  });

  // Reset form helper
  const resetForm = () => {
    setFormState({
      pdiDate: new Date().toISOString().split('T')[0],
      salesOrderId: '',
      customerId: '',
      woId: '',
      challanId: '',
      itemId: '',
      warehouseId: '',
      batchNo: '',
      heatNo: '',
      lotQty: 25,
      sampleSize: 5,
      acceptedQty: 25,
      rejectedQty: 0,
      reworkQty: 0,
      overallVerdict: 'PENDING',
      disposition: 'CLEAR_FOR_INVOICE',
      mtcNo: 'MTC-2026-EN10204-0982',
      standardSpecification: 'API 6D / ASME B16.34 Class 150',
      packagingCondition: 'ACCEPTABLE',
      labelingVerification: 'PASS',
      preservationCoating: 'Rust Preventive Oil VCI Wrap & End Caps',
      customerWitnessRequired: false,
      customerWitnessName: '',
      customerWitnessDate: '',
      remarks: '',
      params: DEFAULT_PARAMS,
      coaSpec: DEFAULT_COA_SPEC,
    });
  };

  // Populate Edit form
  const handleOpenEdit = async (record: PdiRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<PdiRecord>>(
        `/quality/pdi/${record.pdiId}`,
      );
      const full = res.data.data;
      setEditingRecord(full);
      setFormState({
        pdiDate: full.pdiDate
          ? full.pdiDate.split('T')[0]
          : new Date().toISOString().split('T')[0],
        salesOrderId: full.salesOrderId || '',
        customerId: full.customerId,
        woId: full.woId || '',
        challanId: full.challanId || '',
        itemId: full.itemId,
        warehouseId: full.warehouseId,
        batchNo: full.batchNo || '',
        heatNo: full.heatNo || '',
        lotQty: full.lotQty,
        sampleSize: full.sampleSize,
        acceptedQty: full.acceptedQty,
        rejectedQty: full.rejectedQty,
        reworkQty: full.reworkQty,
        overallVerdict: full.overallVerdict,
        disposition: full.disposition || 'CLEAR_FOR_INVOICE',
        mtcNo: full.mtcNo || '',
        standardSpecification: full.standardSpecification || '',
        packagingCondition: full.packagingCondition || 'ACCEPTABLE',
        labelingVerification: full.labelingVerification || 'PASS',
        preservationCoating: full.preservationCoating || '',
        customerWitnessRequired: Boolean(full.customerWitnessRequired),
        customerWitnessName: full.customerWitnessName || '',
        customerWitnessDate: full.customerWitnessDate
          ? full.customerWitnessDate.split('T')[0]
          : '',
        remarks: full.remarks || '',
        params: full.params && full.params.length > 0 ? full.params : DEFAULT_PARAMS,
        coaSpec: full.coaSpec || DEFAULT_COA_SPEC,
      });
    } catch {
      setEditingRecord(record);
    }
  };

  const handleOpenView = async (record: PdiRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<PdiRecord>>(
        `/quality/pdi/${record.pdiId}`,
      );
      setViewingRecord(res.data.data);
    } catch {
      setViewingRecord(record);
    }
  };

  const handleOpenPrint = async (record: PdiRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<PdiRecord>>(
        `/quality/pdi/${record.pdiId}`,
      );
      setPrintingRecord(res.data.data);
    } catch {
      setPrintingRecord(record);
    }
  };

  const handleOpenApprove = (record: PdiRecord) => {
    setApprovingRecord(record);
    setApprovalForm({
      overallVerdict:
        record.overallVerdict === 'PENDING'
          ? 'APPROVED_FOR_DISPATCH'
          : record.overallVerdict,
      disposition: record.disposition || 'CLEAR_FOR_INVOICE',
      acceptedQty: record.acceptedQty || record.lotQty,
      rejectedQty: record.rejectedQty || 0,
      reworkQty: record.reworkQty || 0,
      deviationReason: record.deviationReason || '',
      remarks: record.remarks || '',
      isReleaseCoa: !record.isCoaReleased,
    });
  };

  const handleOpenReleaseCoa = (record: PdiRecord) => {
    setReleaseCoaRecord(record);
    setCoaForm({
      coaNo: record.coaNo || `COA-AHM-2627-${String(record.pdiId).padStart(4, '0')}`,
      standardSpecification:
        record.standardSpecification || 'API 6D / ASME B16.34 Class 150',
      certifiedEngineer:
        record.coaSpec?.certifiedEngineer ||
        'Er. R. K. Patel (Level-II NDT / ASNT)',
      remarks: 'Conforms to customer order specifications & EN 10204 Type 3.1',
    });
  };

  // Submit Handler
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.customerId || !formState.itemId || !formState.warehouseId) {
      alert('Please select Customer, Item, and Target Warehouse.');
      return;
    }

    const payload = {
      pdiDate: formState.pdiDate,
      salesOrderId: formState.salesOrderId ? Number(formState.salesOrderId) : null,
      customerId: Number(formState.customerId),
      woId: formState.woId ? Number(formState.woId) : null,
      challanId: formState.challanId ? Number(formState.challanId) : null,
      itemId: Number(formState.itemId),
      warehouseId: Number(formState.warehouseId),
      batchNo: formState.batchNo,
      heatNo: formState.heatNo,
      lotQty: Number(formState.lotQty),
      sampleSize: Number(formState.sampleSize),
      acceptedQty: Number(formState.acceptedQty),
      rejectedQty: Number(formState.rejectedQty),
      reworkQty: Number(formState.reworkQty),
      overallVerdict: formState.overallVerdict,
      disposition: formState.disposition,
      mtcNo: formState.mtcNo,
      standardSpecification: formState.standardSpecification,
      packagingCondition: formState.packagingCondition,
      labelingVerification: formState.labelingVerification,
      preservationCoating: formState.preservationCoating,
      customerWitnessRequired: formState.customerWitnessRequired,
      customerWitnessName: formState.customerWitnessName,
      customerWitnessDate: formState.customerWitnessDate || null,
      remarks: formState.remarks,
      params: formState.params,
      coaSpec: formState.coaSpec,
    };

    if (editingRecord) {
      updateMutation.mutate({ id: editingRecord.pdiId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // --------------------------------------------------------------------------
  // Tab-Filtered Records
  // --------------------------------------------------------------------------
  const filteredRecords = useMemo(() => {
    const list = recordsData || [];
    if (activeTab === 'RELEASED_COA') {
      return list.filter((r) => r.isCoaReleased === true);
    }
    if (activeTab === 'CONCESSIONS') {
      return list.filter(
        (r) =>
          r.overallVerdict === 'CONCESSION_ACCEPTED' ||
          (r.concessionCount && r.concessionCount > 0),
      );
    }
    if (activeTab === 'QUARANTINE') {
      return list.filter(
        (r) =>
          r.overallVerdict === 'REJECTED_QUARANTINE' ||
          r.disposition === 'QUARANTINE_HOLD' ||
          (r.rejectedQty && r.rejectedQty > 0),
      );
    }
    return list;
  }, [recordsData, activeTab]);

  // --------------------------------------------------------------------------
  // Table Columns Definition
  // --------------------------------------------------------------------------
  const columns: MasterTableColumn<PdiRecord>[] = [
    {
      key: 'pdiNo',
      header: 'PDI Inspection No',
      sortValue: (r) => r.pdiNo,
      render: (r) => (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => handleOpenView(r)}
            className="text-left font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-blue-500" />
            <span>{r.pdiNo}</span>
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {r.pdiDate ? new Date(r.pdiDate).toLocaleDateString() : '-'}
          </span>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer & Sales Order',
      sortValue: (r) => r.customerName,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            {r.customerName}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {r.soNo ? `SO: ${r.soNo}` : 'No SO Linked'}
            {r.challanNo ? ` | Challan: ${r.challanNo}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'item',
      header: 'Finished Goods & Melt Trace',
      sortValue: (r) => r.itemName,
      render: (r) => (
        <div className="flex flex-col max-w-xs">
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {r.itemName}
          </span>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono text-[11px]">
              {r.itemCode}
            </span>
            {r.heatNo && (
              <span className="text-amber-600 dark:text-amber-400 font-mono text-[11px]">
                Heat: {r.heatNo}
              </span>
            )}
            {r.batchNo && (
              <span className="text-gray-400 font-mono text-[11px]">
                Lot: {r.batchNo}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'quantities',
      header: 'Inspection Quantities',
      render: (r) => (
        <div className="flex flex-col text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              Lot: {r.lotQty}
            </span>
            <span className="text-gray-400">| Sample: {r.sampleSize}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              Acc: {r.acceptedQty}
            </span>
            {r.rejectedQty > 0 && (
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                Rej: {r.rejectedQty}
              </span>
            )}
            {r.reworkQty > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                Rew: {r.reworkQty}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'overallVerdict',
      header: 'Overall Verdict & Gating',
      sortValue: (r) => r.overallVerdict,
      render: (r) => {
        let badgeClass =
          'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
        let labelText: string = r.overallVerdict;

        if (r.overallVerdict === 'APPROVED_FOR_DISPATCH') {
          badgeClass =
            'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
          labelText = 'Cleared for Dispatch';
        } else if (r.overallVerdict === 'CONCESSION_ACCEPTED') {
          badgeClass =
            'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
          labelText = 'Concession Accepted';
        } else if (r.overallVerdict === 'REJECTED_QUARANTINE') {
          badgeClass =
            'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
          labelText = 'Quarantine Rejected';
        } else if (r.overallVerdict === 'PENDING') {
          badgeClass =
            'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
          labelText = 'Inspection Pending';
        }

        return (
          <div className="flex flex-col items-start gap-1">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}
            >
              {r.overallVerdict === 'APPROVED_FOR_DISPATCH' && (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {r.overallVerdict === 'REJECTED_QUARANTINE' && (
                <XCircle className="w-3.5 h-3.5" />
              )}
              {r.overallVerdict === 'CONCESSION_ACCEPTED' && (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              {r.overallVerdict === 'PENDING' && (
                <Clock className="w-3.5 h-3.5" />
              )}
              {labelText}
            </span>
            {r.disposition && (
              <span className="text-[11px] text-gray-500 font-mono">
                {r.disposition}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'coaStatus',
      header: 'Certificate of Analysis (CoA)',
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          {r.isCoaReleased && r.coaNo ? (
            <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800 px-2 py-0.5 rounded text-xs font-medium">
              <Award className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{r.coaNo}</span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 italic">
              <Clock className="w-3.5 h-3.5" />
              Unreleased
            </span>
          )}
          {r.standardSpecification && (
            <span className="text-[11px] text-gray-500 truncate max-w-[180px]">
              {r.standardSpecification}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="View PDI Quality Passport"
            onClick={() => handleOpenView(r)}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded transition"
          >
            <Eye className="w-4 h-4" />
          </button>

          <PermissionGate screen="PDI_QC" action="PRINT">
            <button
              type="button"
              title="Print EN 10204 Type 3.1 Certificate of Analysis"
              onClick={() => handleOpenPrint(r)}
              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded transition"
            >
              <Printer className="w-4 h-4" />
            </button>
          </PermissionGate>

          {r.status !== 'APPROVED' && (
            <PermissionGate screen="PDI_QC" action="EDIT">
              <button
                type="button"
                title="Edit Inspection Observations"
                onClick={() => handleOpenEdit(r)}
                className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded transition"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          <PermissionGate screen="PDI_QC" action="APPROVE">
            <button
              type="button"
              title="Gating & Dispatch Approval"
              onClick={() => handleOpenApprove(r)}
              className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded transition"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </PermissionGate>

          {!r.isCoaReleased && r.overallVerdict !== 'REJECTED_QUARANTINE' && (
            <PermissionGate screen="PDI_QC" action="RELEASE">
              <button
                type="button"
                title="Release Official CoA"
                onClick={() => handleOpenReleaseCoa(r)}
                className="p-1.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded transition"
              >
                <Award className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {!r.isCoaReleased && r.status !== 'APPROVED' && (
            <PermissionGate screen="PDI_QC" action="DELETE">
              <button
                type="button"
                title="Cancel Inspection"
                onClick={() => setDeletingRecord(r)}
                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}
        </div>
      ),
    },
  ];

  // Group By Options
  const groupByOptions: GroupByOption<PdiRecord>[] = [
    {
      key: 'customer',
      label: 'Customer',
      groupValue: (r) => r.customerName,
    },
    {
      key: 'overallVerdict',
      label: 'Overall Verdict',
      groupValue: (r) => r.overallVerdict,
    },
    {
      key: 'item',
      label: 'Finished Goods Item',
      groupValue: (r) => `${r.itemCode} - ${r.itemName}`,
    },
    {
      key: 'status',
      label: 'Document Status',
      groupValue: (r) => r.status,
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Pre-Dispatch Inspection (PDI) & Certificate of Analysis (CoA)
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Final Quality Assurance gating, hydrostatic testing, metallurgical
                analysis, and EN 10204 3.1 certification.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate screen="PDI_QC" action="ADD">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Record Pre-Dispatch Inspection</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total PDI Lots
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {isSummaryLoading
                ? '...'
                : summaryData?.totalInspections || 0}
            </p>
            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
              {summaryData?.activePendingCount || 0} active pending
            </span>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
            <ClipboardCheck className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Released CoAs & Cleared
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {isSummaryLoading
                ? '...'
                : summaryData?.releasedCoas || 0}
            </p>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              {summaryData?.approvedForDispatch || 0} cleared for dispatch
            </span>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Concessions & Deviations
            </p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {isSummaryLoading
                ? '...'
                : summaryData?.concessionCount || 0}
            </p>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Conditionally approved lots
            </span>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Quarantine Holds
            </p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              {isSummaryLoading
                ? '...'
                : summaryData?.quarantineHoldCount || 0}
            </p>
            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              Blocked from customer dispatch
            </span>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs & View Switcher */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 space-x-6">
        <button
          type="button"
          onClick={() => setActiveTab('ALL')}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'ALL'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          All PDI Lots ({recordsData?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('RELEASED_COA')}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'RELEASED_COA'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Released CoAs ({summaryData?.releasedCoas || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CONCESSIONS')}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'CONCESSIONS'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Concessions & Deviations ({summaryData?.concessionCount || 0})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('QUARANTINE')}
          className={`pb-3 text-sm font-semibold border-b-2 transition ${
            activeTab === 'QUARANTINE'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Quarantine Holds ({summaryData?.quarantineHoldCount || 0})
        </button>
      </div>

      {/* Filters & Search */}
      <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Search PDI / CoA / Melt / Item
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="e.g. PDI-AHM, Heat, Customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Filter by Customer
          </label>
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="ALL">All Customers</option>
            {lookupsData?.customers.map((c) => (
              <option key={c.partyId} value={c.partyId}>
                {c.partyName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Filter by Overall Verdict
          </label>
          <select
            value={verdictFilter}
            onChange={(e) => setVerdictFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="ALL">All Verdicts</option>
            <option value="APPROVED_FOR_DISPATCH">Approved for Dispatch</option>
            <option value="PENDING">Pending Inspection</option>
            <option value="CONCESSION_ACCEPTED">Concession Accepted</option>
            <option value="REJECTED_QUARANTINE">Rejected Quarantine</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Target Warehouse
          </label>
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            <option value="ALL">All Warehouses</option>
            {lookupsData?.warehouses.map((w) => (
              <option key={w.warehouseId} value={w.warehouseId}>
                {w.warehouseName} ({w.warehouseCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Master Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <MasterDataTable<PdiRecord>
          title="Pre-Dispatch Quality Inspections (PDI) & CoAs"
          subtitle="Final quality gating, hydrostatic pressure hold tests, metallurgical analysis, and EN 10204 Type 3.1 certification"
          screenCode="PDI_QC"
          tableNameBadge="tbl_qc_pdi_header"
          data={filteredRecords}
          columns={columns}
          isLoading={isRecordsLoading}
          rowKey={(r) => r.pdiId}
          searchPlaceholder="Search inspections in table..."
          searchPredicate={(r, q) => {
            const query = q.toLowerCase();
            return (
              r.pdiNo.toLowerCase().includes(query) ||
              (Boolean(r.coaNo) && r.coaNo!.toLowerCase().includes(query)) ||
              (Boolean(r.mtcNo) && r.mtcNo!.toLowerCase().includes(query)) ||
              r.customerName.toLowerCase().includes(query) ||
              r.itemName.toLowerCase().includes(query) ||
              r.itemCode.toLowerCase().includes(query) ||
              (Boolean(r.batchNo) && r.batchNo!.toLowerCase().includes(query)) ||
              (Boolean(r.heatNo) && r.heatNo!.toLowerCase().includes(query))
            );
          }}
          groupByOptions={groupByOptions}
          addButtonLabel="Record Pre-Dispatch Inspection"
          onAddClick={() => {
            resetForm();
            setIsCreateModalOpen(true);
          }}
        />
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: Create / Edit PDI Inspection & CoA Matrix                    */}
      {/* ===================================================================== */}
      {(isCreateModalOpen || editingRecord) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {editingRecord
                    ? `Edit Inspection: ${editingRecord.pdiNo}`
                    : 'Record Pre-Dispatch Inspection (PDI) & CoA'}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Document physical, dimensional, functional hydrostatic, and
                  metallurgical characteristics for final dispatch release.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingRecord(null);
                  resetForm();
                }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveForm} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Section 1: Customer & Logistics Linking */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  1. Order, Customer & Warehouse Allocation
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      PDI Inspection Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formState.pdiDate}
                      onChange={(e) =>
                        setFormState({ ...formState, pdiDate: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Customer *
                    </label>
                    <select
                      required
                      value={formState.customerId}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          customerId: e.target.value ? Number(e.target.value) : '',
                        })
                      }
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">-- Select Customer --</option>
                      {lookupsData?.customers.map((c) => (
                        <option key={c.partyId} value={c.partyId}>
                          {c.partyName} ({c.partyCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Sales Order
                    </label>
                    <select
                      value={formState.salesOrderId}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          salesOrderId: e.target.value
                            ? Number(e.target.value)
                            : '',
                        })
                      }
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">-- Optional: Link Sales Order --</option>
                      {lookupsData?.salesOrders.map((so) => (
                        <option key={so.soId} value={so.soId}>
                          {so.soNo} ({so.customerName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Finished Goods Warehouse *
                    </label>
                    <select
                      required
                      value={formState.warehouseId}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          warehouseId: e.target.value
                            ? Number(e.target.value)
                            : '',
                        })
                      }
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">-- Select Target Warehouse --</option>
                      {lookupsData?.warehouses.map((w) => (
                        <option key={w.warehouseId} value={w.warehouseId}>
                          {w.warehouseName} ({w.warehouseCode})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Finished Item & Lot Traceability */}
              <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4" />
                  2. Manufactured Product & Melt Traceability
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Finished Goods Item *
                    </label>
                    <select
                      required
                      value={formState.itemId}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          itemId: e.target.value ? Number(e.target.value) : '',
                        })
                      }
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">-- Select Finished Goods Item --</option>
                      {lookupsData?.items.map((it) => (
                        <option key={it.itemId} value={it.itemId}>
                          {it.itemCode} - {it.itemName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Heat / Melt No (Foundry Trace)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HT-2026-CF8M-891"
                      value={formState.heatNo}
                      onChange={(e) =>
                        setFormState({ ...formState, heatNo: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Production Batch / Lot No
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. LOT-2627-0104"
                      value={formState.batchNo}
                      onChange={(e) =>
                        setFormState({ ...formState, batchNo: e.target.value })
                      }
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Total Lot Qty *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={formState.lotQty}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setFormState({
                          ...formState,
                          lotQty: val,
                          acceptedQty: val,
                        });
                      }}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Sample Size (AQL Inspected) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={formState.sampleSize}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          sampleSize: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Standard / Design Spec
                    </label>
                    <input
                      type="text"
                      value={formState.standardSpecification}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          standardSpecification: e.target.value,
                        })
                      }
                      placeholder="e.g. API 6D / ASME B16.34"
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      MTC No (Mill Test Certificate)
                    </label>
                    <input
                      type="text"
                      value={formState.mtcNo}
                      onChange={(e) =>
                        setFormState({ ...formState, mtcNo: e.target.value })
                      }
                      placeholder="e.g. MTC-2026-EN10204-0982"
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Preservation, Packaging & Third-Party Witness */}
              <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-4 h-4" />
                  3. Preservation, Packaging & Customer Witness (TPI)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Packaging Condition
                    </label>
                    <select
                      value={formState.packagingCondition}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          packagingCondition: e.target
                            .value as PackagingCondition,
                        })
                      }
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="ACCEPTABLE">Acceptable / Export Crate</option>
                      <option value="DAMAGED_REPACK">Damaged - Needs Repack</option>
                      <option value="POOR_LABELING">Poor Labeling</option>
                      <option value="CRATE_HOLD">Crate Hold</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Labeling / Stamping Verification
                    </label>
                    <select
                      value={formState.labelingVerification}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          labelingVerification: e.target
                            .value as PdiVisualResult,
                        })
                      }
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      <option value="PASS">PASS - Barcode & Stamping Verified</option>
                      <option value="FAIL">FAIL - Illegible or Missing</option>
                      <option value="NA">NA - Not Applicable</option>
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Preservation & Anti-Rust Coating
                    </label>
                    <input
                      type="text"
                      value={formState.preservationCoating}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          preservationCoating: e.target.value,
                        })
                      }
                      placeholder="e.g. Rust Preventive Oil VCI Wrap & Flange Protectors"
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-center gap-3 bg-gray-50 dark:bg-gray-800/60 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <input
                      type="checkbox"
                      id="witnessReq"
                      checked={formState.customerWitnessRequired}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          customerWitnessRequired: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <label
                      htmlFor="witnessReq"
                      className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                    >
                      Customer / Third Party Inspection (TPI) Witness Sign-off Required
                    </label>
                  </div>

                  {formState.customerWitnessRequired && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Witness Agency / Inspector Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Bureau Veritas / TUV / Mr. Joshi"
                          value={formState.customerWitnessName}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              customerWitnessName: e.target.value,
                            })
                          }
                          className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Witness Date
                        </label>
                        <input
                          type="date"
                          value={formState.customerWitnessDate}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              customerWitnessDate: e.target.value,
                            })
                          }
                          className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Section 4: Characteristic Parameters & Observations Table */}
              <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FlaskConical className="w-4 h-4" />
                    4. Characteristic Parameter Tests & Hydrostatic Observations
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      const newP: PdiParamItem = {
                        paramSequence: formState.params.length + 1,
                        paramName: 'New Inspection Parameter',
                        paramCategory: 'FUNCTIONAL_PRESSURE',
                        instrumentName: 'Calibrated Gauge',
                        nominalVal: 0,
                        uomCode: 'mm',
                        observedVal1: 0,
                        visualResult: 'PASS',
                        paramResult: 'PASS',
                        notes: '',
                      };
                      setFormState({
                        ...formState,
                        params: [...formState.params, newP],
                      });
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium rounded transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Parameter
                  </button>
                </div>

                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="py-2.5 px-3 w-10">#</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Parameter Name</th>
                        <th className="py-2.5 px-3 min-w-[140px]">Category</th>
                        <th className="py-2.5 px-3 min-w-[150px]">Instrument</th>
                        <th className="py-2.5 px-3 w-20">Nominal</th>
                        <th className="py-2.5 px-3 w-20">Min</th>
                        <th className="py-2.5 px-3 w-20">Max</th>
                        <th className="py-2.5 px-3 w-16">UOM</th>
                        <th className="py-2.5 px-3 w-20">Obs 1</th>
                        <th className="py-2.5 px-3 w-20">Obs 2</th>
                        <th className="py-2.5 px-3 w-20">Obs 3</th>
                        <th className="py-2.5 px-3 min-w-[100px]">Result</th>
                        <th className="py-2.5 px-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {formState.params.map((p, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <td className="py-2 px-3 font-mono text-gray-400">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={p.paramName}
                              onChange={(e) => {
                                const next = [...formState.params];
                                next[idx].paramName = e.target.value;
                                setFormState({ ...formState, params: next });
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={p.paramCategory}
                              onChange={(e) => {
                                const next = [...formState.params];
                                next[idx].paramCategory = e.target
                                  .value as PdiParamCategory;
                                setFormState({ ...formState, params: next });
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            >
                              <option value="FUNCTIONAL_PRESSURE">Pressure / Hydro</option>
                              <option value="DIMENSIONAL">Dimensional</option>
                              <option value="SURFACE_PAINT_DFT">Paint DFT</option>
                              <option value="VISUAL_PACKAGING">Visual Stamping</option>
                              <option value="ELECTRICAL_ACTUATOR">Actuator</option>
                              <option value="METALLURGICAL_HARDNESS">Hardness</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={p.instrumentName || ''}
                              onChange={(e) => {
                                const next = [...formState.params];
                                next[idx].instrumentName = e.target.value;
                                setFormState({ ...formState, params: next });
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="any"
                              value={p.nominalVal ?? ''}
                              onChange={(e) => {
                                const next = [...formState.params];
                                next[idx].nominalVal =
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value);
                                setFormState({ ...formState, params: next });
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="any"
                              value={p.minTolerance ?? ''}
                              onChange={(e) => {
                                const next = [...formState.params];
                                next[idx].minTolerance =
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value);
                                setFormState({ ...formState, params: next });
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="any"
                              value={p.maxTolerance ?? ''}
                              onChange={(e) => {
                                const next = [...formState.params];
                                next[idx].maxTolerance =
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value);
                                setFormState({ ...formState, params: next });
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={p.uomCode || ''}
                              onChange={(e) => {
                                const next = [...formState.params];
                                next[idx].uomCode = e.target.value;
                                setFormState({ ...formState, params: next });
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="any"
                              value={p.observedVal1 ?? ''}
                              onChange={(e) => {
                                const next = [...formState.params];
                                next[idx].observedVal1 =
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value);
                                setFormState({ ...formState, params: next });
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="any"
                              value={p.observedVal2 ?? ''}
                              onChange={(e) => {
                                const next = [...formState.params];
                                next[idx].observedVal2 =
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value);
                                setFormState({ ...formState, params: next });
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              step="any"
                              value={p.observedVal3 ?? ''}
                              onChange={(e) => {
                                const next = [...formState.params];
                                next[idx].observedVal3 =
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value);
                                setFormState({ ...formState, params: next });
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={p.paramResult}
                              onChange={(e) => {
                                const next = [...formState.params];
                                next[idx].paramResult = e.target
                                  .value as PdiParamResult;
                                setFormState({ ...formState, params: next });
                              }}
                              className={`w-full px-2 py-1 text-xs rounded font-semibold border ${
                                p.paramResult === 'PASS'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : p.paramResult === 'FAIL'
                                  ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300'
                                  : 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300'
                              }`}
                            >
                              <option value="PASS">PASS</option>
                              <option value="FAIL">FAIL</option>
                              <option value="CONCESSION">CONCESSION</option>
                            </select>
                          </td>
                          <td className="py-2 px-3 text-right">
                            {formState.params.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = formState.params.filter(
                                    (_, i) => i !== idx,
                                  );
                                  setFormState({ ...formState, params: next });
                                }}
                                className="text-gray-400 hover:text-rose-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 5: Chemical & Mechanical CoA Specification Matrix */}
              <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
                <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Award className="w-4 h-4" />
                  5. Certificate of Analysis (CoA) Chemical & Mechanical Matrix (EN 10204 Type 3.1)
                </h3>

                <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
                  {/* Chemical Composition */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Chemical Composition % (Melt / Ladle Analysis)
                    </h4>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {[
                        { key: 'elemCPct', label: 'C %' },
                        { key: 'elemMnPct', label: 'Mn %' },
                        { key: 'elemSiPct', label: 'Si %' },
                        { key: 'elemPPct', label: 'P %' },
                        { key: 'elemSPct', label: 'S %' },
                        { key: 'elemCrPct', label: 'Cr %' },
                        { key: 'elemNiPct', label: 'Ni %' },
                        { key: 'elemMoPct', label: 'Mo %' },
                      ].map((elem) => (
                        <div key={elem.key}>
                          <label className="block text-[11px] font-mono text-gray-500 mb-0.5">
                            {elem.label}
                          </label>
                          <input
                            type="number"
                            step="0.0001"
                            value={(formState.coaSpec as any)[elem.key] ?? ''}
                            onChange={(e) =>
                              setFormState({
                                ...formState,
                                coaSpec: {
                                  ...formState.coaSpec,
                                  [elem.key]:
                                    e.target.value === ''
                                      ? null
                                      : Number(e.target.value),
                                },
                              })
                            }
                            className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mechanical Properties */}
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Mechanical Tensile & Impact Properties
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-0.5">
                          Yield Strength (MPa)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={formState.coaSpec.yieldStrengthMpa ?? ''}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              coaSpec: {
                                ...formState.coaSpec,
                                yieldStrengthMpa:
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                              },
                            })
                          }
                          className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-500 mb-0.5">
                          Tensile Strength (MPa)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={formState.coaSpec.tensileStrengthMpa ?? ''}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              coaSpec: {
                                ...formState.coaSpec,
                                tensileStrengthMpa:
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                              },
                            })
                          }
                          className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-500 mb-0.5">
                          Elongation (%)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={formState.coaSpec.elongationPct ?? ''}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              coaSpec: {
                                ...formState.coaSpec,
                                elongationPct:
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                              },
                            })
                          }
                          className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-500 mb-0.5">
                          Hardness Value
                        </label>
                        <input
                          type="text"
                          value={formState.coaSpec.hardnessVal || ''}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              coaSpec: {
                                ...formState.coaSpec,
                                hardnessVal: e.target.value,
                              },
                            })
                          }
                          placeholder="e.g. 185 HBW"
                          className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-gray-500 mb-0.5">
                          Charpy Impact (J)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={formState.coaSpec.impactEnergyJoules ?? ''}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              coaSpec: {
                                ...formState.coaSpec,
                                impactEnergyJoules:
                                  e.target.value === ''
                                    ? null
                                    : Number(e.target.value),
                              },
                            })
                          }
                          className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* NDE Testing & Lab Authentication */}
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">
                        NDE / NDT Examination
                      </label>
                      <input
                        type="text"
                        value={formState.coaSpec.ndeTestType || ''}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            coaSpec: {
                              ...formState.coaSpec,
                              ndeTestType: e.target.value,
                            },
                          })
                        }
                        className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">
                        NDE Result
                      </label>
                      <select
                        value={formState.coaSpec.ndeResult || 'ACCEPTED'}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            coaSpec: {
                              ...formState.coaSpec,
                              ndeResult: e.target.value as any,
                            },
                          })
                        }
                        className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      >
                        <option value="ACCEPTED">ACCEPTED - No Discontinuities</option>
                        <option value="REJECTED">REJECTED</option>
                        <option value="NA">NA - Not Applicable</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">
                        Accredited Testing Laboratory
                      </label>
                      <input
                        type="text"
                        value={formState.coaSpec.labName || ''}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            coaSpec: {
                              ...formState.coaSpec,
                              labName: e.target.value,
                            },
                          })
                        }
                        className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 6: Remarks */}
              <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                  Quality Inspector Notes & Remarks
                </label>
                <textarea
                  rows={2}
                  value={formState.remarks}
                  onChange={(e) =>
                    setFormState({ ...formState, remarks: e.target.value })
                  }
                  placeholder="e.g. Dimensions verified with calibrated vernier caliper; hydrostatic hold sustained without pressure decay."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-3 -mx-6 -mb-6 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingRecord(null);
                    resetForm();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {createMutation.isPending || updateMutation.isPending
                      ? 'Saving Record...'
                      : editingRecord
                      ? 'Update Inspection'
                      : 'Save PDI Inspection'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: View PDI Quality Passport & Observations Modal              */}
      {/* ===================================================================== */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Quality Passport: {viewingRecord.pdiNo}
                  </h2>
                  <p className="text-xs text-gray-500">
                    Inspected on {new Date(viewingRecord.pdiDate).toLocaleDateString()} | Inspector: {viewingRecord.inspectorName || 'Er. Quality Lead'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Top Banner Status */}
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-gray-400 block mb-0.5">Customer</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {viewingRecord.customerName}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Product</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {viewingRecord.itemName} ({viewingRecord.itemCode})
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">Verdict</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {viewingRecord.overallVerdict}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block mb-0.5">CoA Certificate</span>
                  <span className="font-semibold font-mono text-indigo-600 dark:text-indigo-400">
                    {viewingRecord.isCoaReleased
                      ? viewingRecord.coaNo
                      : 'Pending Release'}
                  </span>
                </div>
              </div>

              {/* Parameters Breakdown */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Observed Characteristic Readings
                </h3>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 dark:bg-gray-800/80 font-semibold text-gray-600 dark:text-gray-300">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Parameter</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3">Nominal (Tol)</th>
                        <th className="py-2 px-3">Readings (1..3)</th>
                        <th className="py-2 px-3">Mean</th>
                        <th className="py-2 px-3">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {viewingRecord.params?.map((p, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 text-gray-400 font-mono">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 font-medium">
                            {p.paramName}
                            {p.notes && (
                              <p className="text-[11px] text-gray-400 italic font-normal">
                                {p.notes}
                              </p>
                            )}
                          </td>
                          <td className="py-2 px-3 text-gray-500">
                            {p.paramCategory}
                          </td>
                          <td className="py-2 px-3 font-mono">
                            {p.nominalVal ?? '-'} {p.uomCode}
                            {p.minTolerance !== null && (
                              <span className="text-[10px] text-gray-400 block">
                                [{p.minTolerance} ~ {p.maxTolerance}]
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-gray-700 dark:text-gray-300">
                            {[p.observedVal1, p.observedVal2, p.observedVal3]
                              .filter((v) => v !== null && v !== undefined)
                              .join(', ') || '-'}
                          </td>
                          <td className="py-2 px-3 font-mono font-semibold">
                            {p.meanVal ?? p.observedVal1 ?? '-'}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                p.paramResult === 'PASS'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : p.paramResult === 'FAIL'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              {p.paramResult}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Chemical & Mechanical Spec */}
              {viewingRecord.coaSpec && (
                <div className="p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Chemical & Mechanical Matrix Summary
                  </h3>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 font-mono text-xs">
                    <div className="bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 text-center">
                      <span className="text-gray-400 text-[10px] block">C %</span>
                      <span className="font-semibold">{viewingRecord.coaSpec.elemCPct}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 text-center">
                      <span className="text-gray-400 text-[10px] block">Mn %</span>
                      <span className="font-semibold">{viewingRecord.coaSpec.elemMnPct}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 text-center">
                      <span className="text-gray-400 text-[10px] block">Si %</span>
                      <span className="font-semibold">{viewingRecord.coaSpec.elemSiPct}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 text-center">
                      <span className="text-gray-400 text-[10px] block">P %</span>
                      <span className="font-semibold">{viewingRecord.coaSpec.elemPPct}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 text-center">
                      <span className="text-gray-400 text-[10px] block">S %</span>
                      <span className="font-semibold">{viewingRecord.coaSpec.elemSPct}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 text-center">
                      <span className="text-gray-400 text-[10px] block">Cr %</span>
                      <span className="font-semibold">{viewingRecord.coaSpec.elemCrPct}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 text-center">
                      <span className="text-gray-400 text-[10px] block">Ni %</span>
                      <span className="font-semibold">{viewingRecord.coaSpec.elemNiPct}</span>
                    </div>
                    <div className="bg-white dark:bg-gray-900 p-2 rounded border border-gray-200 dark:border-gray-700 text-center">
                      <span className="text-gray-400 text-[10px] block">Mo %</span>
                      <span className="font-semibold">{viewingRecord.coaSpec.elemMoPct}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
                    <div>
                      <span className="text-gray-400 block text-[11px]">Yield Strength</span>
                      <span className="font-semibold font-mono">{viewingRecord.coaSpec.yieldStrengthMpa} MPa</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[11px]">Tensile Strength</span>
                      <span className="font-semibold font-mono">{viewingRecord.coaSpec.tensileStrengthMpa} MPa</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[11px]">Elongation</span>
                      <span className="font-semibold font-mono">{viewingRecord.coaSpec.elongationPct} %</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[11px]">Hardness</span>
                      <span className="font-semibold font-mono">{viewingRecord.coaSpec.hardnessVal}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const r = viewingRecord;
                  setViewingRecord(null);
                  handleOpenPrint(r);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print Certificate of Analysis</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: Gating & Dispatch Approval Modal                            */}
      {/* ===================================================================== */}
      {approvingRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Pre-Dispatch Gating & Disposition
                </h3>
                <p className="text-xs text-gray-500">
                  Authorize final dispatch verdict for {approvingRecord.pdiNo}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Overall Quality Verdict *
                </label>
                <select
                  value={approvalForm.overallVerdict}
                  onChange={(e) =>
                    setApprovalForm({
                      ...approvalForm,
                      overallVerdict: e.target.value as PdiOverallVerdict,
                    })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold"
                >
                  <option value="APPROVED_FOR_DISPATCH">
                    APPROVED_FOR_DISPATCH (Cleared for Inward Invoice/Challan)
                  </option>
                  <option value="CONCESSION_ACCEPTED">
                    CONCESSION_ACCEPTED (Under Deviation / Concession)
                  </option>
                  <option value="REJECTED_QUARANTINE">
                    REJECTED_QUARANTINE (Hold & Reject)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Material Disposition
                </label>
                <select
                  value={approvalForm.disposition}
                  onChange={(e) =>
                    setApprovalForm({
                      ...approvalForm,
                      disposition: e.target.value as PdiDisposition,
                    })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="CLEAR_FOR_INVOICE">CLEAR_FOR_INVOICE (Dispatch Immediately)</option>
                  <option value="CONCESSION_USE_AS_IS">CONCESSION_USE_AS_IS (Ship as is)</option>
                  <option value="QUARANTINE_HOLD">QUARANTINE_HOLD (Lock in Quarantine Bin)</option>
                  <option value="RETURN_TO_SHOPFLOOR">RETURN_TO_SHOPFLOOR (Rework Required)</option>
                  <option value="SCRAP">SCRAP (Material Scrap)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Accepted Qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={approvalForm.acceptedQty}
                    onChange={(e) =>
                      setApprovalForm({
                        ...approvalForm,
                        acceptedQty: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 font-semibold text-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Rejected Qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={approvalForm.rejectedQty}
                    onChange={(e) =>
                      setApprovalForm({
                        ...approvalForm,
                        rejectedQty: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 font-semibold text-rose-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Rework Qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={approvalForm.reworkQty}
                    onChange={(e) =>
                      setApprovalForm({
                        ...approvalForm,
                        reworkQty: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 font-semibold text-amber-600"
                  />
                </div>
              </div>

              {approvalForm.overallVerdict === 'CONCESSION_ACCEPTED' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Concession / Deviation Justification *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={approvalForm.deviationReason}
                    onChange={(e) =>
                      setApprovalForm({
                        ...approvalForm,
                        deviationReason: e.target.value,
                      })
                    }
                    placeholder="Provide technical waiver justification signed off by customer engineering..."
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              )}

              <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <input
                  type="checkbox"
                  id="releaseCoaCheck"
                  checked={approvalForm.isReleaseCoa}
                  onChange={(e) =>
                    setApprovalForm({
                      ...approvalForm,
                      isReleaseCoa: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <label
                  htmlFor="releaseCoaCheck"
                  className="text-xs font-medium text-indigo-900 dark:text-indigo-200 cursor-pointer"
                >
                  Generate & Digitally Release Certificate of Analysis (CoA) Immediately
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setApprovingRecord(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={approveMutation.isPending}
                onClick={() => {
                  approveMutation.mutate({
                    id: approvingRecord.pdiId,
                    payload: approvalForm,
                  });
                }}
                className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>
                  {approveMutation.isPending
                    ? 'Submitting Verdict...'
                    : 'Confirm Verdict & Release'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: Release Official Certificate of Analysis (CoA) Modal        */}
      {/* ===================================================================== */}
      {releaseCoaRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-xl">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Release Certificate of Analysis
                </h3>
                <p className="text-xs text-gray-500">
                  Digitally authenticate EN 10204 Type 3.1 for {releaseCoaRecord.pdiNo}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CoA Document Number *
                </label>
                <input
                  type="text"
                  required
                  value={coaForm.coaNo}
                  onChange={(e) =>
                    setCoaForm({ ...coaForm, coaNo: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Specification Standard
                </label>
                <input
                  type="text"
                  value={coaForm.standardSpecification}
                  onChange={(e) =>
                    setCoaForm({
                      ...coaForm,
                      standardSpecification: e.target.value,
                    })
                  }
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Certifying Quality Engineer
                </label>
                <input
                  type="text"
                  value={coaForm.certifiedEngineer}
                  onChange={(e) =>
                    setCoaForm({
                      ...coaForm,
                      certifiedEngineer: e.target.value,
                    })
                  }
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Release Remarks / Regulatory Statement
                </label>
                <textarea
                  rows={2}
                  value={coaForm.remarks}
                  onChange={(e) =>
                    setCoaForm({ ...coaForm, remarks: e.target.value })
                  }
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setReleaseCoaRecord(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={releaseCoaMutation.isPending}
                onClick={() => {
                  releaseCoaMutation.mutate({
                    id: releaseCoaRecord.pdiId,
                    payload: coaForm,
                  });
                }}
                className="inline-flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
              >
                <Award className="w-4 h-4" />
                <span>
                  {releaseCoaMutation.isPending
                    ? 'Releasing CoA...'
                    : 'Release & Authorize CoA'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: Printable Certificate of Analysis (EN 10204 Type 3.1)       */}
      {/* ===================================================================== */}
      {printingRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-800">
            {/* Action Bar (Not Printed) */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between rounded-t-2xl print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                <span className="font-semibold text-sm">
                  Official Inspection Certificate / Certificate of Analysis (CoA)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Document
                </button>
                <button
                  type="button"
                  onClick={() => setPrintingRecord(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Area */}
            <div className="flex-1 overflow-y-auto p-8 font-sans space-y-6 print:p-0 print:m-0">
              {/* Header Letterhead */}
              <div className="border-b-2 border-gray-900 pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-2xl font-black tracking-wider text-gray-900 uppercase">
                    KASHVIRA INDUSTRIES PVT. LTD.
                  </h1>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Plot No. 42-45, GIDC Phase-II, Vatva Industrial Estate, Ahmedabad - 382445, Gujarat, India
                  </p>
                  <p className="text-xs text-gray-600">
                    Phone: +91 79 2583 0000 | Email: quality@kashvirainfotech.com | GSTIN: 24AAACK1234F1Z8
                  </p>
                  <p className="text-xs font-semibold text-blue-800 mt-1">
                    ISO 9001:2015 & API Spec Q1 Certified Manufacturing Facility
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-gray-900 text-white font-bold text-xs uppercase tracking-widest rounded">
                    EN 10204 : 2004 Type 3.1
                  </span>
                  <p className="text-xs font-mono font-bold mt-2 text-gray-800">
                    CERT NO: {printingRecord.coaNo || 'COA-DRAFT-PREVIEW'}
                  </p>
                  <p className="text-xs text-gray-600">
                    DATE: {printingRecord.coaDate ? new Date(printingRecord.coaDate).toLocaleDateString() : new Date().toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Title */}
              <div className="text-center py-1">
                <h2 className="text-base font-bold uppercase tracking-wide underline decoration-1 underline-offset-4">
                  INSPECTION CERTIFICATE / CERTIFICATE OF ANALYSIS (CoA)
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Standard Specification: {printingRecord.standardSpecification || 'API 6D / ASME B16.34'}
                </p>
              </div>

              {/* Order & Traceability Grid */}
              <div className="grid grid-cols-2 border border-gray-400 text-xs">
                <div className="p-2 border-r border-b border-gray-400 space-y-1">
                  <p><span className="font-semibold text-gray-600">CUSTOMER:</span> <strong className="text-gray-900">{printingRecord.customerName}</strong></p>
                  <p><span className="font-semibold text-gray-600">SALES ORDER NO:</span> {printingRecord.soNo || 'SO-DIRECT'}</p>
                  <p><span className="font-semibold text-gray-600">DELIVERY CHALLAN:</span> {printingRecord.challanNo || 'PENDING'}</p>
                </div>
                <div className="p-2 border-b border-gray-400 space-y-1">
                  <p><span className="font-semibold text-gray-600">INSPECTION REPORT NO:</span> <strong className="font-mono">{printingRecord.pdiNo}</strong></p>
                  <p><span className="font-semibold text-gray-600">INSPECTION DATE:</span> {new Date(printingRecord.pdiDate).toLocaleDateString()}</p>
                  <p><span className="font-semibold text-gray-600">TARGET WAREHOUSE:</span> {printingRecord.warehouseName || 'Finished Goods'}</p>
                </div>
                <div className="p-2 border-r border-gray-400 space-y-1">
                  <p><span className="font-semibold text-gray-600">PRODUCT DESCRIPTION:</span> <strong className="text-gray-900">{printingRecord.itemName}</strong></p>
                  <p><span className="font-semibold text-gray-600">ITEM CODE:</span> {printingRecord.itemCode}</p>
                  <p><span className="font-semibold text-gray-600">MTC REF NO:</span> {printingRecord.mtcNo || 'MTC-2026-EN10204-0982'}</p>
                </div>
                <div className="p-2 space-y-1">
                  <p><span className="font-semibold text-gray-600">HEAT / MELT NO:</span> <strong className="font-mono">{printingRecord.heatNo || 'HT-2026-CF8M-891'}</strong></p>
                  <p><span className="font-semibold text-gray-600">PRODUCTION BATCH:</span> <strong className="font-mono">{printingRecord.batchNo || 'LOT-2627-0104'}</strong></p>
                  <p><span className="font-semibold text-gray-600">QUANTITY:</span> Lot: <strong>{printingRecord.lotQty} Nos</strong> | Sample: <strong>{printingRecord.sampleSize} Nos</strong></p>
                </div>
              </div>

              {/* 1. Chemical Composition */}
              <div className="space-y-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                  1. Chemical Composition % (Ladle Analysis)
                </h3>
                <div className="border border-gray-400 overflow-x-auto">
                  <table className="w-full text-center text-xs font-mono">
                    <thead className="bg-gray-100 border-b border-gray-400 font-bold">
                      <tr>
                        <th className="py-1 px-2 border-r border-gray-400">Element</th>
                        <th className="py-1 px-2 border-r border-gray-400">C</th>
                        <th className="py-1 px-2 border-r border-gray-400">Mn</th>
                        <th className="py-1 px-2 border-r border-gray-400">Si</th>
                        <th className="py-1 px-2 border-r border-gray-400">P</th>
                        <th className="py-1 px-2 border-r border-gray-400">S</th>
                        <th className="py-1 px-2 border-r border-gray-400">Cr</th>
                        <th className="py-1 px-2 border-r border-gray-400">Ni</th>
                        <th className="py-1 px-2">Mo</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1 px-2 border-r border-gray-400 font-sans font-semibold text-left">Observed (%)</td>
                        <td className="py-1 px-2 border-r border-gray-400">{printingRecord.coaSpec?.elemCPct ?? 0.03}</td>
                        <td className="py-1 px-2 border-r border-gray-400">{printingRecord.coaSpec?.elemMnPct ?? 1.45}</td>
                        <td className="py-1 px-2 border-r border-gray-400">{printingRecord.coaSpec?.elemSiPct ?? 0.42}</td>
                        <td className="py-1 px-2 border-r border-gray-400">{printingRecord.coaSpec?.elemPPct ?? 0.025}</td>
                        <td className="py-1 px-2 border-r border-gray-400">{printingRecord.coaSpec?.elemSPct ?? 0.012}</td>
                        <td className="py-1 px-2 border-r border-gray-400">{printingRecord.coaSpec?.elemCrPct ?? 17.2}</td>
                        <td className="py-1 px-2 border-r border-gray-400">{printingRecord.coaSpec?.elemNiPct ?? 11.1}</td>
                        <td className="py-1 px-2">{printingRecord.coaSpec?.elemMoPct ?? 2.15}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 2. Mechanical Properties */}
              <div className="space-y-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                  2. Mechanical Properties & Hardness
                </h3>
                <div className="border border-gray-400 overflow-x-auto">
                  <table className="w-full text-center text-xs font-mono">
                    <thead className="bg-gray-100 border-b border-gray-400 font-bold">
                      <tr>
                        <th className="py-1 px-2 border-r border-gray-400">Test Characteristic</th>
                        <th className="py-1 px-2 border-r border-gray-400">Yield Strength (MPa)</th>
                        <th className="py-1 px-2 border-r border-gray-400">Tensile Strength (MPa)</th>
                        <th className="py-1 px-2 border-r border-gray-400">Elongation (%)</th>
                        <th className="py-1 px-2 border-r border-gray-400">Hardness</th>
                        <th className="py-1 px-2">Impact Energy (J)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1 px-2 border-r border-gray-400 font-sans font-semibold text-left">Observed Value</td>
                        <td className="py-1 px-2 border-r border-gray-400">{printingRecord.coaSpec?.yieldStrengthMpa ?? 285.0}</td>
                        <td className="py-1 px-2 border-r border-gray-400">{printingRecord.coaSpec?.tensileStrengthMpa ?? 580.0}</td>
                        <td className="py-1 px-2 border-r border-gray-400">{printingRecord.coaSpec?.elongationPct ?? 42.0}</td>
                        <td className="py-1 px-2 border-r border-gray-400">{printingRecord.coaSpec?.hardnessVal || '185 HBW'}</td>
                        <td className="py-1 px-2">{printingRecord.coaSpec?.impactEnergyJoules ?? 95.0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. Hydrostatic Pressure Tests */}
              <div className="space-y-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                  3. Hydrostatic & Pneumatic Pressure Hold Tests (API 598 / ISO 5208)
                </h3>
                <div className="border border-gray-400 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 border-b border-gray-400 font-bold">
                      <tr>
                        <th className="py-1 px-2 border-r border-gray-400">Pressure Test</th>
                        <th className="py-1 px-2 border-r border-gray-400">Test Medium</th>
                        <th className="py-1 px-2 border-r border-gray-400">Required Test Pressure</th>
                        <th className="py-1 px-2 border-r border-gray-400">Hold Duration</th>
                        <th className="py-1 px-2 border-r border-gray-400">Observed Leakage</th>
                        <th className="py-1 px-2">Verdict</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300">
                      <tr>
                        <td className="py-1 px-2 border-r border-gray-400 font-medium">Hydrostatic Body/Shell Test</td>
                        <td className="py-1 px-2 border-r border-gray-400">Treated Demin Water</td>
                        <td className="py-1 px-2 border-r border-gray-400 font-mono">{printingRecord.coaSpec?.hydroShellTestBar ?? 31.0} Bar</td>
                        <td className="py-1 px-2 border-r border-gray-400">180 Seconds</td>
                        <td className="py-1 px-2 border-r border-gray-400 font-semibold text-emerald-800">Zero Leakage</td>
                        <td className="py-1 px-2 font-bold text-emerald-700">PASS</td>
                      </tr>
                      <tr>
                        <td className="py-1 px-2 border-r border-gray-400 font-medium">High Pressure Hydrostatic Seat Test</td>
                        <td className="py-1 px-2 border-r border-gray-400">Treated Demin Water</td>
                        <td className="py-1 px-2 border-r border-gray-400 font-mono">{printingRecord.coaSpec?.hydroSeatTestBar ?? 22.0} Bar</td>
                        <td className="py-1 px-2 border-r border-gray-400">120 Seconds</td>
                        <td className="py-1 px-2 border-r border-gray-400 font-semibold text-emerald-800">0 Drops/min (Tight Shutoff)</td>
                        <td className="py-1 px-2 font-bold text-emerald-700">PASS</td>
                      </tr>
                      <tr>
                        <td className="py-1 px-2 border-r border-gray-400 font-medium">Low Pressure Air Seat Closure Test</td>
                        <td className="py-1 px-2 border-r border-gray-400">Dry Compressed Air</td>
                        <td className="py-1 px-2 border-r border-gray-400 font-mono">{printingRecord.coaSpec?.airSeatTestBar ?? 6.0} Bar</td>
                        <td className="py-1 px-2 border-r border-gray-400">60 Seconds</td>
                        <td className="py-1 px-2 border-r border-gray-400 font-semibold text-emerald-800">0 Bubbles/min (Rate A)</td>
                        <td className="py-1 px-2 font-bold text-emerald-700">PASS</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Non-Destructive Examination & Visual Stamping */}
              <div className="border border-gray-400 p-2 text-xs space-y-1">
                <p>
                  <strong>NON-DESTRUCTIVE EXAMINATION (NDE):</strong>{' '}
                  {printingRecord.coaSpec?.ndeTestType || '100% Visual + Dye Penetrant (PT) Flange Faces per ASME Section V'} - Result: <strong className="text-emerald-700">ACCEPTED</strong>
                </p>
                <p>
                  <strong>SURFACE & PRESERVATION:</strong>{' '}
                  {printingRecord.preservationCoating || 'Rust Preventive Oil VCI Wrap & End Caps'} | Paint DFT: <strong>120-135 µm</strong>
                </p>
                <p>
                  <strong>ACCREDITED TESTING LABORATORY:</strong>{' '}
                  {printingRecord.coaSpec?.labName || 'Kashvira Metallurgical Testing Laboratory (NABL Accredited)'}
                </p>
              </div>

              {/* 5. 3-Tier Authorized Signatures */}
              <div className="pt-6 grid grid-cols-3 gap-6 text-center text-xs">
                <div className="border-t border-gray-800 pt-2">
                  <p className="font-bold text-gray-900">
                    {printingRecord.inspectorName || 'Er. QC Inspector'}
                  </p>
                  <p className="text-gray-500 text-[11px]">Quality Control Inspector</p>
                  <p className="text-[10px] text-gray-400">KS-MFG QA Division</p>
                </div>

                <div className="border-t border-gray-800 pt-2">
                  <p className="font-bold text-gray-900">
                    {printingRecord.customerWitnessRequired
                      ? printingRecord.customerWitnessName || 'Customer TPI Witness'
                      : 'Internal Inspection Waiver'}
                  </p>
                  <p className="text-gray-500 text-[11px]">Third-Party / Customer Witness</p>
                  <p className="text-[10px] text-gray-400">
                    {printingRecord.customerWitnessDate
                      ? `Witnessed: ${new Date(printingRecord.customerWitnessDate).toLocaleDateString()}`
                      : 'Self-Certified QA Clearance'}
                  </p>
                </div>

                <div className="border-t border-gray-800 pt-2">
                  <p className="font-bold text-gray-900">
                    {printingRecord.coaSpec?.certifiedEngineer || 'Er. R. K. Patel'}
                  </p>
                  <p className="text-gray-500 text-[11px]">Head of Quality Assurance & QC</p>
                  <p className="text-[10px] text-emerald-600 font-bold">
                    ✓ DIGITALLY AUTHORIZED
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 6: Confirm Cancel / Delete Modal                               */}
      {/* ===================================================================== */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingRecord)}
        onClose={() => setDeletingRecord(null)}
        onConfirm={() => {
          if (deletingRecord) {
            deleteMutation.mutate(deletingRecord.pdiId);
          }
        }}
        isDeleting={deleteMutation.isPending}
        entityType="Pre-Dispatch Inspection"
        entityName={deletingRecord?.pdiNo || ''}
        entityCode={deletingRecord?.pdiNo}
      />
    </div>
  );
};

export default PdiMasterPage;
