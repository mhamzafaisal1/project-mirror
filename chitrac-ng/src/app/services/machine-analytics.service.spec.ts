import { TestBed } from '@angular/core/testing';

import { MachineAnalyticsService } from './machine-analytics.service';

describe('MachineAnalyticsService', () => {
  let service: MachineAnalyticsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MachineAnalyticsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
