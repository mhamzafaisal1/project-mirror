import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [CommonModule, MatTabsModule, MatIconModule, MatButtonModule],
  templateUrl: './carousel-component.component.html',
  styleUrls: ['./carousel-component.component.scss']
})
export class CarouselComponent {
  @Input() tabs: { label: string; component: any }[] = [];
  selectedIndex = 0;

  get tabLabels(): string[] {
    return this.tabs.map(tab => tab.label);
  }

  get tabComponents(): any[] {
    return this.tabs.map(tab => tab.component);
  }

  goToPrevious() {
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
    }
  }

  goToNext() {
    if (this.selectedIndex < this.tabLabels.length - 1) {
      this.selectedIndex++;
    }
  }
}
