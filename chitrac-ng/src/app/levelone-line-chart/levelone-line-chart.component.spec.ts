import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeveloneLineChartComponent } from './levelone-line-chart.component';

describe('LeveloneLineChartComponent', () => {
  let component: LeveloneLineChartComponent;
  let fixture: ComponentFixture<LeveloneLineChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeveloneLineChartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeveloneLineChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
