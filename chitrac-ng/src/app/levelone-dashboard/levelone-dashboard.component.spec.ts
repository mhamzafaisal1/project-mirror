import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeveloneDashboardComponent } from './levelone-dashboard.component';

describe('LeveloneDashboardComponent', () => {
  let component: LeveloneDashboardComponent;
  let fixture: ComponentFixture<LeveloneDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeveloneDashboardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeveloneDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
