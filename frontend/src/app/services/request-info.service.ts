import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { FullRequestData, BasketData, SaleItem, PosData, LoyaltyData, RequestData } from '../models/full-request-data.model';

interface RequestInfoResponse {
  message: string;
  requestId: number;
  serviceRequest: string;
}

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

interface DeviceMessages {
  display: string;
  printer: string;
  cashierTerminal: string;
}

interface DeviceRequest {
  outDeviceTarget: 'CashierDisplay' | 'Printer' | 'CashierTerminal';
  requestId?: string;
  textLines: string[];
}

@Injectable({
  providedIn: 'root',
})
export class RequestInfoService {
  private apiUrl = 'http://localhost:3000';
  private dataChangeSubject = new BehaviorSubject<FullRequestData | boolean | { refreshRequestId?: string }>(false);
  dataChange$ = this.dataChangeSubject.asObservable();
  private deviceMessagesSubject = new BehaviorSubject<DeviceMessages>({ display: '', printer: '', cashierTerminal: '' });
  deviceMessages$ = this.deviceMessagesSubject.asObservable();
  private currentData: FullRequestData | null = null;
  private isProcessingCashierResponse = false;

  constructor(private http: HttpClient) {
  }

  getProducts(): Observable<SaleItem[]> {
    return this.http.get<SaleItem[]>(`${this.apiUrl}/products`);
  }

