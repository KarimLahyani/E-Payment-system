import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RequestInfoService } from '../services/request-info.service';
import { DisableFieldsService } from '../services/disable-fields.service';
import { RequestTypeService } from '../services/request-type.service';
import { Subscription } from 'rxjs';
import { FullRequestData, PosData } from '../models/full-request-data.model';

@Component({
  selector: 'app-pos-data',
  templateUrl: './pos-data.component.html',
  styleUrls: ['./pos-data.component.css']
})
export class PosDataComponent implements OnInit, OnDestroy {
  posData: PosData = {
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

  posDataDisabledFields: { [key: string]: boolean } = {};
  activeSubSection: string = '';
  private requestTypeSubscription: Subscription | undefined;
  private dataSubscription: Subscription | undefined;
  private timestampInterval: any;

  constructor(
    private requestInfoService: RequestInfoService,
    private disableFieldsService: DisableFieldsService,
    private requestTypeService: RequestTypeService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadLastPosData();
    this.subscribeToRequestType();
    this.subscribeToDataChanges();
  }

  ngOnDestroy() {
    this.requestTypeSubscription?.unsubscribe();
    this.dataSubscription?.unsubscribe();
    if (this.timestampInterval) {
      clearInterval(this.timestampInterval);
    }
  }

  loadLastPosData() {
    this.requestInfoService.getLastPosData().subscribe(
      (data: PosData) => {
        this.posData = { ...this.posData, ...data };
        console.log('Dernières données POS Data chargées:', this.posData);
        this.updatePOSData();
        this.cdr.detectChanges();
      },
      (error) => {
        console.error('Erreur lors du chargement des dernières données POS Data:', error);
        this.startTimestampUpdate();
      }
    );
  }

  showSection(section: string) {
    this.activeSubSection = section;
  }

  updatePOSData() {
    this.requestInfoService.updateData({ posData: this.posData });
  }

  onFieldChange() {
    this.updatePOSData();
  }

  private startTimestampUpdate() {
    this.posData.posTimestamp = new Date().toISOString().slice(0, 19);
    this.updatePOSData();
    this.timestampInterval = setInterval(() => {
      this.posData.posTimestamp = new Date().toISOString().slice(0, 19);
      this.updatePOSData();
      console.log("Updated posTimestamp:", this.posData.posTimestamp);
    }, 1000);
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
    this.posDataDisabledFields = disabledFields.posData;
  }

  private subscribeToDataChanges() {
    this.dataSubscription = this.requestInfoService.dataChange$.subscribe(
      (data: FullRequestData | boolean | { refreshRequestId?: string }) => {
        if (data === true) {
          console.log('Mise à jour globale détectée, rafraîchissement de PosDataComponent');
          this.loadLastPosData();
          this.cdr.detectChanges();
        } else if (typeof data === 'object' && data !== null) {
          if ('refreshRequestId' in data) {
            return;
          }
          if ('posData' in data) {
            this.posData = { ...this.posData, ...(data as FullRequestData).posData };
            if (!(data as FullRequestData).posData.posTimestamp) {
              this.startTimestampUpdate();
            }
            this.cdr.detectChanges();
          }
        }
      }
    );
  }

  private resetPosData() {
    this.posData = {
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
    this.startTimestampUpdate();
    console.log('PosDataComponent fully reset, posData:', this.posData);
  }
}