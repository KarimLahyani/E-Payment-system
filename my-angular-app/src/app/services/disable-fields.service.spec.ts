import { TestBed } from '@angular/core/testing';

import { DisableFieldsService } from './disable-fields.service';

describe('DisableFieldsService', () => {
  let service: DisableFieldsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DisableFieldsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
