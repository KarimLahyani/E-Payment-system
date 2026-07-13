import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoyaltyComponent } from './loyalty.component';

describe('LoyaltyComponent', () => {
  let component: LoyaltyComponent;
  let fixture: ComponentFixture<LoyaltyComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LoyaltyComponent]
    });
    fixture = TestBed.createComponent(LoyaltyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
