import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RequestInfoService } from '../services/request-info.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DisableFieldsService } from '../services/disable-fields.service';
import { RequestTypeService } from '../services/request-type.service';
import { defaultRequestData, requestTypes } from '../models/request-info-data.model';
import { FullRequestData, PosData, BasketData, LoyaltyData, RequestData } from '../models/full-request-data.model';
import { MatDialog } from '@angular/material/dialog';
import { ConfigurationModalComponent } from '../configuration-modal/configuration-modal.component';
import { ConfigurationService, ConfigurationData } from '../services/configuration.service';
import { HttpClient } from '@angular/common/http';
import { CashierTerminalDialogComponent } from '../cashier-terminal-dialog/cashier-terminal-dialog.component';

interface ResponseInfo {
  cardServiceResponse: {
    attributes: {
      requestType: string;
      overallResult: string;
      errorCondition?: string;
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
    saleItem?: any[];
  };
}

interface DeviceData {
  display: string;
  printer: string;
  cashierTerminal: string;
}

const DEFAULT_POS_DATA: PosData = {
  posTimestamp: '',
  languageCode: '',
  cardEntryMode: '',
  shiftNumber: '',
  clerkId: '',
  posName: '',
  split: false,
  unattended: false
};

const DEFAULT_BASKET_DATA: BasketData = {
  totalAmount: '',
  preAuthAmount: '',
  currency: 'TND',
  saleItems: [],
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
    isSelected: false
  },
  discount: '0.00'
};

const DEFAULT_LOYALTY_DATA: LoyaltyData = {
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
  bonusCard: false
};

const DEFAULT_DEVICE_DATA: DeviceData = {
  display: 'Welcome to Cashier Simulator',
  printer: '',
  cashierTerminal: ''
};

@Component({
  selector: 'app-request-info',
  templateUrl: './request-info.component.html',
  styleUrls: ['./request-info.component.css']
})
export class RequestInfoComponent implements OnInit, OnDestroy {
  requestData: RequestData = { ...defaultRequestData, stan: '' };
  requestTypes: string[] = requestTypes;
  requestInfoDisabledFields: { [key: string]: boolean } = {};
  subscription: Subscription | undefined;
  deviceSubscription: Subscription | undefined;
  activeSection: string = 'pos-data';
  showSplitModal: boolean = false;
  splitAmountInput: number = 0;
  paidAmount: number = 0;

  get remainingBalance(): number {
    return Math.max(0, parseFloat(this.basketData.totalAmount || '0') - this.paidAmount);
  }

  posData: PosData = { ...DEFAULT_POS_DATA, posTimestamp: new Date().toISOString().slice(0, 19) };
  basketData: BasketData = { ...DEFAULT_BASKET_DATA };
  loyaltyData: LoyaltyData = { ...DEFAULT_LOYALTY_DATA };
  deviceData: DeviceData = { ...DEFAULT_DEVICE_DATA };
  serviceRequestMessage: string = '';

  responseInfo: ResponseInfo | null = null;
  isLoading: boolean = false;
  pollingInterval: any;
  private activeResponseRequestId: string | null = null;
  responseRequestId: string | null = null;
  currentRequestId: string = '1';
  private lastShownDialogMessage: string = '';

  configData: ConfigurationData = {
    clientIp: '127.0.0.1',
    serverIp: '',
    epsPort: 11111,
    posProxyPort: 22222,
    opiMode: true
  };

  menuActionOptions: string[] = ['Option 1', 'Option 2', 'Option 3'];

  constructor(
    private router: Router,
    private requestInfoService: RequestInfoService,
    private requestTypeService: RequestTypeService,
    private disableFieldsService: DisableFieldsService,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog,
    private configurationService: ConfigurationService,
    private http: HttpClient
  ) { }

  ngOnInit() {
    this.loadLastRequestInfo();
    this.subscribeToDataChanges();
    this.updateFieldStates();
    this.loadConfiguration();
    this.initializeSaleItems();
    this.loadLastResponseInfo();
    this.subscribeToDeviceMessages();
    this.requestInfoService.fetchDeviceMessages();
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
    this.deviceSubscription?.unsubscribe();
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
  }

