import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { LineChartComponent, LineChartDataPoint } from '../components/line-chart/line-chart.component';

@Component({
    selector: 'app-levelone-line-chart',
    imports: [CommonModule, LineChartComponent],
    templateUrl: './levelone-line-chart.component.html',
    styleUrls: ['./levelone-line-chart.component.scss']
})
export class LeveloneLineChartComponent implements OnInit {
  data: LineChartDataPoint[] = [];
  title = 'Hourly Production Chart';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<{ title: string; data: { hour: number; counts: number }[] }>('./assets/data/dummyBarChartData.json')
      .subscribe({
        next: res => {
          this.data = res.data.map(d => ({
            label: this.formatHour(d.hour),
            value: d.counts
          }));
          this.title = res.title;
        },
        error: err => {
          console.error('Failed to load line chart data:', err);
        }
      });
  }

  formatHour(hour: number): string {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    if (hour < 12) return `${hour}am`;
    return `${hour - 12}pm`;
  }
}
