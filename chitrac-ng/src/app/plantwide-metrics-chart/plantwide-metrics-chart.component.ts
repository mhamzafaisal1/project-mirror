import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BarChartComponent, BarChartDataPoint } from '../components/bar-chart/bar-chart.component';

@Component({
  selector: 'app-plantwide-metrics-chart',
  standalone: true,
  imports: [CommonModule, BarChartComponent],
  templateUrl: './plantwide-metrics-chart.component.html',
  styleUrls: ['./plantwide-metrics-chart.component.scss']
})
export class PlantwideMetricsChartComponent implements OnChanges {
  @Input() data: {
    hour: number;
    availability: number;
    efficiency: number;
    throughput: number;
    oee: number;
  }[] = [];
  @Input() chartWidth: number = 600;
  @Input() chartHeight: number = 400;

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
      this.chartData = this.data.map(entry => ({
        hour: entry.hour,
        counts: entry.oee,
        label: `${entry.hour}:00`
      }));
    }
  }
}