  private subscribeToDeviceMessages() {
    this.deviceSubscription = this.requestInfoService.deviceMessages$.subscribe(
      (messages: DeviceData) => {
        console.log('Nouveau message reçu dans subscribeToDeviceMessages:', messages);
        if (messages.display && messages.display !== 'No message content') {
          this.deviceData.display = messages.display;
        }
        if (messages.printer && messages.printer !== 'No message content') {
          this.deviceData.printer = messages.printer;
        }
        if (messages.cashierTerminal && messages.cashierTerminal !== 'No message content') {
          console.log('Message CashierTerminal détecté:', messages.cashierTerminal);
          this.deviceData.cashierTerminal = messages.cashierTerminal;
          // Afficher la pop-up Angular Material pour demander une confirmation uniquement si c'est un nouveau message
          if (messages.cashierTerminal !== this.lastShownDialogMessage) {
            this.lastShownDialogMessage = messages.cashierTerminal;
            this.showConfirmationDialog(messages.cashierTerminal);
          }
        }
        this.cdr.detectChanges();
      },
      (error) => {
        console.error('Erreur dans subscribeToDeviceMessages:', error);
      }
    );
  }

  private showConfirmationDialog(message: string) {
    if (message) {
      console.log('Ouverture de la pop-up avec message:', message);
      // Ouvrir la pop-up CashierTerminalDialogComponent
      const dialogRef = this.dialog.open(CashierTerminalDialogComponent, {
        width: '400px',
        data: { message }
      });

      dialogRef.afterClosed().subscribe(result => {
        console.log('Pop-up fermée avec résultat:', result);
        // Gérer la réponse : 'YES', 'NO', ou undefined (si fermé sans action)
        const confirmation = result === 'YES' ? 'YES' : 'NO'; // Par défaut NO si fermé
        this.requestInfoService.sendCashierTerminalResponse(confirmation).subscribe(
          () => console.log(`Confirmation ${confirmation} envoyée avec succès`),
          error => console.error(`Erreur lors de l'envoi de la confirmation ${confirmation}:`, error)
        );
      });
    }
  }

  private initializeSaleItems() {
    this.requestInfoService.getProducts().subscribe(
      (products) => {
        this.basketData.saleItems = products.map(product => {
          const existing = this.basketData.saleItems?.find(i => i.productCode === product.productCode);
          return {
            productName: product.productName,
            productCode: product.productCode,
            itemAmount: existing?.itemAmount || '',
            quantity: existing?.quantity || '',
            taxCode: product.taxCode,
            addProdCode: existing?.addProdCode || '',
            reverseSale: existing?.reverseSale || '',
            unitPrice: product.unitPrice,
            unitMeasure: product.unitMeasure,
            saleChannel: existing?.saleChannel || '',
            rebateLabel: existing?.rebateLabel || '',
            addProdInfo: existing?.addProdInfo || '',
            isSelected: existing?.isSelected || false,
            createdAt: existing?.createdAt || ''
          };
        });
        this.requestInfoService.updateData({ basketData: this.basketData });
        console.log('Successfully initialized sale items from products catalog', this.basketData.saleItems);
      },
      (error) => {
        console.error('Failed to initialize sale items, falling back to empty list', error);
        this.basketData.saleItems = [];
        this.requestInfoService.updateData({ basketData: this.basketData });
      }
    );
  }

  loadConfiguration() {
    this.configurationService.getConfiguration().subscribe(
      (data: ConfigurationData) => {
        this.configData = data;
        console.log('Configuration loaded:', this.configData);
      },
      (error) => {
        console.error('Error loading configuration:', error);
      }
    );
  }

  loadLastRequestInfo() {
    this.requestInfoService.getLastRequestInfo().subscribe(
      (data: RequestData) => {
        this.requestData = { ...this.requestData, ...data };
        if (this.requestData.requestType !== 'LoyaltyAwardRefund') {
          this.requestData.stan = '';
        }
        if (data.clientIp && data.serverIp && data.epsPort && data.posProxyPort !== undefined && data.opiMode !== undefined) {
          this.configData = {
            clientIp: data.clientIp,
            serverIp: data.serverIp,
            epsPort: data.epsPort,
            posProxyPort: data.posProxyPort,
            opiMode: data.opiMode
          };
        } else {
          this.configurationService.getConfiguration().subscribe(
            (config: ConfigurationData) => {
              this.configData = config;
              this.requestInfoService.updateData({ requestData: this.requestData, configData: this.configData });
              console.log('Last request info and config loaded:', { requestData: this.requestData, configData: this.configData });
            },
            (error) => console.error('Error loading configuration:', error)
          );
        }
        this.requestInfoService.updateData({ requestData: this.requestData, configData: this.configData });
        console.log('Last request info loaded:', this.requestData);
        this.checkPendingRequest();
        this.loadCurrentRequestId();
      },
      (error) => {
        console.error('Error loading last request info:', error);
        this.resetToInitialState();
      }
    );
  }