  getBasketDataForRequest(requestId: string): Observable<BasketData | null> {
    return this.http.get<BasketData>(`${this.apiUrl}/basket/by-request/${requestId}`).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération de basketData pour requestId:', requestId, error);
        return of(null);
      })
    );
  }

  saveBasketDataForRequest(requestId: string, basketData: BasketData): Observable<any> {
    return of({ status: 'success' });
  }

  getLastResponseInfo(): Observable<ParsedResponse> {
    return this.http.get<ParsedResponse>(`${this.apiUrl}/last-response-info`).pipe(
      catchError(error => {
        console.error('Erreur lors de la récupération de last-response-info:', error);
        return throwError(error);
      })
    );
  }

  getBasketData(): Observable<BasketData> {
    return this.http.get<BasketData>(`${this.apiUrl}/basket`);
  }

  saveBasketData(basketData: BasketData): Observable<BasketData> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<BasketData>(`${this.apiUrl}/basket`, basketData, { headers });
  }

  getSaleItems(basketDataId: number): Observable<SaleItem[]> {
    return this.http.get<SaleItem[]>(`${this.apiUrl}/basket/${basketDataId}/sale-items`);
  }

  saveSaleItem(saleItem: SaleItem, basketDataId: number): Observable<SaleItem> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<SaleItem>(`${this.apiUrl}/basket/${basketDataId}/sale-items`, saleItem, { headers });
  }

  getLastSaleItems(): Observable<SaleItem[]> {
    return this.http.get<SaleItem[]>(`${this.apiUrl}/last-sale-items`).pipe(
      tap(data => console.log('Données reçues de /last-sale-items:', JSON.stringify(data, null, 2))),
      catchError(error => {
        console.error('Erreur dans getLastSaleItems:', error);
        return throwError(error);
      })
    );
  }

  sendRequestInfo(data: FullRequestData): Observable<RequestInfoResponse> {
    console.log('Data sent to backend:', JSON.stringify(data, null, 2));
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<RequestInfoResponse>(`${this.apiUrl}/request-info`, data, { headers }).pipe(
      tap(response => {
        console.log('Réponse du serveur dans sendRequestInfo:', response);
      }),
      catchError(error => {
        console.error('Erreur dans sendRequestInfo:', error);
        return throwError(error);
      })
    );
  }

  abortTransaction(requestId?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/terminal/abort`, { requestId });
  }

  getLastPosData(): Observable<PosData> {
    return this.http.get<PosData>(`${this.apiUrl}/last-pos-data`);
  }

  getLastBasketData(): Observable<BasketData> {
    return this.http.get<BasketData>(`${this.apiUrl}/latest-basket-data`);
  }

  getLastLoyaltyData(): Observable<LoyaltyData> {
    console.log('Appel de getLastLoyaltyData');
    return this.http.get<LoyaltyData>(`${this.apiUrl}/last-loyalty-data`).pipe(
      tap(data => console.log('Données reçues de /last-loyalty-data:', JSON.stringify(data, null, 2))),
      catchError(error => {
        console.error('Erreur dans getLastLoyaltyData:', error);
        return throwError(error);
      })
    );
  }

  getResponseInfoById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/response-info/${id}?t=${new Date().getTime()}`);
  }

  getNextRequestId(): Observable<{ requestId: number }> {
    return this.http.get<{ requestId: number }>(`${this.apiUrl}/last-request-info?t=${new Date().getTime()}`).pipe(
      tap(data => console.log('Next request id fetched:', data)),
      catchError(error => {
        console.error('Erreur lors de la récupération de getNextRequestId:', error);
        return throwError(error);
      })
    );
  }

  getLastRequestInfo(): Observable<RequestData> {
    return this.http.get<RequestData>(`${this.apiUrl}/last-request-info?t=${new Date().getTime()}`).pipe(
      tap(data => console.log('Last request info fetched:', data)),
      catchError(error => {
        console.error('Erreur lors de la récupération de last-request-info:', error);
        return throwError(error);
      })
    );
  }

  getLastRequest(): Observable<FullRequestData> {
    return this.http.get<FullRequestData>(`${this.apiUrl}/last-request`);
  }

  getTotalAmount(requestId: string): Observable<{ totalAmount: string }> {
    return this.http.get<{ totalAmount: string }>(`${this.apiUrl}/total-amount/${requestId}`).pipe(
      tap(data => console.log('Données reçues de /total-amount:', JSON.stringify(data, null, 2))),
      catchError(error => {
        console.error('Erreur dans getTotalAmount:', error);
        return throwError(error);
      })
    );
  }

  getLastLoyaltyAwardStan(): Observable<{ stan: string }> {
    return this.http.get<{ stan: string }>(`${this.apiUrl}/last-loyalty-award-stan`).pipe(
      tap(data => console.log('STAN reçu de /last-loyalty-award-stan:', data)),
      catchError(error => {
        console.error('Erreur lors de la récupération du dernier STAN pour LoyaltyAward:', error);
        return throwError(error);
      })
    );
  }

  updateData(data: Partial<FullRequestData> & { refreshRequestId?: string }) {
    console.log('updateData appelé avec:', JSON.stringify(data, null, 2));
    if (data.loyaltyData) {
      console.log('Valeur de bonusCard dans updateData:', data.loyaltyData.bonusCard);
    }

    if (data.refreshRequestId) {
      this.dataChangeSubject.next({ refreshRequestId: data.refreshRequestId });
      return;
    }

    const fullData: FullRequestData = {
      requestData: data.requestData || this.currentData?.requestData || {
        requestType: '',
        popId: '',
        refNumber: '',
        workstationId: '',
        appSender: '',
        requestId: '',
        stan: '',
      },
      posData: data.posData || this.currentData?.posData || {
        posTimestamp: (() => {
          const now = new Date();
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        })(),
        languageCode: '',
        cardEntryMode: '',
        shiftNumber: '',
        clerkId: '',
        posName: '',
        split: false,
        unattended: false
      },
      basketData: data.basketData || this.currentData?.basketData || {
        totalAmount: '',
        preAuthAmount: '',
        currency: 'TND',
        saleItems: (this.currentData?.basketData?.saleItems || []).map(item => ({
          ...item,
          productName: item.productName || '',
          productCode: item.productCode || '',
          itemAmount: item.itemAmount || '',
          quantity: item.quantity || '',
          taxCode: item.taxCode || '',
          addProdCode: item.addProdCode || '',
          reverseSale: item.reverseSale || '',
          unitPrice: item.unitPrice || '',
          unitMeasure: item.unitMeasure || '',
          saleChannel: item.saleChannel || '',
          rebateLabel: item.rebateLabel || '',
          addProdInfo: item.addProdInfo || '',
          isSelected: item.isSelected !== undefined ? item.isSelected : false,
          createdAt: item.createdAt || '',
        })),
        itemDetails: {
          productName: '',
          productCode: '',
          itemAmount: '',
          quantity: '',
          taxCode: '',
          addProdCode: '',
          reverseSale: '',
          unitPrice: '',
          unitMeasure: '',
          saleChannel: '',
          rebateLabel: '',
          addProdInfo: '',
          isSelected: false,
          createdAt: '',
        },
        discount: '0.00'
      },
      loyaltyData: data.loyaltyData || this.currentData?.loyaltyData || {
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
        loyaltyAcquirerBatch: '',
        bonusCard: false,
      },
      configData: data.configData || this.currentData?.configData || {
        clientIp: '127.0.0.1',
        serverIp: '',
        epsPort: 11111,
        posProxyPort: 22222,
        opiMode: true
      }
    };

    if (data.requestData && 'id' in data.requestData && typeof data.requestData.id === 'string') {
      fullData.requestData.requestId = data.requestData.id;
    } else if (data.requestData && 'id' in data.requestData) {
      fullData.requestData.requestId = String(data.requestData.id);
    }

    let hasChanged = false;
    if (!this.currentData) {
      hasChanged = true;
      console.log('Aucune donnée actuelle, mise à jour forcée');
    } else {
      const requestChanged = data.requestData ? JSON.stringify(this.currentData.requestData) !== JSON.stringify(data.requestData) : false;
      const posChanged = data.posData ? JSON.stringify(this.currentData.posData) !== JSON.stringify(data.posData) : false;
      const basketChanged = data.basketData ? JSON.stringify(this.currentData.basketData) !== JSON.stringify(data.basketData) : false;
      const loyaltyChanged = data.loyaltyData ? JSON.stringify(this.currentData.loyaltyData) !== JSON.stringify(data.loyaltyData) : false;
      const configChanged = data.configData ? JSON.stringify(this.currentData.configData) !== JSON.stringify(data.configData) : false;
      hasChanged = requestChanged || posChanged || basketChanged || loyaltyChanged || configChanged;
      console.log('Comparaison des données:', {
        requestChanged,
        posChanged,
        basketChanged,
        loyaltyChanged,
        configChanged,
        hasChanged
      });
    }

    if (hasChanged) {
      this.currentData = fullData;
      console.log('Émission de nouvelles données via dataChange$:', JSON.stringify(fullData, null, 2));
      this.dataChangeSubject.next(fullData);
    } else {
      console.log('Aucun changement détecté, pas d\'émission via dataChange$');
    }
  }

  clearAllData() {
    this.currentData = null;
    this.dataChangeSubject.next(true);
    console.log('Clearing all data with true');
  }

  fetchDeviceMessages(): void {
    this.http.get<{ display: string, printer: string, cashierTerminal: string }>(`${this.apiUrl}/device-messages`).pipe(
      tap(messages => {
        console.log('Messages reçus pour display, printer et cashierTerminal:', messages);
        this.deviceMessagesSubject.next({
          ...this.deviceMessagesSubject.value,
          display: messages.display,
          printer: messages.printer,
          cashierTerminal: messages.cashierTerminal,
        });
      }),
      catchError(error => {
        console.error('Erreur lors de la récupération des messages DeviceRequest:', error);
        this.deviceMessagesSubject.next({
          ...this.deviceMessagesSubject.value,
          display: '',
          printer: '',
          cashierTerminal: '',
        });
        return throwError(error);
      })
    ).subscribe();
  }

  sendCashierTerminalResponse(confirmation: string): Observable<{ message: string }> {
    if (this.isProcessingCashierResponse) {
      console.warn('Une réponse CashierTerminal est déjà en cours de traitement, annulation.');
      return throwError(() => new Error('Response already in progress'));
    }

    this.isProcessingCashierResponse = true;
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<{ message: string }>(`${this.apiUrl}/cashier-terminal-response`, { confirmation }, { headers }).pipe(
      tap(response => {
        console.log('Réponse CashierTerminal envoyée avec succès:', response);
        this.deviceMessagesSubject.next({
          ...this.deviceMessagesSubject.value,
          cashierTerminal: '',
        });
        this.notifyGlobalUpdate();
      }),
      catchError(error => {
        console.error('Erreur lors de l\'envoi de la réponse CashierTerminal:', error);
        this.deviceMessagesSubject.next({
          ...this.deviceMessagesSubject.value,
          cashierTerminal: `Erreur: ${error.message || 'Veuillez réessayer'}`,
        });
        this.notifyGlobalUpdate();
        return throwError(() => new Error(error.message || 'Failed to send CashierTerminal response'));
      }),
      finalize(() => {
        console.log('Finalisation de sendCashierTerminalResponse, réinitialisation de isProcessingCashierResponse');
        this.isProcessingCashierResponse = false;
      })
    );
  }

  notifyGlobalUpdate() {
    this.dataChangeSubject.next(true);
    console.log('Notification globale émise pour rafraîchir tous les composants');
  }

  resetTerminalSimulator(): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post<{ message: string }>(`${this.apiUrl}/api/terminal/reset`, {}, { headers }).pipe(
      tap(response => console.log('Terminal simulator reset signal sent', response)),
      catchError(error => {
        console.error('Error resetting terminal simulator:', error);
        return of(null);
      })
    );
  }

  getHistory(page: number = 1, limit: string | number = 50, filters: any = {}): Observable<any> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
      
    if (filters.startDate) params = params.set('startDate', filters.startDate);
    if (filters.endDate) params = params.set('endDate', filters.endDate);
    if (filters.status) params = params.set('status', filters.status);

    return this.http.get<any>(`${this.apiUrl}/api/history`, { params });
  }

  getTransactionDetails(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/history/${id}`);
  }

  updateLocalDeviceDisplay(message: string) {
    this.deviceMessagesSubject.next({
      ...this.deviceMessagesSubject.value,
      display: message
    });
  }
}
