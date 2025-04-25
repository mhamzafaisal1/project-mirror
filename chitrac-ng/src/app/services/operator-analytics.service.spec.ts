import { TestBed } from '@angular/core/testing';

import { OperatorAnalyticsService } from './operator-analytics.service';

describe('OperatorAnalyticsService', () => {
  let service: OperatorAnalyticsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OperatorAnalyticsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
