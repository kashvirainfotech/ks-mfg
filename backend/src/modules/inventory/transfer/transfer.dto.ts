export interface CreateTransferItemDto {
  itemId: number;
  itemCode: string;
  itemName: string;
  uomId: number;
  fromBinId: number;
  toBinId: number;
  batchNo?: string;
  heatNo?: string;
  availableQty?: number;
  transferQty: number;
  unitCost?: number;
  remarks?: string;
}

export interface CreateTransferHeaderDto {
  transferDate?: string;
  transferType: 'BIN_TO_BIN' | 'INTER_WAREHOUSE' | 'INTER_BRANCH_STO';
  fromWarehouseId: number;
  toWarehouseId: number;
  toBranchId?: number;
  transporterName?: string;
  vehicleNo?: string;
  lrNo?: string;
  lrDate?: string;
  ewayBillNo?: string;
  challanNo?: string;
  challanDate?: string;
  remarks?: string;
  items: CreateTransferItemDto[];
}

export interface UpdateTransferHeaderDto {
  transferDate?: string;
  transferType?: 'BIN_TO_BIN' | 'INTER_WAREHOUSE' | 'INTER_BRANCH_STO';
  fromWarehouseId?: number;
  toWarehouseId?: number;
  toBranchId?: number;
  transporterName?: string;
  vehicleNo?: string;
  lrNo?: string;
  lrDate?: string;
  ewayBillNo?: string;
  challanNo?: string;
  challanDate?: string;
  remarks?: string;
  items?: CreateTransferItemDto[];
}

export interface DispatchTransferDto {
  transporterName?: string;
  vehicleNo?: string;
  lrNo?: string;
  lrDate?: string;
  ewayBillNo?: string;
  challanNo?: string;
  challanDate?: string;
  remarks?: string;
}

export interface ReceiveTransferItemDto {
  transferItemId: number;
  receivedQty: number;
  toBinId?: number;
}

export interface ReceiveTransferDto {
  items?: ReceiveTransferItemDto[];
  remarks?: string;
}

export interface CancelTransferDto {
  reason: string;
}

export interface TransferFilterDto {
  status?: string;
  transferType?: string;
  fromWarehouseId?: number;
  toWarehouseId?: number;
  search?: string;
  page?: number;
  limit?: number;
}
