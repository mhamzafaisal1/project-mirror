import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BarChartComponent, BarChartDataPoint } from '../components/bar-chart/bar-chart.component';

@Component({
  selector: 'app-daily-count-bar-chart',
  standalone: true,
  imports: [CommonModule, BarChartComponent],
  templateUrl: './daily-count-bar-chart.component.html',
  styleUrls: ['./daily-count-bar-chart.component.scss']
})
export class DailyCountBarChartComponent implements OnChanges {
  @Input() data: { date: string; count: number }[] = [];

  chartData: BarChartDataPoint[] = [];
  isDarkTheme = false;

  constructor() {
    this.isDarkTheme = document.body.classList.contains('dark-theme');
    const observer = new MutationObserver(() => {
      this.isDarkTheme = document.body.classList.contains('dark-theme');
    });
    observer.observe(document.body, { attributes: true });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && Array.isArray(this.data)) {
      this.chartData = this.data.map((entry, i) => ({
        hour: i,
        counts: entry.count,
        label: entry.date
      }));
    }
  }
}
