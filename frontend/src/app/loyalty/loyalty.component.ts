import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { RequestInfoService } from '../services/request-info.service';
import { DisableFieldsService } from '../services/disable-fields.service';
import { RequestTypeService } from '../services/request-type.service';
import { Subscription } from 'rxjs';
import { FullRequestData, LoyaltyData } from '../models/full-request-data.model';

@Component({
  selector: 'app-loyalty',
  templateUrl: './loyalty.component.html',
  styleUrls: ['./loyalty.component.css']
})
export class LoyaltyComponent implements OnInit, OnDestroy {
  loyaltyData: LoyaltyData = {
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

  entryModes = [
    'Keyboard', 'Manual', 'Mobile', 'POS', 'RadioFrequency', 'Scanner', 'SmartCard', 'Swipe'
  ];

  loyaltyDisabledFields: { [key: string]: boolean } = {};

  private requestTypeSubscription: Subscription | undefined;
  private dataSubscription: Subscription | undefined;

  constructor(
    private requestInfoService: RequestInfoService,
    private disableFieldsService: DisableFieldsService,
    private requestTypeService: RequestTypeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadLastLoyaltyData();
    this.subscribeToRequestType();
    this.subscribeToDataChanges();
  }

  ngOnDestroy() {
    this.requestTypeSubscription?.unsubscribe();
    this.dataSubscription?.unsubscribe();
  }

  loadLastLoyaltyData() {
    this.requestInfoService.getLastLoyaltyData().subscribe(
      (data: LoyaltyData) => {
        this.loyaltyData = { ...this.loyaltyData, ...data };
        console.log('Dernières données Loyalty Data chargées:', this.loyaltyData);
        console.log('Valeur de bonusCard après chargement:', this.loyaltyData.bonusCard);
        this.updateLoyaltyData();
        this.cdr.detectChanges();
      },
      (error) => {
        console.error('Erreur lors du chargement des dernières données Loyalty Data:', error);
      }
    );
  }

  saveLoyalty() {
    this.updateLoyaltyData();
    console.log("Loyalty data saved:", this.loyaltyData);
    alert("Loyalty data has been saved!");
  }

  sendLoyalty() {
    this.updateLoyaltyData();
    console.log("Loyalty data sent:", this.loyaltyData);
    alert("Loyalty data has been sent!");
  }

  updateLoyaltyData() {
    console.log('Mise à jour de loyaltyData, bonusCard=', this.loyaltyData.bonusCard);
    this.requestInfoService.updateData({ loyaltyData: this.loyaltyData });
  }

  onFieldChange() {
    this.updateLoyaltyData();
  }

  private subscribeToRequestType() {
    this.requestTypeSubscription = this.requestTypeService.currentRequestType.subscribe(
      requestType => {
        console.log("Request type changed to:", requestType);
        this.updateFieldStates(requestType);
      }
    );
  }

  private updateFieldStates(requestType: string) {
    const disabledFields = this.disableFieldsService.disableFieldsByRequestType(requestType);
    this.loyaltyDisabledFields = disabledFields.loyalty;
  }

  private subscribeToDataChanges() {
    this.dataSubscription = this.requestInfoService.dataChange$.subscribe(
      (data: FullRequestData | boolean | { refreshRequestId?: string }) => {
        if (data === true) {
          console.log('Mise à jour globale détectée, rafraîchissement de LoyaltyComponent');
          this.loadLastLoyaltyData();
          this.cdr.detectChanges();
        } else if (typeof data === 'object' && data !== null) {
          if ('refreshRequestId' in data) {
            return;
          }
          if ('loyaltyData' in data) {
            this.loyaltyData = { ...this.loyaltyData, ...(data as FullRequestData).loyaltyData };
            console.log('LoyaltyComponent synchronisé avec:', this.loyaltyData);
            console.log('Valeur de bonusCard après synchronisation:', this.loyaltyData.bonusCard);
            this.cdr.detectChanges();
          }
        }
      }
    );
  }

  private resetLoyaltyData() {
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
    console.log('LoyaltyComponent fully reset, loyaltyData:', this.loyaltyData);
    console.log('Valeur de bonusCard après réinitialisation:', this.loyaltyData.bonusCard);
    this.updateLoyaltyData();
  }
}
