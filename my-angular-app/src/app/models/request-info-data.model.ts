import { RequestInfo } from './request-info.model';

// Valeurs initiales pour requestData
export const defaultRequestData: RequestInfo = {
  requestType: '',
  refNumber: '',
  appSender: '',
  popId: '',
  workId: '',
  requestId: '',
  autoIncrement: false,
  stan: '' // Nouveau champ ajouté
};

// Liste des types de requêtes
export const requestTypes: string[] = [
  'CardFinancialAdvice',
  'CardPayment',
  'CardPaymentLoyaltyRedemption',
  'CardPreAuthorisation',
  'PaymentRefundLoyaltyRedemptionRefund',
  'CardRepeatLastMessage',
  'Diagnosis',
  'Login',
  'LogoDownload',
  'Logoff',
  'LoyaltyAward',
  'LoyaltyAwardRefund',
  'LoyaltyBalanceQuery',
  'LoyaltyLinkCard',
  'LoyaltyRedemption',
  'LoyaltyRedemptionRefund',
  'PaymentRefund',
  'PreAuth + Fin. Advice',
  'Reconciliation',
  'ReconciliationWithClosure',
  'RepeatLastMessage',
  'SendOfflineTransactions',
  'TicketReprint'
];