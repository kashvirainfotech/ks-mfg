export type NcrType =
  | 'INWARD_REJECTION'
  | 'IN_PROCESS_DEFECT'
  | 'PDI_FAILURE'
  | 'CUSTOMER_RMA_RETURN'
  | 'INTERNAL_AUDIT';

export type NcrSourceDocType =
  | 'INWARD_QC'
  | 'IN_PROCESS_QC'
  | 'PDI_QC'
  | 'SALES_RETURN'
  | 'WORK_ORDER'
  | 'GENERAL';

export type DefectSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';

export type DefectCategory =
  | 'DIMENSIONAL'
  | 'METALLURGICAL'
  | 'SURFACE_FINISH'
  | 'PRESSURE_LEAK'
  | 'VISUAL_PACKAGING'
  | 'DOCUMENTATION'
  | 'ASSEMBLY_FIT';

export type MrbDisposition =
  | 'PENDING'
  | 'SCRAP'
  | 'REWORK_SAME_OP'
  | 'REWORK_NEW_OP'
  | 'USE_AS_IS_CONCESSION'
  | 'RETURN_TO_VENDOR';

export type CapaStatus =
  | 'NOT_INITIATED'
  | 'INITIATED'
  | 'UNDER_INVESTIGATION'
  | 'IMPLEMENTED'
  | 'VERIFIED_CLOSED';

export type NcrStatus =
  | 'DRAFT'
  | 'UNDER_MRB_REVIEW'
  | 'DISPOSITIONED'
  | 'CAPA_ASSIGNED'
  | 'CLOSED'
  | 'CANCELLED';

export interface CreateNcrDto {
  ncrDate?: string;
  ncrType: NcrType;
  sourceDocType?: NcrSourceDocType;
  sourceDocId?: number;
  sourceDocNo?: string;
  sourceDocDate?: string;
  itemId: number;
  batchNo?: string;
  heatNo?: string;
  defectSeverity: DefectSeverity;
  defectCategory: DefectCategory;
  defectDescription: string;
  inspectedQty: number;
  rejectedQty: number;
  uomId: number;
  containmentAction?: string;
  quarantineLocation?: string;
  redTagNo?: string;
  isCapaRequired?: boolean;
}

export interface UpdateNcrDto {
  ncrDate?: string;
  ncrType?: NcrType;
  sourceDocType?: NcrSourceDocType;
  sourceDocId?: number;
  sourceDocNo?: string;
  sourceDocDate?: string;
  itemId?: number;
  batchNo?: string;
  heatNo?: string;
  defectSeverity?: DefectSeverity;
  defectCategory?: DefectCategory;
  defectDescription?: string;
  inspectedQty?: number;
  rejectedQty?: number;
  uomId?: number;
  containmentAction?: string;
  quarantineLocation?: string;
  redTagNo?: string;
  isCapaRequired?: boolean;
  status?: NcrStatus;
}

export interface CastMrbVoteDto {
  recommendedDisposition: MrbDisposition;
  voteComments?: string;
}

export interface AuthorizeDispositionDto {
  mrbDisposition: MrbDisposition;
  mrbNotes?: string;
  isCapaRequired?: boolean;
}

export interface CreateCapaActionDto {
  targetCompletionDate: string;
  rootCauseMethod?: '5_WHY' | 'FISHBONE_ISHIKAWA' | 'FMEA' | 'FAULT_TREE';
  rootCauseAnalysis: string;
  containmentActionPlan?: string;
  correctiveActionPlan: string;
  preventiveActionPlan: string;
  assignedToId: number;
}

export interface CloseCapaActionDto {
  verificationRemarks: string;
  effectivenessStatus: 'IMPLEMENTED' | 'VERIFIED_EFFECTIVE' | 'REOPENED';
  closeParentNcr?: boolean;
}

export interface NcrFilterDto {
  status?: string;
  ncrType?: string;
  defectSeverity?: string;
  defectCategory?: string;
  mrbDisposition?: string;
  search?: string;
  page?: number;
  limit?: number;
}
