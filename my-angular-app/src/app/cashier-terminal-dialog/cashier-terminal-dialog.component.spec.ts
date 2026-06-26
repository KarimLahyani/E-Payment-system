import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CashierTerminalDialogComponent } from './cashier-terminal-dialog.component';

describe('CashierTerminalDialogComponent', () => {
  let component: CashierTerminalDialogComponent;
  let fixture: ComponentFixture<CashierTerminalDialogComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CashierTerminalDialogComponent]
    });
    fixture = TestBed.createComponent(CashierTerminalDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
