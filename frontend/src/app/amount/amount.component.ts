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
    const currentData = (this.requestInfoService as any).currentData;
    if (currentData && currentData.amountData) {
      this.amountData = JSON.parse(JSON.stringify(currentData.amountData));
    }
    
    this.initializeSaleItems();
    // loadLastSaleItems will be called inside initializeSaleItems to avoid race conditions
    this.updateDisplayedItems();
    this.subscribeToDataChanges();
    this.updateAmountData();
  }

  ngOnDestroy(): void {
    if (this.dataSubscription) {
      this.dataSubscription.unsubscribe();
    }
  }

  private initializeSaleItems() {
    this.requestInfoService.getProducts().subscribe(
      (products) => {
        if (products && products.length > 0) {
            this.saleItemsList = products.map(product => {
              const existing = this.amountData.saleItems.find(i => i.productCode === product.productCode);
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
        } else {
          // Fallback if no products
          this.saleItemsList = [];
        }
        this.amountData.saleItems = [...this.saleItemsList];
        this.updateDisplayedItems();
        if (this.saleItemsList.length > 0) {
          this.selectedSaleItem = { ...this.saleItemsList[0] };
        }
      },
      (error) => {
        console.error('Failed to initialize products in amount component', error);
        this.saleItemsList = [];
        this.amountData.saleItems = [...this.saleItemsList];
      }
    );
  }

  private loadLastSaleItems() {
    this.requestInfoService.getLastSaleItems().subscribe(
      (saleItems: SaleItem[]) => {
        console.log('Derniers SaleItems chargés (avant fusion):', JSON.stringify(saleItems, null, 2));
        if (saleItems && saleItems.length > 0) {
          this.saleItemsList = this.saleItemsList.map((defaultItem) => {
            const matchingItem = saleItems.find(item => item.productName === defaultItem.productName);
            if (matchingItem) {
              return {
                ...defaultItem,
                ...matchingItem,
                productName: defaultItem.productName || matchingItem.productName,
                productCode: defaultItem.productCode || matchingItem.productCode,
                itemAmount: matchingItem.itemAmount || defaultItem.itemAmount,
                quantity: defaultItem.quantity || matchingItem.quantity,
                taxCode: defaultItem.taxCode || matchingItem.taxCode,
                addProdCode: defaultItem.addProdCode || matchingItem.addProdCode,
                reverseSale: matchingItem.reverseSale || defaultItem.reverseSale || '0',
                unitPrice: matchingItem.unitPrice || defaultItem.unitPrice,
                unitMeasure: matchingItem.unitMeasure || defaultItem.unitMeasure,
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
            const updatedItem = this.saleItemsList.find(i => i.productName === this.selectedSaleItem?.productName);
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
    // The user requested that after a transaction, the basket should clear to 0 and all items should be deselected 
    // so the cashier is ready for the next customer.
    console.log('Transaction finished for requestId:', requestId, '. Clearing basket for next customer.');
    this.amountData.totalAmount = '0.00';
    this.amountData.preAuthAmount = '0.00';
    
    // Deselect all items
    this.saleItemsList = this.saleItemsList.map(item => ({
      ...item,
      isSelected: false,
      quantity: '',
      itemAmount: ''
    }));
    
    this.amountData.saleItems = [];
    this.selectedSaleItem = null;
    
    this.updateDisplayedItems();
    this.requestInfoService.updateData({ amountData: this.amountData });
    this.cdr.detectChanges();
  }


  private updateDisplayedItems() {
    this.displayedItems = this.saleItemsList.slice(this.currentIndex, this.currentIndex + this.itemsPerPage);
    if (this.selectedSaleItem && !this.displayedItems.some(item => item.productName === this.selectedSaleItem?.productName)) {
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
    const updatedItem = this.saleItemsList.find(i => i.productName === item.productName);
    if (updatedItem) {
      updatedItem.isSelected = !updatedItem.isSelected;
      
      // Default quantity to 1 if selected and quantity is empty/0
      if (updatedItem.isSelected) {
        const qty = parseFloat(updatedItem.quantity) || 0;
        if (qty === 0) {
          updatedItem.quantity = '1';
          const unitPrice = parseFloat(updatedItem.unitPrice) || 0;
          updatedItem.itemAmount = (1 * unitPrice).toFixed(2);
        }
      } else {
        // Optionally clear quantity if deselected, but usually better to leave it.
      }
      
      this.selectedSaleItem = { ...updatedItem };
      this.updateAmountData();
    } else {
      this.selectedSaleItem = null;
    }
  }

  onSaleItemChange(updatedItem: SaleItem) {
    if (this.selectedSaleItem) {
      this.selectedSaleItem = { ...updatedItem, productName: this.selectedSaleItem.productName };
      const index = this.saleItemsList.findIndex(i => i.productName === updatedItem.productName);
      if (index !== -1) {
        this.saleItemsList[index] = { ...updatedItem, productName: this.saleItemsList[index].productName };
      }
      const dataIndex = this.amountData.saleItems.findIndex(i => i.productName === updatedItem.productName);
      if (dataIndex !== -1) {
        this.amountData.saleItems[dataIndex] = { ...updatedItem, productName: this.amountData.saleItems[dataIndex].productName };
      }
      const displayedIndex = this.displayedItems.findIndex(i => i.productName === updatedItem.productName);
      if (displayedIndex !== -1) {
        this.displayedItems[displayedIndex] = { ...updatedItem, productName: this.displayedItems[displayedIndex].productName };
      }
      this.updateAmountData();
      console.log('saleItemsList après mise à jour manuelle:', JSON.stringify(this.saleItemsList, null, 2));
      console.log('amountData.saleItems après mise à jour manuelle:', JSON.stringify(this.amountData.saleItems, null, 2));
    }
  }

  onManualAmountChange() {
    console.log('Manual amount updated:', this.amountData);
    this.requestInfoService.updateData({ amountData: this.amountData });
  }

  private updateAmountData() {
    this.amountData.saleItems = [...this.saleItemsList];
    const total = this.saleItemsList
      .filter(item => item.isSelected)
      .reduce((sum, item) => sum + (parseFloat(item.itemAmount) || 0), 0);
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
            this.saleItemsList = data.amountData.saleItems.map((item: SaleItem) => {
              const existingItem = currentSaleItems.find(i => i.productCode === item.productCode || i.productName === item.productName);
              return {
                ...item,
                productName: item.productName || existingItem?.productName || '',
                productCode: item.productCode || existingItem?.productCode,
                itemAmount: item.itemAmount || existingItem?.itemAmount,
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
              const updatedItem = this.saleItemsList.find(i => i.productName === this.selectedSaleItem?.productName);
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