  loadLastResponseInfo() {
    this.requestInfoService.getLastResponseInfo().subscribe(
      (data) => {
        this.responseInfo = data;
        this.responseRequestId = data?.cardServiceResponse?.attributes?.requestId?.toString() || null;
        console.log('Last response info loaded:', this.responseInfo);
        this.cdr.detectChanges();
        this.checkPendingRequest();
      },
      (error) => {
        console.error('Error loading last response info:', error);
        this.responseInfo = null;
        this.responseRequestId = null;
        this.cdr.detectChanges();
        this.checkPendingRequest();
      }
    );
  }

  checkPendingRequest() {
    if (this.isLoading || !this.responseRequestId) return;

    const expectedId = parseInt(this.responseRequestId, 10);
    const responseId = parseInt(this.responseInfo?.cardServiceResponse?.attributes?.requestId || '', 10);

    if (!isNaN(expectedId) && (isNaN(responseId) || expectedId > responseId)) {
      console.log(`Response ${this.responseRequestId} is not loaded yet. Resuming polling...`);
      this.startPollingForResponse(this.responseRequestId);
    }
  }

  loadCurrentRequestId() {
    if (this.isLoading) {
      return;
    }

    this.requestInfoService.getNextRequestId().subscribe(
      (response) => {
        if (response?.requestId) {
          this.currentRequestId = response.requestId.toString();
          this.requestData.requestId = this.currentRequestId;
          this.cdr.detectChanges();
        }
      },
      (error) => console.error('Error loading next request id:', error)
    );
  }

  updateFieldStates() {
    const disabledFields = this.disableFieldsService.disableFieldsByRequestType(this.requestData.requestType);
    this.requestInfoDisabledFields = disabledFields.requestInfo;
  }

