import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BarChartComponent, BarChartDataPoint } from '../components/bar-chart/bar-chart.component';

@Component({
  selector: 'app-levelone-bar-chart',
  standalone: true,
  imports: [CommonModule, BarChartComponent],
  templateUrl: './levelone-bar-chart.component.html',
  styleUrls: ['./levelone-bar-chart.component.scss']
})
export class LeveloneBarChartComponent {
  chartData: BarChartDataPoint[] = [];
  chartTitle: string = '';

  constructor(private http: HttpClient) {
    this.http.get<{ title: string, data: BarChartDataPoint[] }>('assets/data/dummyBarChartData.json')
    .subscribe(res => {
      this.chartData = res.data;
      this.chartTitle = res.title;
    });
  
  }
}
