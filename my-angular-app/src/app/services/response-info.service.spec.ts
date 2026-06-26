import { TestBed } from '@angular/core/testing';

import { ResponseInfoService } from './response-info.service';

describe('ResponseInfoService', () => {
  let service: ResponseInfoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ResponseInfoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
