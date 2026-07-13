export interface ParsedResponse {
    cardServiceResponse: {
      attributes: {
        requestType: string;
        overallResult: string;
        requestId: string;
      };
      terminal: {
        terminalId: string;
        stan: string;
        terminalBatch: string; // Nouveau champ
      };
      tender: {
        totalAmount: {
          value: string;
        };
      };
    };
  }