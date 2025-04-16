import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { PieChartComponent, PieChartDataPoint } from '../components/pie-chart/pie-chart.component';

@Component({
  selector: 'app-levelone-pie-chart',
  standalone: true,
  imports: [CommonModule, PieChartComponent],
  templateUrl: './levelone-pie-chart.component.html',
  styleUrls: ['./levelone-pie-chart.component.scss']
})
export class LevelonePieChartComponent implements OnInit {
  title: string = '';
  data: PieChartDataPoint[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<{ title: string, data: PieChartDataPoint[] }>('assets/data/dummyPieChartData.json')
      .subscribe(res => {
        this.title = res.title;
        this.data = res.data;
      });
  }
}
