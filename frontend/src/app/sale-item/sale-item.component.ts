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
  };

  @Output() saleItemChange = new EventEmitter<SaleItem>();

  constructor(private cdr: ChangeDetectorRef) {}

  get discountedUnitPrice(): string {
    const qty = parseFloat(this.saleItem.quantity) || 0;
    const amount = parseFloat(this.saleItem.amount) || 0;
    if (qty > 0) {
      return (amount / qty).toFixed(3);
    }
    return '';
  }

  onFieldChange(field: string, value: any) {
    let validatedValue = value !== null && value !== undefined ? value.toString() : '';

    // Valider que quantity et unitPrice ne contiennent que des valeurs numériques (positives ou décimales)
    if (field === 'quantity' || field === 'unitPrice' || field === 'amount') {
      const numericValue = validatedValue.trim();
      if (numericValue === '') {
        validatedValue = '';
      } else if (!/^\d*\.?\d+$/.test(numericValue)) {
        console.warn(`Valeur invalide pour ${field}: "${value}". Seuls les nombres positifs ou décimaux sont autorisés.`);
        return;
      }
      
      // Enforce integers for quantity if the item is sold by Unit
      if (field === 'quantity' && this.saleItem.unitMeasure === 'Unit') {
        if (numericValue !== '' && !/^\d+$/.test(numericValue)) {
          console.warn(`Quantité invalide: "${value}". Les articles par 'Unit' doivent être des entiers.`);
          return;
        }
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
        this.calculateAmount(); // Recalculer amount
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
        this.calculateAmount(); // Recalculer amount
        break;
      case 'amount':
        this.saleItem.amount = validatedValue;
        this.calculateQuantity(); // Recalculer quantity
        break;
      case 'unitMeasure':
        this.saleItem.unitMeasure = validatedValue;
        break;
      case 'saleChannel':
        this.saleItem.saleChannel = validatedValue;
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

  get taxPercentage(): string {
    const multipliers: { [key: string]: number } = {
      'A': 20,
      'B': 10,
      'C': 15,
      'D': 5
    };
    const rate = multipliers[this.saleItem.taxCode] || 0;
    return rate > 0 ? `(${rate}%)` : '';
  }

  private calculateAmount() {
    const quantity = parseFloat(this.saleItem.quantity) || 0;
    const unitPrice = parseFloat(this.saleItem.unitPrice) || 0;
    const amount = quantity * unitPrice;
    this.saleItem.amount = amount.toFixed(2); // Arrondir à 2 décimales
    console.log(`Calculated amount for ${this.saleItem.productName}: quantity=${quantity}, unitPrice=${unitPrice}, amount=${this.saleItem.amount}`);
  }

  private calculateQuantity() {
    const amount = parseFloat(this.saleItem.amount) || 0;
    const unitPrice = parseFloat(this.saleItem.unitPrice) || 0;
    if (unitPrice > 0) {
      const quantity = amount / unitPrice;
      this.saleItem.quantity = quantity.toFixed(2);
      console.log(`Calculated quantity for ${this.saleItem.productName}: amount=${amount}, unitPrice=${unitPrice}, quantity=${this.saleItem.quantity}`);
    }
  }
}
