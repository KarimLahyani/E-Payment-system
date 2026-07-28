import { Injectable } from '@angular/core';
import { defaultDisabledFields, DisabledFields } from '../models/disabled-fields.model'; // Ajustez le chemin selon votre structure

@Injectable({
  providedIn: 'root'
})
export class DisableFieldsService {
  disableFieldsByRequestType(requestType: string): DisabledFields {
    
    const disabledFields: DisabledFields = JSON.parse(JSON.stringify(defaultDisabledFields));

    switch(requestType) {
      case 'CardFinancialAdvice':
      case 'CardPayment':
      case 'CardPaymentLoyaltyRedemption':
      case 'CardPreAuthorisation':
      case 'CardRepeatLastMessage':
      case 'LoyaltyAward':
      case 'LoyaltyAwardRefund':
      case 'LoyaltyBalanceQuery':
      case 'LoyaltyLinkCard':
      case 'LoyaltyRedemption':
      case 'LoyaltyRedemptionRefund':
      case 'PaymentRefund':
      case 'PreAuth+Fin.Advice':
        disabledFields.posData.statusRequest = true;
        disabledFields.posData.posName = true;
        disabledFields.posData.global = true;
        disabledFields.posData.longFormat = true;
        break;

      case 'TicketReprint':
        disabledFields.posData.statusRequest = true;
        disabledFields.posData.posName = true;
        disabledFields.posData.global = true;
        disabledFields.posData.longFormat = true;
        disabledFields.posData.split = true;
        disabledFields.posData.unattended = true;
        break;

      case 'Diagnosis':
      case 'Login':
      case 'LogoDownload':
      case 'Logoff':
        disabledFields.requestInfo.refNumber = true;
        disabledFields.responseInfo.overallResult = true;
        disabledFields.responseInfo.terminalId = true;
        disabledFields.responseInfo.stan = true;
        disabledFields.responseInfo.amount = true;
        disabledFields.posData.cardEntryMode = true;
        disabledFields.posData.track2 = true;
        disabledFields.posData.serviceLevel = true;
        disabledFields.posData.split = true;
        disabledFields.posData.waitingCard = true;
        disabledFields.posData.choicePayKind = true;

        // Désactive tous les champs de amount
        disabledFields.amount.totalAmount = true;
        disabledFields.amount.preAuthAmount = true;
        disabledFields.amount.currency = true;
        disabledFields.amount.saleItems = true;
        disabledFields.amount.productCode = true;
        disabledFields.amount.amount = true;
        disabledFields.amount.quantity = true;
        disabledFields.amount.taxCode = true;
        disabledFields.amount.addProdCode = true;
        disabledFields.amount.reverseSale = true;
        disabledFields.amount.unitPrice = true;
        disabledFields.amount.unitMeasure = true;
        disabledFields.amount.saleChannel = true;
        disabledFields.amount.rebateLabel = true;
        disabledFields.amount.addProdInfo = true;

        // Désactive tous les champs de loyalty
        disabledFields.loyalty.loyaltyFlag = true;
        disabledFields.loyalty.cardEntryMode = true;
        disabledFields.loyalty.loyaltyCard = true;
        disabledFields.loyalty.loyaltyPan = true;
        disabledFields.loyalty.cardEntryModeNew = true;
        disabledFields.loyalty.loyaltyCardNew = true;
        disabledFields.loyalty.loyaltyPanNew = true;
        disabledFields.loyalty.loyaltyTimestamp = true;
        disabledFields.loyalty.loyaltyAmount = true;
        disabledFields.loyalty.loyaltyOriginalAmount = true;
        disabledFields.loyalty.loyaltyApprovalCode = true;
        disabledFields.loyalty.loyaltyAcquirerId = true;
        disabledFields.loyalty.loyaltyAcquirerBatch = true;
        break;

      case 'Reconciliation':
      case 'ReconciliationWithClosure':
      case 'RepeatLastMessage':
      case 'SendOfflineTransactions':
        disabledFields.requestInfo.refNumber = true;
        disabledFields.responseInfo.terminalId = true;
        disabledFields.responseInfo.stan = true;
        disabledFields.responseInfo.amount = true;
        disabledFields.posData.cardEntryMode = true;
        disabledFields.posData.track2 = true;
        disabledFields.posData.serviceLevel = true;
        disabledFields.posData.split = true;
        disabledFields.posData.waitingCard = true;
        disabledFields.posData.choicePayKind = true;

        // Désactive tous les champs de amount
        disabledFields.amount.totalAmount = true;
        disabledFields.amount.preAuthAmount = true;
        disabledFields.amount.currency = true;
        disabledFields.amount.saleItems = true;
        disabledFields.amount.productCode = true;
        disabledFields.amount.amount = true;
        disabledFields.amount.quantity = true;
        disabledFields.amount.taxCode = true;
        disabledFields.amount.addProdCode = true;
        disabledFields.amount.reverseSale = true;
        disabledFields.amount.unitPrice = true;
        disabledFields.amount.unitMeasure = true;
        disabledFields.amount.saleChannel = true;
        disabledFields.amount.rebateLabel = true;
        disabledFields.amount.addProdInfo = true;

        // Désactive tous les champs de loyalty
        disabledFields.loyalty.loyaltyFlag = true;
        disabledFields.loyalty.cardEntryMode = true;
        disabledFields.loyalty.loyaltyCard = true;
        disabledFields.loyalty.loyaltyPan = true;
        disabledFields.loyalty.cardEntryModeNew = true;
        disabledFields.loyalty.loyaltyCardNew = true;
        disabledFields.loyalty.loyaltyPanNew = true;
        disabledFields.loyalty.loyaltyTimestamp = true;
        disabledFields.loyalty.loyaltyAmount = true;
        disabledFields.loyalty.loyaltyOriginalAmount = true;
        disabledFields.loyalty.loyaltyApprovalCode = true;
        disabledFields.loyalty.loyaltyAcquirerId = true;
        disabledFields.loyalty.loyaltyAcquirerBatch = true;
        break;
    }

    return disabledFields;
  }
}
