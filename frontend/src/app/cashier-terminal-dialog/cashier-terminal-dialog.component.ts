import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

interface DialogData {
  message: string;
}

interface CardProfile {
  id: string;
  label: string;
  business: string;
  maskedPan: string;
  status: string;
  products: string;
}

type TerminalMode = 'insert' | 'code' | 'confirm' | 'generic';

@Component({
  selector: 'app-cashier-terminal-dialog',
  templateUrl: './cashier-terminal-dialog.component.html',
  styleUrls: ['./cashier-terminal-dialog.component.css']
})
export class CashierTerminalDialogComponent {
  readonly lines: string[];
  readonly mode: TerminalMode;
  readonly selectedCard: CardProfile;
  codeBuffer = '';
  cardInserted = false;

  readonly cards: CardProfile[] = [
    {
      id: 'acme-fleet-diesel',
      label: 'ACME Fleet Diesel',
      business: 'ACME Logistics',
      maskedPan: '700001******9012',
      status: 'Active',
      products: 'Diesel only'
    },
    {
      id: 'northwind-retail',
      label: 'Northwind Retail',
      business: 'Northwind Stores',
      maskedPan: '700002******1044',
      status: 'Active',
      products: 'Fuel, coffee, car wash'
    },
    {
      id: 'contractor-fuel',
      label: 'Contractor Fuel',
      business: 'Roadworks Partner',
      maskedPan: '700003******5520',
      status: 'Blocked',
      products: 'Fuel restricted'
    }
  ];

  constructor(
    public dialogRef: MatDialogRef<CashierTerminalDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    this.lines = this.parseLines(data.message);
    this.mode = this.detectMode(this.lines.join(' '));
    this.selectedCard = this.matchCard(this.lines.join(' '));
    this.cardInserted = this.mode !== 'insert';
  }

  get title(): string {
    if (this.mode === 'insert') return 'Insert business card';
    if (this.mode === 'code') return 'Driver code';
    if (this.mode === 'confirm') return 'Confirm transaction';
    return 'Terminal prompt';
  }

  get primaryActionLabel(): string {
    if (this.mode === 'insert') return this.cardInserted ? 'Card inserted' : 'Insert card';
    if (this.mode === 'code') return 'Send code';
    return 'YES';
  }

  get canSubmit(): boolean {
    if (this.mode === 'insert') return this.cardInserted;
    if (this.mode === 'code') return this.codeBuffer.length >= 4;
    return true;
  }

  pressKey(value: string): void {
    if (this.codeBuffer.length < 8) {
      this.codeBuffer += value;
    }
  }

  clearCode(): void {
    this.codeBuffer = '';
  }

  removeCard(): void {
    this.cardInserted = false;
  }

  insertCard(): void {
    this.cardInserted = true;
  }

  submit(): void {
    if (!this.canSubmit) return;
    if (this.mode === 'code') {
      this.dialogRef.close(this.codeBuffer);
      return;
    }
    this.dialogRef.close('YES');
  }

  decline(): void {
    this.dialogRef.close('NO');
  }

  private parseLines(message: string): string[] {
    return String(message || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
  }

  private detectMode(message: string): TerminalMode {
    const normalized = message.toUpperCase();
    if (normalized.includes('ENTER DRIVER CODE') || normalized.includes('PIN') || normalized.includes('CODE')) return 'code';
    if (normalized.includes('INSERT')) return 'insert';
    if (normalized.includes('CONFIRM') || normalized.includes('SIGNATURE') || normalized.includes('AMOUNT')) return 'confirm';
    return 'generic';
  }

  private matchCard(message: string): CardProfile {
    const normalized = message.toUpperCase();
    return this.cards.find(card => normalized.includes(card.label.toUpperCase()) || normalized.includes(card.business.toUpperCase())) || this.cards[0];
  }
}
