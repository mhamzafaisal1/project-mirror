import { Component } from '@angular/core';
import { CarouselComponent } from '../components/carousel-component/carousel-component.component';
import { LeveloneTableV2Component } from '../levelone-table-v2/levelone-table-v2.component';
import { LeveloneLineChartComponent } from '../levelone-line-chart/levelone-line-chart.component';
import { LevelonePieChartComponent } from '../levelone-pie-chart/levelone-pie-chart.component';
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
    CarouselComponent,
    LeveloneTableV2Component,
    LeveloneLineChartComponent,
    LevelonePieChartComponent
  ],
  templateUrl: './use-carousel.component.html',
  styleUrl: './use-carousel.component.scss'
})
export class UseCarouselComponent {
  tabData = [
    { label: 'Table View', component: LeveloneTableV2Component },
    { label: 'Line Chart', component: LeveloneLineChartComponent },
    { label: 'Pie Chart', component: LevelonePieChartComponent }
  ];
}
