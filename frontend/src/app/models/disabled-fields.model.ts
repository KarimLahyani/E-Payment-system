export const defaultDisabledFields = {
  requestInfo: {
    refNumber: false
  },
  responseInfo: {
    overallResult: false,
    terminalId: false,
    stan: false,
    amount: false
  },
  posData: {
    statusRequest: false,
    posName: false,
    global: false,
    longFormat: false,
    cardEntryMode: false,
    track2: false,
    serviceLevel: false,
    split: false,
    waitingCard: false,
    choicePayKind: false,
    unattended: false
  },
  amount: {
    totalAmount: false,
    preAuthAmount: false,
    currency: false,
    saleItems: false,
    productName: false,
    productCode: false,
    amount: false,
    quantity: false,
    taxCode: false,
    addProdCode: false,
    reverseSale: false,
    unitPrice: false,
    unitMeasure: false,
    saleChannel: false,
    rebateLabel: false,
    addProdInfo: false
  },
  loyalty: {
    loyaltyFlag: false,
    cardEntryMode: false,
    loyaltyCard: false,
    loyaltyPan: false,
    cardEntryModeNew: false,
    loyaltyCardNew: false,
    loyaltyPanNew: false,
    loyaltyTimestamp: false,
    loyaltyAmount: false,
    loyaltyOriginalAmount: false,
    loyaltyApprovalCode: false,
    loyaltyAcquirerId: false,
    loyaltyAcquirerBatch: false
  }
};

// Optionnel : Ajouter un typage explicite
export interface DisabledFields {
  requestInfo: {
    refNumber: boolean;
  };
  responseInfo: {
    overallResult: boolean;
    terminalId: boolean;
    stan: boolean;
    amount: boolean;
  };
  posData: {
    statusRequest: boolean;
    posName: boolean;
    global: boolean;
    longFormat: boolean;
    cardEntryMode: boolean;
    track2: boolean;
    serviceLevel: boolean;
    split: boolean;
    waitingCard: boolean;
    choicePayKind: boolean;
    unattended: boolean;
  };
  amount: {
    totalAmount: boolean;
    preAuthAmount: boolean;
    currency: boolean;
    saleItems: boolean;
    productCode: boolean;
    amount: boolean;
    quantity: boolean;
    taxCode: boolean;
    addProdCode: boolean;
    reverseSale: boolean;
    unitPrice: boolean;
    unitMeasure: boolean;
    saleChannel: boolean;
    rebateLabel: boolean;
    addProdInfo: boolean;
  };
  loyalty: {
    loyaltyFlag: boolean;
    cardEntryMode: boolean;
    loyaltyCard: boolean;
    loyaltyPan: boolean;
    cardEntryModeNew: boolean;
    loyaltyCardNew: boolean;
    loyaltyPanNew: boolean;
    loyaltyTimestamp: boolean;
    loyaltyAmount: boolean;
    loyaltyOriginalAmount: boolean;
    loyaltyApprovalCode: boolean;
    loyaltyAcquirerId: boolean;
    loyaltyAcquirerBatch: boolean;
  };
}
