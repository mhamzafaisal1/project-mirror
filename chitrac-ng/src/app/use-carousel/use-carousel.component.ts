import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CarouselComponent } from '../components/carousel-component/carousel-component.component';

@Component({
  selector: 'app-use-carousel',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    CarouselComponent
  ],
  templateUrl: './use-carousel.component.html',
  styleUrls: ['./use-carousel.component.scss']
})
export class UseCarouselComponent implements OnChanges {
  @Input() tabData: { label: string; component: any; componentInputs?: any }[] = [];
  @Input() machineSerial: string = '';
  @Input() startTime: string = '';
  @Input() endTime: string = '';

  enhancedTabData: any[] = [];

  ngOnChanges(): void {
    this.enhancedTabData = this.tabData.map(tab => ({
      ...tab,
      componentInputs: {
        machineSerial: this.machineSerial,
        startTime: this.startTime,
        endTime: this.endTime,
        ...(tab.componentInputs || {})
      }
    }));
  }

  get isDarkTheme(): boolean {
    return document.body.classList.contains('dark-theme');
  }
}
