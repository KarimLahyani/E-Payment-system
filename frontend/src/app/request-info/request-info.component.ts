import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RequestInfoService } from '../services/request-info.service';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DisableFieldsService } from '../services/disable-fields.service';
import { RequestTypeService } from '../services/request-type.service';
import { defaultRequestData, requestTypes } from '../models/request-info-data.model';
import { FullRequestData, PosData, AmountData, LoyaltyData, RequestData } from '../models/full-request-data.model';
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

interface DeviceData {
  display: string;
  printer: string;
  cashierTerminal: string;
}

interface DataRequest {
  menuAction: string;
}

const DEFAULT_POS_DATA: PosData = {
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
};

const DEFAULT_AMOUNT_DATA: AmountData = {
  totalAmount: '',
  preAuthAmount: '',
  currency: 'EUR',
  saleItems: [],
  itemDetails: {
    itemId: '',
    buttonLabel: '',
    productCode: '',
    amount: '',
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
  display: '',
  printer: '',
  cashierTerminal: ''
};

const DEFAULT_DATA_REQUEST: DataRequest = {
  menuAction: ''
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

  posData: PosData = { ...DEFAULT_POS_DATA, posTimestamp: new Date().toISOString().slice(0, 19) };
  amountData: AmountData = { ...DEFAULT_AMOUNT_DATA };
  loyaltyData: LoyaltyData = { ...DEFAULT_LOYALTY_DATA };
  deviceData: DeviceData = { ...DEFAULT_DEVICE_DATA };
  dataRequest: DataRequest = { ...DEFAULT_DATA_REQUEST };
  serviceRequestMessage: string = '';

  responseInfo: ResponseInfo | null = null;

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
  ) {}

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
  }

  private subscribeToDeviceMessages() {
    this.deviceSubscription = this.requestInfoService.deviceMessages$.subscribe(
      (messages: DeviceData) => {
        console.log('Nouveau message reçu dans subscribeToDeviceMessages:', messages);
        if (messages.display && messages.display !== 'No message content') {
          if (this.deviceData.display) {
            this.deviceData.display += '\n' + messages.display;
          } else {
            this.deviceData.display = messages.display;
          }
        }
        if (messages.printer && messages.printer !== 'No message content') {
          this.deviceData.printer = messages.printer;
        }
        if (messages.cashierTerminal && messages.cashierTerminal !== 'No message content') {
          console.log('Message CashierTerminal détecté:', messages.cashierTerminal);
          if (this.deviceData.cashierTerminal) {
            this.deviceData.cashierTerminal += '\n' + messages.cashierTerminal;
          } else {
            this.deviceData.cashierTerminal = messages.cashierTerminal;
          }
          // Afficher la pop-up Angular Material pour demander une confirmation
          this.showConfirmationDialog(messages.cashierTerminal);
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
    this.amountData.saleItems = Array.from({ length: 35 }, (_, i) => ({
      itemId: `Item${i + 1}`,
      buttonLabel: `Item${i + 1}`,
      productCode: '',
      amount: '',
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
      createdAt: ''
    }));
    this.requestInfoService.updateData({ amountData: this.amountData });
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
        console.log('Last response info loaded:', this.responseInfo);
        this.cdr.detectChanges();
      },
      (error) => {
        console.error('Error loading last response info:', error);
        this.responseInfo = null;
        this.cdr.detectChanges();
      }
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
        console.log('Configuration updated locally:', this.configData);
      }
    });
  }

  sendRequest() {
    this.loyaltyData.bonusCard = false;
    console.log('bonusCard réinitialisé à false avant envoi via Send:', this.loyaltyData.bonusCard);
    this.requestInfoService.updateData({ loyaltyData: this.loyaltyData });

    const fullRequestData: FullRequestData = {
      requestData: this.requestData,
      posData: this.posData,
      amountData: this.amountData,
      loyaltyData: this.loyaltyData,
      configData: this.configData
    };

    console.log("Données envoyées :", fullRequestData);
    this.requestInfoService.sendRequestInfo(fullRequestData).subscribe(
      (response: any) => {
        console.log("Réponse du serveur :", response);
        this.serviceRequestMessage = response.serviceRequest || 'No Service Request available';

        if (response.requestId) {
          this.requestData.requestId = response.requestId.toString();
          this.requestInfoService.updateData({ requestData: this.requestData });
          console.log('Updated requestData.requestId to:', this.requestData.requestId);
        }

        alert("Données envoyées avec succès !");
        this.cdr.detectChanges();
      },
      (error: any) => {
        console.error("Erreur lors de l'envoi :", error);
        this.serviceRequestMessage = 'Erreur lors de l\'envoi des données';

        alert("Échec de l'envoi des données.");
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
            alert('Aucune réponse LoyaltyAward précédente trouvée. Veuillez d\'abord envoyer une requête LoyaltyAward et vérifier la réponse.');
          }
          this.requestInfoService.updateData({ requestData: this.requestData });
          this.cdr.detectChanges();
        },
        (error) => {
          console.error('Error fetching last LoyaltyAward stan:', error);
          this.requestData.stan = '';
          this.requestInfoService.updateData({ requestData: this.requestData });
          alert('Erreur lors de la récupération du dernier STAN pour LoyaltyAward.');
          this.cdr.detectChanges();
        }
      );
    } else {
      this.requestData.stan = '';
    }
  }

  showSubSection(section: string) {
    this.activeSection = section;
    this.router.navigate([`/request-info/${section}`]);
  }

  clearFields() {
    this.resetToInitialState();
    this.serviceRequestMessage = '';
    this.deviceData.display = '';
    this.deviceData.printer = '';
    this.deviceData.cashierTerminal = '';
    console.log("Clear button clicked, all fields cleared");

    alert("Champs effacés avec succès !");
  }

  resetDataRequest() {
    this.dataRequest = { ...DEFAULT_DATA_REQUEST };
    console.log("Data Request reset");
  }

  sendDataRequest() {
    console.log("Data Request envoyé :", this.dataRequest);
  }

  quitDataRequest() {
    console.log("Quit Data Request");
    this.resetDataRequest();
  }

  isBonusButtonEnabled(): boolean {
    return this.requestData.requestType === 'LoyaltyAward' || this.requestData.requestType === 'LoyaltyAwardRefund';
  }

  onBonusClick() {
    if (this.isBonusButtonEnabled()) {
      this.loyaltyData.bonusCard = true;
      console.log('bonusCard défini à true pour Bonus:', this.loyaltyData.bonusCard);
      this.requestInfoService.updateData({
        loyaltyData: this.loyaltyData,
        requestData: this.requestData
      });

      const fullRequestData: FullRequestData = {
        requestData: this.requestData,
        posData: this.posData,
        amountData: this.amountData,
        loyaltyData: this.loyaltyData,
        configData: this.configData
      };
      console.log("Données envoyées avec BonusCard=true :", fullRequestData);
      this.requestInfoService.sendRequestInfo(fullRequestData).subscribe(
        (response: any) => {
          console.log("Réponse du serveur (Bonus) :", response);
          this.serviceRequestMessage = response.serviceRequest || 'No Service Request available';

          if (response.requestId) {
            this.requestData.requestId = response.requestId.toString();
            this.requestInfoService.updateData({ requestData: this.requestData });
            console.log('Updated requestData.requestId to:', this.requestData.requestId);
            this.requestInfoService.updateData({ refreshRequestId: response.requestId });
          }

          alert("Données avec Bonus Card envoyées avec succès !");
          this.cdr.detectChanges();
        },
        (error: any) => {
          console.error("Erreur lors de l'envoi (Bonus) :", error);
          this.serviceRequestMessage = 'Erreur lors de l\'envoi des données avec Bonus Card';

          alert("Échec de l'envoi des données avec Bonus Card.");
          this.cdr.detectChanges();
        }
      );
    } else {
      console.log('Bonus button clicked, but requestType is not LoyaltyAward or LoyaltyAwardRefund:', this.requestData.requestType);
      alert('Le bouton Bonus est uniquement disponible pour LoyaltyAward ou LoyaltyAwardRefund.');
    }
  }

  private subscribeToDataChanges() {
    this.subscription = this.requestInfoService.dataChange$.subscribe(
      (data: FullRequestData | boolean | { refreshRequestId?: string }) => {
        if (data === true) {
          console.log('Mise à jour globale détectée, rafraîchissement de RequestInfoComponent');
          this.loadLastRequestInfo();
          this.loadLastResponseInfo();
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
          if ('amountData' in data && JSON.stringify(this.amountData) !== JSON.stringify((data as FullRequestData).amountData)) {
            this.amountData = { ...this.amountData, ...(data as FullRequestData).amountData };
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

  private resetToInitialState() {
    this.requestData = {
      requestType: '',
      refNumber: '',
      appSender: '',
      popId: '',
      workId: '',
      requestId: '',
      autoIncrement: false,
      stan: '',
    };
    this.posData = {
      posTimestamp: new Date().toISOString().slice(0, 19),
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
      choicePayKind: false,
    };
    this.amountData = {
      totalAmount: '',
      preAuthAmount: '',
      currency: 'EUR',
      saleItems: Array.from({ length: 35 }, (_, i) => ({
        itemId: '',
        buttonLabel: `Item${i + 1}`,
        productCode: '',
        amount: '',
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
      })),
      itemDetails: {
        itemId: '',
        buttonLabel: '',
        productCode: '',
        amount: '',
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
      display: '',
      printer: '',
      cashierTerminal: ''
    };
    this.dataRequest = {
      menuAction: ''
    };
    this.serviceRequestMessage = '';
    this.requestInfoService.updateData({
      requestData: this.requestData,
      posData: this.posData,
      amountData: this.amountData,
      loyaltyData: this.loyaltyData,
      configData: this.configData
    });
  }
}