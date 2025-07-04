import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { BarChartComponent, BarChartDataPoint } from '../components/bar-chart/bar-chart.component';
import { MultipleBarChartComponent, BarChartData } from '../components/multiple-bar-chart/multiple-bar-chart.component';
import { StackedBarChartComponent, StackedBarChartData } from '../components/stacked-bar-chart/stacked-bar-chart.component';

@Component({
  selector: 'app-levelone-bar-chart',
  standalone: true,
  imports: [CommonModule, BarChartComponent, MultipleBarChartComponent, StackedBarChartComponent],
  templateUrl: './levelone-bar-chart.component.html',
  styleUrls: ['./levelone-bar-chart.component.scss']
})
export class LeveloneBarChartComponent {
  singleChartData: BarChartDataPoint[] = [];
  singleChartTitle: string = '';
  multipleChartData: BarChartData | null = null;
  stackedChartData: StackedBarChartData | null = null;

  constructor(private http: HttpClient) {
    // Load data for single bar chart
    this.http.get<{ title: string, data: BarChartDataPoint[] }>('assets/data/dummyBarChartData.json')
      .subscribe(res => {
        this.singleChartData = res.data;
        this.singleChartTitle = res.title;
      });

    // Load data for multiple bar chart
    this.http.get<BarChartData>('assets/data/dummyMultipleBarChartData.json')
      .subscribe(res => {
        this.multipleChartData = res;
      });

    // Load data for stacked bar chart
    this.http.get<StackedBarChartData>('assets/data/dummyStackedBarChart.json')
      .subscribe(res => {
        this.stackedChartData = res;
      });
  }
}
