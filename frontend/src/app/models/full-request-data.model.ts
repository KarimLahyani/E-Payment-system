export interface RequestData {
  requestType: string;
  popId: string;
  refNumber: string;
  workstationId: string;
  appSender: string;
  requestId: string;
  requestTimestamp?: string;
  stan: string;
  reprintSearchType?: 'stan' | 'requestId';
  originalRequestId?: string;
  clientIp?: string; // Ajouté
  serverIp?: string; // Ajouté
  epsPort?: number;  // Ajouté
  posProxyPort?: number; // Ajouté
  opiMode?: boolean; // Ajouté
}

export interface PosData {
  posTimestamp: string;
  languageCode: string;
  cardEntryMode: string;
  shiftNumber: string;
  clerkId: string;
  posName: string;
  split: boolean;
  unattended: boolean;
}

export interface SaleItem {
  productName: string;
  productCode: string;
  itemAmount: string;
  quantity: string;
  taxCode: string;
  addProdCode: string;
  reverseSale: string;
  unitPrice: string;
  unitMeasure: string;
  saleChannel: string;
  rebateLabel: string;
  addProdInfo: string;
  pumpId?: string; // Ajouté pour le numéro de pompe
  isSelected: boolean; // Retained for frontend UI toggling
  createdAt?: string;
}

export interface BasketData {
  totalAmount: string;
  preAuthAmount: string;
  currency: string;
  saleItems: SaleItem[];
  itemDetails: SaleItem;
  discount?: string; // Champ ajouté pour stocker la remise
}

export interface LoyaltyData {
  loyaltyFlag: boolean;
  cardEntryMode: string;
  loyaltyCard: string;
  loyaltyPan: string;
  cardEntryModeNew: string;
  loyaltyCardNew: string;
  loyaltyPanNew: string;
  loyaltyTimestamp: string;
  loyaltyAmount: string;
  loyaltyOriginalAmount: string;
  loyaltyApprovalCode: string;
  loyaltyAcquirerId: string;
  loyaltyAcquirerBatch: string;
  bonusCard: boolean;
}
export interface FullRequestData {
  requestData: RequestData;
  posData: PosData;
  basketData: BasketData;
  loyaltyData: LoyaltyData;
  configData?: ConfigurationData; // Ajouté pour inclure les configurations
}

export interface ConfigurationData {
  clientIp: string;
  serverIp: string;
  epsPort: number;
  posProxyPort: number;
  opiMode: boolean;
}
