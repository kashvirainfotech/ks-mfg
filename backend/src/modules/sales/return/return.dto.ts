export interface CreateSalesReturnItemDto {
  invoiceItemId?: number;
  itemSequence?: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  description?: string;
  hsnSacCode?: string;
  uomId: number;
  invoicedQty?: number;
  returnedQty: number;
  acceptedQty?: number;
  rejectedScrapQty?: number;
  unitPrice: number;
  discountPercent?: number;
  gstRate?: number;
  targetWarehouseId?: number;
  targetBinId?: number;
  batchNo?: string;
  heatNo?: string;
  defectType?: string;
  qcVerdict?: 'PENDING' | 'ACCEPT_FOR_RESTOCK' | 'ACCEPT_FOR_REWORK' | 'REJECT_SCRAP';
  actionTaken?: string;
  remarks?: string;
}

export interface CreateSalesReturnDto {
  returnType?: 'COMMERCIAL_RETURN' | 'QUALITY_REJECTION' | 'TRANSIT_DAMAGE' | 'WRONG_SHIPMENT' | 'WARRANTY_REPLACEMENT';
  returnDate: string;
  invoiceId: number;
  invoiceNo: string;
  invoiceDate: string;
  customerId: number;
  customerName: string;
  customerGstin?: string;
  customerPan?: string;
  billingAddress: string;
  billingCity?: string;
  billingState?: string;
  billingPincode?: string;
  billingStateCode?: string;
  placeOfSupply?: string;
  posStateCode?: string;
  rmaReferenceNo?: string;
  rmaReferenceDate?: string;
  gateEntryNo?: string;
  gateEntryDate?: string;
  vehicleNo?: string;
  transporterName?: string;
  lrNo?: string;
  lrDate?: string;
  returnReason: string;
  remarks?: string;
  items: CreateSalesReturnItemDto[];
}

export interface UpdateSalesReturnDto extends Partial<CreateSalesReturnDto> {}

export interface InspectSalesReturnItemDto {
  returnItemId: number;
  acceptedQty: number;
  rejectedScrapQty: number;
  qcVerdict: 'ACCEPT_FOR_RESTOCK' | 'ACCEPT_FOR_REWORK' | 'REJECT_SCRAP';
  targetWarehouseId?: number;
  targetBinId?: number;
  defectType?: string;
  actionTaken?: string;
  remarks?: string;
}

export interface InspectSalesReturnDto {
  qcRemarks?: string;
  items: InspectSalesReturnItemDto[];
}

export interface PostCreditNoteDto {
  remarks?: string;
  adjustArBalance?: boolean;
}

export interface RestockSalesReturnDto {
  remarks?: string;
}

export interface GenerateCreditNoteIrnDto {
  remarks?: string;
}

export interface SalesReturnFilterParams {
  search?: string;
  status?: string;
  qcStatus?: string;
  restockStatus?: string;
  creditNoteStatus?: string;
  customerId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}
