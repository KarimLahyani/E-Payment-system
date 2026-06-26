import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PosDataComponent } from './pos-data.component';

describe('PosDataComponent', () => {
  let component: PosDataComponent;
  let fixture: ComponentFixture<PosDataComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PosDataComponent]
    });
    fixture = TestBed.createComponent(PosDataComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
