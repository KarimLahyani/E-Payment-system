export const defaultInitialData = {
  requestData: {
    requestType: '',
    refNumber: '',
    appSender: '',
    popId: '',
    workstationId: '',
    requestId: ''
  },
  posData: {
    posTimestamp: '',
    languageCode: '',
    cardEntryMode: '',
    shiftNumber: '',
    terminalBatch: '',
    statusRequest: '',
    additionalInfo: '',
    outdoorPosition: '',
    clerkId: '',
    clerkLevel: '',
    serviceLevel: '',
    posName: '',
    global: false,
    split: false,
    longFormat: false,
    unattended: false,
    waitingCard: false,
    choicePayKind: false
  },
  amountData: {
    totalAmount: '',
    preAuthAmount: '',
    currency: 'TND'
  },
  basketData: {
    totalAmount: '0.00',
    preAuthAmount: '0.00',
    currency: 'TND',
    saleItems: []
  },
  loyaltyData: {
    loyaltyFlag: false,
    cardEntryMode: '',
    loyaltyCard: '',
    loyaltyPan: '',
    cardEntryModeNew: '',
    loyaltyCardNew: '',
    loyaltyPanNew: '',
    loyaltyTimestamp: '',
    loyaltyAmount: '',
    loyaltyOriginalAmount: '',
    loyaltyApprovalCode: '',
    loyaltyAcquirerId: '',
    loyaltyAcquirerBatch: ''
  },
  responseData: {
    requestType: '',
    terminalId: '',
    amount: '',
    overallResult: '',
    stan: '',
    requestId: ''
  }
};

// Typage explicite (facultatif mais recommandé)
export interface InitialData {
  requestData: {
    requestType: string;
    refNumber: string;
    appSender: string;
    popId: string;
    workstationId: string;
    requestId: string;
    stan: string; // Nouveau champ ajouté
  };
  posData: {
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
  };
  amountData: {
    totalAmount: string;
    preAuthAmount: string;
    currency: string;
    saleItems: Array<{
      itemId: string;
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
    }>;
  };
  loyaltyData: {
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
  };
  responseData: {
    requestType: string;
    terminalId: string;
    amount: string;
    overallResult: string;
    stan: string;
    requestId: string;
  };
}
