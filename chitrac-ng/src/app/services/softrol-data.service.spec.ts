import { TestBed } from '@angular/core/testing';

import { SoftrolDataService } from './softrol-data.service';

describe('SoftrolDataService', () => {
  let service: SoftrolDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SoftrolDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
