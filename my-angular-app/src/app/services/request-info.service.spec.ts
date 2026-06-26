import { TestBed } from '@angular/core/testing';

import { RequestInfoService } from './request-info.service';

describe('RequestInfoService', () => {
  let service: RequestInfoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RequestInfoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
