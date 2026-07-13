import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResponseInfoComponent } from './response-info.component';

describe('ResponseInfoComponent', () => {
  let component: ResponseInfoComponent;
  let fixture: ComponentFixture<ResponseInfoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ResponseInfoComponent]
    });
    fixture = TestBed.createComponent(ResponseInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