  openConfigurationModal(): void {
    const dialogRef = this.dialog.open(ConfigurationModalComponent, {
      width: '400px',
      data: this.configData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.configData = result;
        this.requestInfoService.updateData({ configData: this.configData });
        console.log('Configuration data updated:', this.configData);
      }
    });
  }

  sendRequest() {
    if (this.posData.split) {
      const total = parseFloat(this.basketData.totalAmount) || 0;
      const remaining = Math.max(0, total - this.paidAmount);
      this.splitAmountInput = parseFloat(remaining.toFixed(2));
      this.showSplitModal = true;
    } else {
      this.executeSendRequest();
    }
  }

  applySplitPercentage(percent: number) {
    const total = parseFloat(this.basketData.totalAmount) || 0;
    const remaining = Math.max(0, total - this.paidAmount);
    // Suggest a percentage of the *original* total, capped at remaining
    const suggestion = total * (percent / 100);
    this.splitAmountInput = parseFloat(Math.min(suggestion, remaining).toFixed(2));
  }

  cancelSplit() {
    this.showSplitModal = false;
  }

  confirmSplitAndSend() {
    this.showSplitModal = false;
    this.executeSendRequest(this.splitAmountInput.toFixed(2));
  }

  executeSendRequest(amountToSend?: string) {
    this.loyaltyData.bonusCard = false;
    console.log('bonusCard réinitialisé à false avant envoi via Send:', this.loyaltyData.bonusCard);
    this.requestInfoService.updateData({ loyaltyData: this.loyaltyData });
    this.prepareForNewResponse();

    // Create a deep copy of basketData to avoid modifying the UI's basket
    const requestBasketData = JSON.parse(JSON.stringify(this.basketData));
    // Keep a reference to the real total for split receipts logic
    requestBasketData.originalTotalAmount = this.basketData.totalAmount;
    if (amountToSend) {
      requestBasketData.totalAmount = amountToSend;
    }

    const fullRequestData: FullRequestData = {
      requestData: this.requestData,
      posData: this.posData,
      basketData: requestBasketData,
      loyaltyData: this.loyaltyData,
      configData: this.configData
    };

    console.log("Données envoyées :", fullRequestData);
    this.requestInfoService.sendRequestInfo(fullRequestData).subscribe(
      (response: any) => {
        console.log("Réponse du serveur :", response);
        this.serviceRequestMessage = response.serviceRequest || 'No Service Request available';

        if (response.requestId) {
          const sentRequestId = response.requestId.toString();
          this.requestData.requestId = sentRequestId;
          this.currentRequestId = sentRequestId;
          this.responseRequestId = sentRequestId;
          this.requestInfoService.updateData({ requestData: this.requestData });
          console.log('Updated requestData.requestId to:', this.requestData.requestId);
          this.startPollingForResponse(sentRequestId, amountToSend);
        } else {
          this.isLoading = false;
          this.activeResponseRequestId = null;
          // alert("Données envoyées avec succès, mais aucun ID de requête retourné.");
        }
        this.cdr.detectChanges();
      },
      (error: any) => {
        console.error("Erreur lors de l'envoi :", error);
        this.serviceRequestMessage = 'Erreur lors de l\'envoi des données';

        this.isLoading = false;
        this.activeResponseRequestId = null;
        // alert("Échec de l'envoi des données.");
        this.cdr.detectChanges();
      }
    );
  }

  onRequestTypeChange() {
    this.updateFieldStates();
    this.requestTypeService.changeRequestType(this.requestData.requestType);
    if (this.requestData.requestType === 'LoyaltyAwardRefund') {
      this.requestInfoService.getLastLoyaltyAwardStan().subscribe(
        (response: { stan: string }) => {
          if (response && response.stan) {
            this.requestData.stan = response.stan;
            console.log('Set stan for LoyaltyAwardRefund from last LoyaltyAward response:', this.requestData.stan);
          } else {
            this.requestData.stan = '';
            console.warn('No previous LoyaltyAward response found to set stan.');
          }
          this.requestInfoService.updateData({ requestData: this.requestData });
          this.cdr.detectChanges();
        },
        (error) => {
          console.error('Error fetching last LoyaltyAward stan:', error);
          this.requestData.stan = '';
          this.requestInfoService.updateData({ requestData: this.requestData });
          // alert('Erreur lors de la récupération du dernier STAN pour LoyaltyAward.');
          this.cdr.detectChanges();
        }
      );
    } else {
      this.requestData.stan = '';
      this.requestInfoService.updateData({ requestData: this.requestData });
    }
  }

  showSubSection(section: string) {
    this.activeSection = section;
    this.router.navigate([`/request-info/${section}`]);
  }

  abortTransaction() {
    this.requestInfoService.abortTransaction(this.activeResponseRequestId || undefined).subscribe({
      next: () => {
        console.log("Transaction aborted successfully");
        if (this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
        }
        this.isLoading = false;
        this.activeResponseRequestId = null;
      },
      error: (err) => console.error("Error aborting transaction:", err)
    });
  }

  clearFields() {
    this.resetToInitialState();
    this.serviceRequestMessage = '';
    this.lastShownDialogMessage = '';
    console.log("Clear button clicked, all fields cleared");
    this.requestInfoService.resetTerminalSimulator().subscribe();
  }

  isBonusButtonEnabled(): boolean {
    return this.requestData.requestType === 'LoyaltyAward' || this.requestData.requestType === 'LoyaltyAwardRefund';
  }

  onBonusClick() {
    if (this.isBonusButtonEnabled()) {
      this.loyaltyData.bonusCard = true;
      console.log('bonusCard défini à true pour Bonus:', this.loyaltyData.bonusCard);
      this.prepareForNewResponse();
      this.requestInfoService.updateData({
        loyaltyData: this.loyaltyData,
        requestData: this.requestData
      });

      const fullRequestData: FullRequestData = {
        requestData: this.requestData,
        posData: this.posData,
        basketData: this.basketData,
        loyaltyData: this.loyaltyData,
        configData: this.configData
      };
      console.log("Données envoyées avec BonusCard=true :", fullRequestData);
      this.requestInfoService.sendRequestInfo(fullRequestData).subscribe(
        (response: any) => {
          console.log("Réponse du serveur (Bonus) :", response);
          this.serviceRequestMessage = response.serviceRequest || 'No Service Request available';

          if (response.requestId) {
            const sentRequestId = response.requestId.toString();
            this.requestData.requestId = sentRequestId;
            this.currentRequestId = sentRequestId;
            this.responseRequestId = sentRequestId;
            this.requestInfoService.updateData({ requestData: this.requestData });
            console.log('Updated requestData.requestId to:', this.requestData.requestId);
            this.requestInfoService.updateData({ refreshRequestId: response.requestId });
            this.startPollingForResponse(sentRequestId);
          } else {
            this.isLoading = false;
            this.activeResponseRequestId = null;
            // alert("Données avec Bonus Card envoyées avec succès !");
          }
          this.cdr.detectChanges();
        },
        (error: any) => {
          console.error("Erreur lors de l'envoi (Bonus) :", error);
          this.serviceRequestMessage = 'Erreur lors de l\'envoi des données avec Bonus Card';

          this.isLoading = false;
          this.activeResponseRequestId = null;
          // alert("Échec de l'envoi des données avec Bonus Card.");
          this.cdr.detectChanges();
        }
      );
    } else {
      console.log('Bonus button clicked, but requestType is not LoyaltyAward or LoyaltyAwardRefund:', this.requestData.requestType);
      // alert('Le bouton Bonus est uniquement disponible pour LoyaltyAward ou LoyaltyAwardRefund.');
    }
  }

  private subscribeToDataChanges() {
    this.subscription = this.requestInfoService.dataChange$.subscribe(
      (data: FullRequestData | boolean | { refreshRequestId?: string }) => {
        if (data === true) {
          console.log('Mise à jour globale détectée, rafraîchissement de RequestInfoComponent');
          this.loadLastRequestInfo();
          if (!this.isLoading) {
            this.loadLastResponseInfo();
          }
          this.requestInfoService.fetchDeviceMessages();
          this.cdr.detectChanges();
        } else if (typeof data === 'object' && data !== null) {
          if ('refreshRequestId' in data) {
            return;
          }
          let hasChanged = false;
          if ('requestData' in data && JSON.stringify(this.requestData) !== JSON.stringify((data as FullRequestData).requestData)) {
            this.requestData = { ...this.requestData, ...(data as FullRequestData).requestData };
            hasChanged = true;
          }
          if ('posData' in data && JSON.stringify(this.posData) !== JSON.stringify((data as FullRequestData).posData)) {
            this.posData = { ...this.posData, ...(data as FullRequestData).posData };
            hasChanged = true;
          }
          if ('basketData' in data && JSON.stringify(this.basketData) !== JSON.stringify((data as FullRequestData).basketData)) {
            this.basketData = { ...this.basketData, ...(data as FullRequestData).basketData };
            hasChanged = true;
          }
          if ('loyaltyData' in data && JSON.stringify(this.loyaltyData) !== JSON.stringify((data as FullRequestData).loyaltyData)) {
            this.loyaltyData = { ...this.loyaltyData, ...(data as FullRequestData).loyaltyData };
            hasChanged = true;
          }
          if ('configData' in data && JSON.stringify(this.configData) !== JSON.stringify((data as FullRequestData).configData)) {
            this.configData = { ...this.configData, ...(data as FullRequestData).configData };
            hasChanged = true;
          }
          if (hasChanged) {
            this.cdr.detectChanges();
          }
        }
      }
    );
  }

  private prepareForNewResponse() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.activeResponseRequestId = null;
    this.responseInfo = null;
    this.isLoading = true;
    this.deviceData.display = '';
    this.deviceData.printer = '';
    this.deviceData.cashierTerminal = '';
    this.cdr.detectChanges();
  }

  private resetToInitialState() {
    this.paidAmount = 0;
    this.requestData = {
      requestType: '',
      refNumber: '',
      appSender: 'AP4900',
      popId: '01',
      workstationId: 'POS01',
      requestId: '',
      stan: '',
    };
    this.posData = {
      posTimestamp: new Date().toISOString().slice(0, 19),
      languageCode: '',
      cardEntryMode: '',
      shiftNumber: '',
      clerkId: '',
      posName: '',
      split: false,
      unattended: false
    };
    this.basketData = {
      totalAmount: '',
      preAuthAmount: '',
      currency: 'TND',
      saleItems: [],
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
        isSelected: false
      },
      discount: '0.00'
    };
    this.loyaltyData = {
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
      bonusCard: false
    };
    this.deviceData = {
      display: 'Welcome to Cashier Simulator',
      printer: '',
      cashierTerminal: ''
    };
    this.activeResponseRequestId = null;
    this.responseRequestId = null;
    this.currentRequestId = '';
    this.responseInfo = null;
    this.isLoading = false;
    this.loadCurrentRequestId();
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.requestInfoService.updateData({ basketData: this.basketData, loyaltyData: this.loyaltyData, posData: this.posData });
    this.initializeSaleItems();
  }

  isBasketSectionVisible(): boolean {
    const basketDataRequiredTypes = [
      'CardPayment', 'CardPreAuthorisation', 'PreAuth+Fin.Advice',
      'CardPaymentLoyaltyRedemption', 'LoyaltyAward'
    ];
    return basketDataRequiredTypes.includes(this.requestData.requestType);
  }

  isLoyaltySectionVisible(): boolean {
    const loyaltyDataRequiredTypes = [
      'LoyaltyAward', 'LoyaltyAwardRefund', 'LoyaltyRedemption',
      'LoyaltyRedemptionRefund', 'LoyaltyBalanceQuery', 'LoyaltyLinkCard',
      'CardPaymentLoyaltyRedemption'
    ];
    return loyaltyDataRequiredTypes.includes(this.requestData.requestType);
  }

  startPollingForResponse(requestId: string, amountToSend?: string) {
    this.isLoading = true;
    this.activeResponseRequestId = requestId;
    this.responseRequestId = requestId;
    this.responseInfo = null;
    this.deviceData.display = '';
    this.deviceData.printer = '';
    this.deviceData.cashierTerminal = '';

    // Check immediately, then every second for up to 120 seconds.
    const maxWaitTime = 120000;
    const startTime = Date.now();

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    const finishPolling = (data: ResponseInfo) => {
      this.responseInfo = data;
      console.log(`Response info loaded for ID ${requestId}:`, this.responseInfo);

      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }

      if (data && data.cardServiceResponse?.attributes?.overallResult === 'Success') {
        const isLoyaltyAward = data.cardServiceResponse.attributes.requestType === 'LoyaltyAward';
        
        if (isLoyaltyAward) {
          const tenderAmount = data.cardServiceResponse.tender?.totalAmount;
          const saleItems = data.cardServiceResponse.saleItem || [];
          
          if (tenderAmount) {
            this.basketData.totalAmount = typeof tenderAmount === 'object' ? tenderAmount.value : tenderAmount;
          }
          
          if (saleItems && saleItems.length > 0) {
            saleItems.forEach((incomingItem: any) => {
              const matchedItem = this.basketData.saleItems.find(bItem => bItem.productCode === incomingItem.productCode);
              if (matchedItem) {
                matchedItem.itemAmount = incomingItem.amount || matchedItem.itemAmount;
                matchedItem.rebateLabel = incomingItem.rebateLabel || matchedItem.rebateLabel;
              }
            });
          }
          
          this.requestInfoService.updateData({ basketData: this.basketData });
          // alert("Discounts applied! Please select CardPayment and click Send to complete the transaction.");
        }
        
        if (this.posData.split && amountToSend) {
          this.paidAmount += parseFloat(amountToSend);
          if (this.remainingBalance <= 0) {
            this.posData.split = false;
            this.paidAmount = 0;
            this.requestInfoService.updateData({ posData: this.posData });
          }
        }
      }

      // Fetch device messages one final time to ensure we catch any delayed Printer/Display messages
      // that arrived exactly as the transaction completed.
      setTimeout(() => {
        this.requestInfoService.fetchDeviceMessages();
      }, 1000);

      this.isLoading = false;
      this.activeResponseRequestId = null;
      
      // FIX FOR ID: update the form's Request ID to the NEXT ID immediately after response finishes
      const nextId = (Number(requestId) + 1).toString();
      this.currentRequestId = nextId;
      this.requestData = { ...this.requestData, requestId: nextId };
      this.requestInfoService.updateData({ requestData: this.requestData });
      
      this.cdr.detectChanges();
      console.log("Response fully received!");
    };

    const pollForResponse = () => {
      this.requestInfoService.getResponseInfoById(requestId).subscribe(
        (data) => {
          const responseRequestId = data?.cardServiceResponse?.attributes?.requestId?.toString();
          if (this.activeResponseRequestId !== requestId || responseRequestId !== requestId?.toString()) {
            console.warn(`Ignoring stale response. Expected ${requestId}, received ${responseRequestId || 'empty'}.`);
            return;
          }

          finishPolling(data);
        },
        () => {
          // If 404, it means it's not ready yet, keep polling.
          console.log(`Still waiting for response ID ${requestId}...`);
        }
      );

      this.requestInfoService.fetchDeviceMessages();

      if (Date.now() - startTime > maxWaitTime) {
        if (this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
        }
        this.isLoading = false;
        this.activeResponseRequestId = null;
        this.cdr.detectChanges();
        // alert("Timeout en attendant la réponse de l'EPS (120s).");
      }
    };

    this.pollingInterval = setInterval(pollForResponse, 1000);
    pollForResponse();
  }
}