import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
    selector: 'app-carousel',
    imports: [CommonModule, MatTabsModule, MatIconModule, MatButtonModule],
    templateUrl: './carousel-component.component.html',
    styleUrls: ['./carousel-component.component.scss']
})
export class CarouselComponent {
  @Input() tabs: { label: string; component: any; componentInputs?: any }[] = [];
  @Output() indexChanged = new EventEmitter<number>();
  public selectedIndex = 0;

  get tabLabels(): string[] {
    return this.tabs.map(tab => tab.label);
  }

  get tabComponents(): any[] {
    return this.tabs.map(tab => tab.component);
  }

  get tabInputs(): any[] {
    return this.tabs.map(tab => tab.componentInputs || {});
  }

  public goToPrevious(): void {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
      this.indexChanged.emit(this.selectedIndex); // ✅ Emit change
    }
  }

  public goToNext(): void {
    if (this.selectedIndex < this.tabLabels.length - 1) {
      this.selectedIndex++;
      this.indexChanged.emit(this.selectedIndex); // ✅ Emit change
    }
  }

  // ✅ Needed by ModalWrapperComponent
  getCurrentTabIndex(): number {
    return this.selectedIndex;
  }

  getTabCount(): number {
    return this.tabs.length;
  }

  onTabChange(index: number): void {
    this.selectedIndex = index;
    this.indexChanged.emit(this.selectedIndex);
  }
}
