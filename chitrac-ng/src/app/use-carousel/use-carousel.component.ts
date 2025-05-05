import { Component, Input } from '@angular/core';
import { CarouselComponent } from '../components/carousel-component/carousel-component.component';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

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
  styleUrl: './use-carousel.component.scss'
})
export class UseCarouselComponent {
  @Input() tabData: { label: string; component: any; componentInputs?: any }[] = [];
  @Input() machineSerial: string = '';
  @Input() startTime: string = '';
  @Input() endTime: string = '';

  get enhancedTabData() {
    return this.tabData.map(tab => {
      const inputs: any = {
        machineSerial: this.machineSerial,
        startTime: this.startTime,
        endTime: this.endTime,
        ...(tab.componentInputs || {})
      };

      return {
        ...tab,
        componentInputs: inputs
      };
    });
  }
}
