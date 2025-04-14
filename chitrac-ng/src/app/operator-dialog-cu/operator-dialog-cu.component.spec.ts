import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OperatorDialogCuComponent } from './operator-dialog-cu.component';

describe('OperatorDialogCuComponent', () => {
  let component: OperatorDialogCuComponent;
  let fixture: ComponentFixture<OperatorDialogCuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperatorDialogCuComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OperatorDialogCuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
