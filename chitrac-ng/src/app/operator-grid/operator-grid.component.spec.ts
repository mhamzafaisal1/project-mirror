import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OperatorGridComponent } from './operator-grid.component';

describe('OperatorGridComponent', () => {
  let component: OperatorGridComponent;
  let fixture: ComponentFixture<OperatorGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperatorGridComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OperatorGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
