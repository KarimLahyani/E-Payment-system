export interface RequestInfo {
    requestType: string;
    refNumber: string;
    appSender: string;
    popId: string;
    workId: string;
    requestId: string;
    autoIncrement: boolean;
    stan: string; // Nouveau champ ajouté
  }
  