export type WarehouseType =
  | 'RAW_MATERIAL'
  | 'WIP_SHOPFLOOR'
  | 'FINISHED_GOODS'
  | 'QUARANTINE_QC'
  | 'SCRAP_REJECTION'
  | 'TOOL_CRIB'
  | 'BONDED_EXCISE';

export interface CreateWarehouseDto {
  warehouseCode: string;
  warehouseName: string;
  warehouseType: WarehouseType;
  targetCompId: number;
  targetBranchId: number;
  inchargeEmployeeId?: number | null;
  allowNegativeStock?: boolean;
  isQcHoldStore?: boolean;
  isShopfloorWip?: boolean;
  storageTempMinC?: number | null;
  storageTempMaxC?: number | null;
  addressLocation?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdateWarehouseDto extends Partial<CreateWarehouseDto> {}

export type StorageBinType =
  | 'PALLET_RACK'
  | 'CANTILEVER_BAR'
  | 'FLOOR_BULK'
  | 'SMALL_PARTS_TOTE'
  | 'QUARANTINE_CAGE'
  | 'LINESIDE_KANBAN';

export interface CreateStorageBinDto {
  warehouseId: number;
  binCode: string;
  binName: string;
  zoneCode: string;
  rackCode: string;
  shelfLevel: string;
  binPosition: string;
  binType: StorageBinType;
  maxWeightKg: number;
  maxVolumeCbm?: number | null;
  allowMixedItems?: boolean;
  allowMixedBatches?: boolean;
  isPickFace?: boolean;
  isReceivingStaging?: boolean;
  isBlockedForPutaway?: boolean;
  isActive?: boolean;
}

export interface UpdateStorageBinDto extends Partial<CreateStorageBinDto> {}

export interface BulkGenerateStorageBinsDto {
  warehouseId: number;
  zoneCode: string;
  binPrefix: string;
  rackPrefix?: string;
  rackStart: number;
  rackEnd: number;
  shelfStart: number;
  shelfEnd: number;
  positionStart: number;
  positionEnd: number;
  binType: StorageBinType;
  maxWeightKg: number;
  maxVolumeCbm?: number | null;
  allowMixedItems?: boolean;
  allowMixedBatches?: boolean;
}
