import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { SaleItem, AmountData } from '../models/full-request-data.model';
import { RequestInfoService } from '../services/request-info.service';
import { Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-amount',
  templateUrl: './amount.component.html',
  styleUrls: ['./amount.component.css']
})
export class AmountComponent implements OnInit, OnDestroy {
  saleItemsList: SaleItem[] = [];
  displayedItems: SaleItem[] = [];
  currentIndex = 0;
  itemsPerPage = 10;
  selectedSaleItem: SaleItem | null = null;
  amountData: AmountData = {
    totalAmount: '0',
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
      isSelected: false,
      createdAt: ''
    },
    discount: '0.00'
  };

  lastAmountData: AmountData | null = null;
  private dataSubscription: Subscription | undefined;

  constructor(
    private requestInfoService: RequestInfoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initializeSaleItems();
    this.loadLastSaleItems();
    this.updateDisplayedItems();
    this.loadLastAmountData();
    this.subscribeToDataChanges();
    this.updateAmountData();
    const item1 = this.saleItemsList.find(item => item.buttonLabel === 'Item1');
    if (item1) {
      this.selectedSaleItem = { ...item1 };
    }
  }

  ngOnDestroy(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
  }

  private initializeSaleItems() {
    this.saleItemsList = Array.from({ length: 35 }, (_, i) => ({
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
      isSelected: false,
      createdAt: ''
    }));
    this.amountData.saleItems = [...this.saleItemsList];
  }

  private loadLastSaleItems() {
    this.requestInfoService.getLastSaleItems().subscribe(
      (saleItems: SaleItem[]) => {
        console.log('Derniers SaleItems chargés (avant fusion):', JSON.stringify(saleItems, null, 2));
        if (saleItems && saleItems.length > 0) {
          this.saleItemsList = this.saleItemsList.map((defaultItem) => {
            const matchingItem = saleItems.find(item => item.buttonLabel === defaultItem.buttonLabel);
            if (matchingItem) {
              return {
                ...defaultItem,
                ...matchingItem,
                itemId: defaultItem.itemId || matchingItem.itemId,
                productCode: defaultItem.productCode || matchingItem.productCode,
                amount: matchingItem.amount || defaultItem.amount,
                quantity: defaultItem.quantity || matchingItem.quantity,
                taxCode: defaultItem.taxCode || matchingItem.taxCode,
                addProdCode: defaultItem.addProdCode || matchingItem.addProdCode,
                reverseSale: matchingItem.reverseSale || defaultItem.reverseSale || '0',
                unitPrice: matchingItem.unitPrice || defaultItem.unitPrice,
                unitMeasure: defaultItem.unitMeasure || matchingItem.unitMeasure,
                saleChannel: defaultItem.saleChannel || matchingItem.saleChannel,
                rebateLabel: matchingItem.rebateLabel || defaultItem.rebateLabel,
                addProdInfo: defaultItem.addProdInfo || matchingItem.addProdInfo,
                isSelected: matchingItem.isSelected !== undefined ? matchingItem.isSelected : defaultItem.isSelected,
                createdAt: matchingItem.createdAt
              };
            }
            return defaultItem;
          });
          this.amountData.saleItems = [...this.saleItemsList];
          this.updateDisplayedItems();
          if (this.selectedSaleItem) {
            const updatedItem = this.saleItemsList.find(i => i.buttonLabel === this.selectedSaleItem?.buttonLabel);
            this.selectedSaleItem = updatedItem ? { ...updatedItem } : null;
          }
        }
        console.log('saleItemsList après fusion:', JSON.stringify(this.saleItemsList, null, 2));
        this.updateAmountData();
        this.cdr.detectChanges();
      },
      (error: HttpErrorResponse) => {
        console.error('Erreur lors du chargement des derniers SaleItems:', error);
      }
    );
  }

  refreshAfterResponse(requestId: string) {
    this.requestInfoService.getAmountDataForRequest(requestId).subscribe(
      (storedAmountData: AmountData | null) => {
        if (storedAmountData) {
          console.log('amountData récupéré pour requestId:', requestId, JSON.stringify(storedAmountData, null, 2));
          this.amountData = { ...this.amountData, ...storedAmountData };
          this.saleItemsList = [...storedAmountData.saleItems];
        } else {
          console.warn('Aucun amountData trouvé pour requestId:', requestId);
        }

        this.requestInfoService.getLastSaleItems().subscribe(
          (saleItems: SaleItem[]) => {
            if (saleItems && saleItems.length > 0) {
              console.log('saleItems reçus de getLastSaleItems:', JSON.stringify(saleItems, null, 2));
              this.saleItemsList = this.saleItemsList.map((defaultItem) => {
                const matchingItem = saleItems.find(item => item.buttonLabel === defaultItem.buttonLabel);
                if (matchingItem) {
                  const hasDiscount = matchingItem.rebateLabel && matchingItem.rebateLabel !== '';
                  if (hasDiscount) {
                    console.log(`Remise détectée pour ${matchingItem.buttonLabel}: ${matchingItem.rebateLabel}`);
                  }
                  return {
                    ...defaultItem,
                    amount: matchingItem.amount || defaultItem.amount,
                    unitPrice: matchingItem.unitPrice || defaultItem.unitPrice,
                    isSelected: matchingItem.isSelected !== undefined ? matchingItem.isSelected : defaultItem.isSelected,
                    rebateLabel: matchingItem.rebateLabel || defaultItem.rebateLabel || '',
                    reverseSale: matchingItem.reverseSale || defaultItem.reverseSale || '0',
                    productCode: matchingItem.productCode || defaultItem.productCode,
                    quantity: matchingItem.quantity || defaultItem.quantity,
                    taxCode: matchingItem.taxCode || defaultItem.taxCode,
                    addProdCode: matchingItem.addProdCode || defaultItem.addProdCode,
                    unitMeasure: matchingItem.unitMeasure || defaultItem.unitMeasure,
                    saleChannel: matchingItem.saleChannel || defaultItem.saleChannel,
                    addProdInfo: matchingItem.addProdInfo || defaultItem.addProdInfo
                  };
                }
                return defaultItem;
              });
              this.amountData.saleItems = [...this.saleItemsList];
              console.log('saleItemsList après mise à jour:', JSON.stringify(this.saleItemsList, null, 2));
              this.updateDisplayedItems();
              if (this.selectedSaleItem) {
                const updatedItem = this.saleItemsList.find(i => i.buttonLabel === this.selectedSaleItem?.buttonLabel);
                this.selectedSaleItem = updatedItem ? { ...updatedItem } : null;
              }

              this.requestInfoService.getTotalAmount(requestId).subscribe(
                (data: { totalAmount: string }) => {
                  const totalAmount = parseFloat(data.totalAmount) || 0;
                  this.amountData.totalAmount = totalAmount.toFixed(2);
                  console.log('totalAmount mis à jour:', this.amountData.totalAmount);

                  const itemsTotal = this.saleItemsList
                    .filter(item => item.isSelected && item.reverseSale === '0')
                    .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

                  if (itemsTotal > totalAmount) {
                    const discount = itemsTotal - totalAmount;
                    console.log(`Remise calculée: ${discount.toFixed(2)} EUR`);
                    this.amountData.discount = discount.toFixed(2);
                  } else {
                    console.log('Aucune remise détectée.');
                    this.amountData.discount = '0.00';
                  }

                  this.requestInfoService.updateData({ amountData: this.amountData });
                  this.cdr.detectChanges();
                },
                (error: HttpErrorResponse) => {
                  console.error('Erreur lors de la récupération de totalAmount:', error);
                }
              );
            } else {
              console.warn('Aucun saleItem reçu de getLastSaleItems');
            }
          },
          (error: HttpErrorResponse) => {
            console.error('Erreur lors de la récupération des saleItems mis à jour:', error);
          }
        );
      },
      (error: HttpErrorResponse) => {
        console.error('Erreur lors de la récupération de amountData pour requestId:', requestId, error);
      }
    );
  }

  private updateDisplayedItems() {
    this.displayedItems = this.saleItemsList.slice(this.currentIndex, this.currentIndex + this.itemsPerPage);
    if (this.selectedSaleItem && !this.displayedItems.some(item => item.buttonLabel === this.selectedSaleItem?.buttonLabel)) {
      this.selectedSaleItem = this.displayedItems[0] || null;
    }
    console.log('displayedItems mis à jour:', JSON.stringify(this.displayedItems, null, 2));
  }

  nextItems() {
    if (this.currentIndex + this.itemsPerPage < this.saleItemsList.length) {
      this.currentIndex += this.itemsPerPage;
      this.updateDisplayedItems();
    }
  }

  prevItems() {
    if (this.currentIndex - this.itemsPerPage >= 0) {
      this.currentIndex -= this.itemsPerPage;
      this.updateDisplayedItems();
    }
  }

  selectItem(item: SaleItem) {
    const updatedItem = this.saleItemsList.find(i => i.buttonLabel === item.buttonLabel);
    this.selectedSaleItem = updatedItem ? { ...updatedItem } : null;
  }

  onSaleItemChange(updatedItem: SaleItem) {
    if (this.selectedSaleItem) {
      this.selectedSaleItem = { ...updatedItem, buttonLabel: this.selectedSaleItem.buttonLabel };
      const index = this.saleItemsList.findIndex(i => i.buttonLabel === updatedItem.buttonLabel);
      if (index !== -1) {
        this.saleItemsList[index] = { ...updatedItem, buttonLabel: this.saleItemsList[index].buttonLabel };
      }
      const dataIndex = this.amountData.saleItems.findIndex(i => i.buttonLabel === updatedItem.buttonLabel);
      if (dataIndex !== -1) {
        this.amountData.saleItems[dataIndex] = { ...updatedItem, buttonLabel: this.amountData.saleItems[dataIndex].buttonLabel };
      }
      const displayedIndex = this.displayedItems.findIndex(i => i.buttonLabel === updatedItem.buttonLabel);
      if (displayedIndex !== -1) {
        this.displayedItems[displayedIndex] = { ...updatedItem, buttonLabel: this.displayedItems[displayedIndex].buttonLabel };
      }
      this.updateAmountData();
      console.log('saleItemsList après mise à jour manuelle:', JSON.stringify(this.saleItemsList, null, 2));
      console.log('amountData.saleItems après mise à jour manuelle:', JSON.stringify(this.amountData.saleItems, null, 2));
    }
  }

  private updateAmountData() {
    this.amountData.saleItems = [...this.saleItemsList];
    const total = this.saleItemsList
      .filter(item => item.isSelected)
      .reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    this.amountData.totalAmount = total.toFixed(2);
    console.log('Updated totalAmount (updateAmountData):', this.amountData.totalAmount);
    console.log('amountData avant envoi au service:', JSON.stringify(this.amountData, null, 2));
    this.requestInfoService.updateData({ amountData: this.amountData });
  }

  private loadLastAmountData() {
    this.requestInfoService.getLastAmountData().subscribe(
      (data: AmountData) => {
        this.lastAmountData = { ...data };
        this.amountData = { ...this.amountData, ...data };
        console.log('Dernières données Amount Data chargées:', JSON.stringify(this.lastAmountData, null, 2));
        this.cdr.detectChanges();
      },
      (error: HttpErrorResponse) => {
        console.error('Erreur lors du chargement des dernières données Amount Data:', error);
      }
    );
  }

  private subscribeToDataChanges() {
    this.dataSubscription = this.requestInfoService.dataChange$.subscribe((data: any) => {
      console.log('Données reçues via dataChange$:', JSON.stringify(data, null, 2));
      if (data === true) {
        console.log('Mise à jour globale détectée, rafraîchissement de AmountComponent');
        this.loadLastSaleItems();
        this.loadLastAmountData();
        this.updateDisplayedItems();
        this.cdr.detectChanges();
      } else if (typeof data === 'object' && data !== null) {
        if (data.refreshRequestId) {
          this.refreshAfterResponse(data.refreshRequestId);
        }

        if (data.amountData) {
          const currentSaleItems = [...this.saleItemsList];
          this.amountData = { ...this.amountData, ...data.amountData };
          if (data.amountData.saleItems && data.amountData.saleItems.length > 0) {
            this.saleItemsList = data.amountData.saleItems.map((item: SaleItem, index: number) => {
              const existingItem = currentSaleItems.find(i => i.buttonLabel === `Item${index + 1}`);
              return {
                ...item,
                buttonLabel: `Item${index + 1}`,
                itemId: existingItem?.itemId || item.itemId,
                productCode: existingItem?.productCode || item.productCode,
                amount: item.amount || existingItem?.amount,
                quantity: existingItem?.quantity || item.quantity,
                taxCode: existingItem?.taxCode || item.taxCode,
                addProdCode: existingItem?.addProdCode || item.addProdCode,
                reverseSale: item.reverseSale || existingItem?.reverseSale || '0',
                unitPrice: item.unitPrice || existingItem?.unitPrice,
                unitMeasure: existingItem?.unitMeasure || item.unitMeasure,
                saleChannel: existingItem?.saleChannel || item.saleChannel,
                rebateLabel: item.rebateLabel || existingItem?.rebateLabel,
                addProdInfo: existingItem?.addProdInfo || item.addProdInfo,
                isSelected: item.isSelected !== undefined ? item.isSelected : (existingItem?.isSelected || false),
                createdAt: item.createdAt
              };
            });
            this.amountData.saleItems = [...this.saleItemsList];
            if (this.selectedSaleItem) {
              const updatedItem = this.saleItemsList.find(i => i.buttonLabel === this.selectedSaleItem?.buttonLabel);
              this.selectedSaleItem = updatedItem ? { ...updatedItem } : null;
            }
            this.updateDisplayedItems();
          }
          this.updateAmountData();
          console.log('saleItemsList après mise à jour via dataChange$:', JSON.stringify(this.saleItemsList, null, 2));
          console.log('amountData.saleItems après mise à jour via dataChange$:', JSON.stringify(this.amountData.saleItems, null, 2));
        }
      }
    });
  }
}