import { Component, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { SaleItem } from '../models/full-request-data.model';

@Component({
  selector: 'app-sale-item',
  templateUrl: './sale-item.component.html',
  styleUrls: ['./sale-item.component.css']
})
export class SaleItemComponent {
  @Input() saleItem: SaleItem = {
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
  };

  @Output() saleItemChange = new EventEmitter<SaleItem>();

  constructor(private cdr: ChangeDetectorRef) {}

  onFieldChange(field: string, value: any) {
    let validatedValue = value !== null && value !== undefined ? value.toString() : '';

    // Valider que quantity et unitPrice ne contiennent que des valeurs numériques (positives ou décimales)
    if (field === 'quantity' || field === 'unitPrice') {
      const numericValue = validatedValue.trim();
      if (numericValue === '') {
        validatedValue = '';
      } else if (!/^\d*\.?\d+$/.test(numericValue)) {
        console.warn(`Valeur invalide pour ${field}: "${value}". Seuls les nombres positifs ou décimaux sont autorisés.`);
        return;
      }
    }

    // Mettre à jour la propriété correspondante dans saleItem
    switch (field) {
      case 'productName':
        this.saleItem.productName = validatedValue;
        break;
      case 'productCode':
        this.saleItem.productCode = validatedValue;
        break;
      case 'quantity':
        this.saleItem.quantity = validatedValue;
        this.calculateAmount(); // Recalculer itemAmount
        break;
      case 'taxCode':
        this.saleItem.taxCode = validatedValue;
        break;
      case 'addProdCode':
        this.saleItem.addProdCode = validatedValue;
        break;
      case 'reverseSale':
        this.saleItem.reverseSale = validatedValue;
        break;
      case 'unitPrice':
        this.saleItem.unitPrice = validatedValue;
        this.calculateAmount(); // Recalculer itemAmount
        break;
      case 'unitMeasure':
        this.saleItem.unitMeasure = validatedValue;
        break;
      case 'saleChannel':
        this.saleItem.saleChannel = validatedValue;
        break;
      case 'rebateLabel':
        this.saleItem.rebateLabel = validatedValue;
        break;
      case 'addProdInfo':
        this.saleItem.addProdInfo = validatedValue;
        break;
      default:
        console.warn('Champ inconnu:', field);
    }

    this.saleItemChange.emit({ ...this.saleItem });
  }

  increaseQuantity() {
    let currentQty = parseInt(this.saleItem.quantity, 10) || 0;
    this.saleItem.quantity = (currentQty + 1).toString();
    this.onFieldChange('quantity', this.saleItem.quantity);
  }

  decreaseQuantity() {
    let currentQty = parseInt(this.saleItem.quantity, 10) || 0;
    if (currentQty > 0) {
      this.saleItem.quantity = (currentQty - 1).toString();
      this.onFieldChange('quantity', this.saleItem.quantity);
    }
  }

  private calculateAmount() {
    const quantity = parseFloat(this.saleItem.quantity) || 0;
    const unitPrice = parseFloat(this.saleItem.unitPrice) || 0;
    const amount = quantity * unitPrice;
    this.saleItem.itemAmount = amount.toFixed(2); // Arrondir à 2 décimales
    console.log(`Calculated amount for ${this.saleItem.productName}: quantity=${quantity}, unitPrice=${unitPrice}, itemAmount=${this.saleItem.itemAmount}`);
  }
}
