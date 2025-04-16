import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LevelonePieChartComponent } from './levelone-pie-chart.component';

describe('LevelonePieChartComponent', () => {
  let component: LevelonePieChartComponent;
  let fixture: ComponentFixture<LevelonePieChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LevelonePieChartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LevelonePieChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
