export type GateInwardStatus =
  | 'INWARDED'
  | 'UNLOADED'
  | 'GRN_PENDING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface CreateGateInwardItemDto {
  poItemId?: number;
  itemId: number;
  itemDescription?: string;
  uomId: number;
  challanQty: number;
  packageCount?: number;
  remarks?: string;
}

export interface CreateGateInwardDto {
  gateInwardNo?: string;
  inwardDate: string;
  inwardTime?: string;
  warehouseId: number;
  vendorId: number;
  poId?: number;
  challanNo: string;
  challanDate: string;
  vehicleNo: string;
  transporterName?: string;
  driverName?: string;
  driverPhone?: string;
  ewayBillNo?: string;
  lrNo?: string;
  lrDate?: string;
  grossWeight?: number;
  tareWeight?: number;
  netWeight?: number;
  totalPackages?: number;
  securityRemarks?: string;
  items: CreateGateInwardItemDto[];
}

export interface UpdateGateInwardDto {
  inwardDate?: string;
  inwardTime?: string;
  warehouseId?: number;
  vendorId?: number;
  poId?: number;
  challanNo?: string;
  challanDate?: string;
  vehicleNo?: string;
  transporterName?: string;
  driverName?: string;
  driverPhone?: string;
  ewayBillNo?: string;
  lrNo?: string;
  lrDate?: string;
  grossWeight?: number;
  tareWeight?: number;
  netWeight?: number;
  totalPackages?: number;
  securityRemarks?: string;
  items?: CreateGateInwardItemDto[];
}

export interface UnloadGateInwardDto {
  tareWeight?: number;
  unloadingRemarks?: string;
}

export interface ExitGateInwardDto {
  exitRemarks?: string;
}

export interface CancelGateInwardDto {
  cancelReason: string;
}

export interface GateInwardFilterParams {
  status?: GateInwardStatus;
  warehouseId?: number;
  vendorId?: number;
  poId?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
}
