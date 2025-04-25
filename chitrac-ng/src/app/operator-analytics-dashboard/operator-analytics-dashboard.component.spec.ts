import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OperatorAnalyticsDashboardComponent } from './operator-analytics-dashboard.component';

describe('OperatorAnalyticsDashboardComponent', () => {
  let component: OperatorAnalyticsDashboardComponent;
  let fixture: ComponentFixture<OperatorAnalyticsDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperatorAnalyticsDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OperatorAnalyticsDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
