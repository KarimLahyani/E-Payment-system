import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

interface DialogData {
  message: string;
}

@Component({
  selector: 'app-cashier-terminal-dialog',
  template: `
    <h2 mat-dialog-title>Confirmation</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onNoClick()">NO</button>
      <button mat-button (click)="onYesClick()" color="primary">YES</button>
    </mat-dialog-actions>
  `,
})
export class CashierTerminalDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<CashierTerminalDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {}

  onNoClick(): void {
    this.dialogRef.close('NO');
  }

  onYesClick(): void {
    this.dialogRef.close('YES');
  }
}