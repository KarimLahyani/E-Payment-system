export interface RequestData {
  requestType: string;
  popId: string;
  refNumber: string;
  workId: string;
  appSender: string;
  requestId: string;
  autoIncrement: boolean;
  requestTimestamp?: string;
  stan: string;
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
  terminalBatch: string;
  statusRequest: string;
  additionalInfo: string;
  outdoorPosition: string;
  clerkId: string;
  clerkLevel: string;
  serviceLevel: string;
  posName: string;
  global: boolean;
  split: boolean;
  longFormat: boolean;
  unattended: boolean;
  waitingCard: boolean;
  choicePayKind: boolean;
}

export interface SaleItem {
  itemId: string;
  buttonLabel: string;
  productCode: string;
  amount: string;
  quantity: string;
  taxCode: string;
  addProdCode: string;
  reverseSale: string;
  unitPrice: string;
  unitMeasure: string;
  saleChannel: string;
  rebateLabel: string;
  addProdInfo: string;
  isSelected: boolean;
  createdAt?: string;
}

export interface AmountData {
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
  amountData: AmountData;
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