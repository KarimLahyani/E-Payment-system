import { Component, OnInit, OnDestroy } from '@angular/core';
import { RequestInfoService } from '../services/request-info.service';
import { interval, Subscription } from 'rxjs';

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
      terminalBatch?: string; // Champ optionnel pour éviter les erreurs de typage
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
export class ResponseInfoComponent implements OnInit, OnDestroy {
  responseData: ParsedResponse | null = null;
  private refreshSubscription: Subscription | undefined;

  constructor(private requestInfoService: RequestInfoService) {}

  ngOnInit() {
    this.loadResponseData();
    // Rafraîchir les données toutes les 5 secondes
    this.refreshSubscription = interval(5000).subscribe(() => {
      this.loadResponseData();
    });
  }

  ngOnDestroy() {
    this.refreshSubscription?.unsubscribe();
  }

  private loadResponseData() {
    this.requestInfoService.getLastResponseInfo().subscribe({
      next: (data: ParsedResponse) => {
        this.responseData = data;
        console.log('ResponseInfoComponent received data:', this.responseData);
      },
      error: (err) => {
        console.error('Error fetching response data:', err);
        this.responseData = null; // Réinitialiser en cas d'erreur
      }
    });
  }
}