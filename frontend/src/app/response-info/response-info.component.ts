import { Component, Input } from '@angular/core';

// Interface pour typer la réponse JSON
interface ParsedResponse {
  cardServiceResponse: {
    attributes: {
      requestType: string;
      overallResult: string;
      requestId: string;
    };
    terminal: {
      terminalId: string;
      stan: string;
      terminalBatch?: string;
    };
    tender: {
      totalAmount: {
        value: string;
      };
    };
  };
}

@Component({
  selector: 'app-response-info',
  templateUrl: './response-info.component.html',
  styleUrls: ['./response-info.component.css']
})
export class ResponseInfoComponent {
  @Input() responseData: ParsedResponse | null = null;
  @Input() expectedRequestId: string | number | null = null;

  get matchingResponse(): ParsedResponse | null {
    if (!this.responseData) {
      return null;
    }

    const responseRequestId = this.responseData.cardServiceResponse?.attributes?.requestId?.toString();
    const expectedRequestId = this.expectedRequestId?.toString();

    return !expectedRequestId || responseRequestId === expectedRequestId ? this.responseData : null;
  }
}

