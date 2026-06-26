import { Component, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { SaleItem } from '../models/full-request-data.model';

@Component({
  selector: 'app-sale-item',
  templateUrl: './sale-item.component.html',
  styleUrls: ['./sale-item.component.css']
})
export class SaleItemComponent {
  @Input() saleItem: SaleItem = {
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
      case 'itemId':
        this.saleItem.itemId = validatedValue;
        break;
      case 'buttonLabel':
        this.saleItem.buttonLabel = validatedValue;
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

  onSelectItemChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.saleItem.isSelected = target.checked;
    console.log('Checkbox changed for item:', this.saleItem.buttonLabel, 'isSelected:', this.saleItem.isSelected);
    this.saleItemChange.emit({ ...this.saleItem });
  }

  private calculateAmount() {
    const quantity = parseFloat(this.saleItem.quantity) || 0;
    const unitPrice = parseFloat(this.saleItem.unitPrice) || 0;
    const amount = quantity * unitPrice;
    this.saleItem.amount = amount.toFixed(2); // Arrondir à 2 décimales
    console.log(`Calculated amount for ${this.saleItem.buttonLabel}: quantity=${quantity}, unitPrice=${unitPrice}, amount=${this.saleItem.amount}`);
  }
}