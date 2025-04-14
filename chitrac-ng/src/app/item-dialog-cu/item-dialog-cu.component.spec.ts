import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ItemDialogCuComponent } from './item-dialog-cu.component';

describe('ItemDialogCuComponent', () => {
  let component: ItemDialogCuComponent;
  let fixture: ComponentFixture<ItemDialogCuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemDialogCuComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ItemDialogCuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
