import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { BarAndLineChartComponent } from '../components/bar-and-line-chart/bar-and-line-chart.component';
import { DailyDashboardService } from '../services/daily-dashboard.service';

interface PlantwideMetricsData {
  hours: number[];
  series: {
    Availability: number[];
    Efficiency: number[];
    Throughput: number[];
    OEE: number[];
  };
}

@Component({
  selector: 'app-plantwide-metrics-chart',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    MatButtonModule,
    DateTimePickerComponent, 
    BarAndLineChartComponent
  ],
  templateUrl: './plantwide-metrics-chart.component.html',
  styleUrls: ['./plantwide-metrics-chart.component.scss']
})
export class PlantwideMetricsChartComponent implements OnChanges {
  @Input() startTime: string = '';
  @Input() endTime: string = '';

  chartData: PlantwideMetricsData | null = null;
  loading = false;
  error: string | null = null;
  isDarkTheme = false;

  constructor(private dailyDashboardService: DailyDashboardService) {
    // Initialize dark theme based on body class
    this.isDarkTheme = document.body.classList.contains('dark-theme');
    
    // Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          this.isDarkTheme = document.body.classList.contains('dark-theme');
        }
      });
    });
    
    observer.observe(document.body, { attributes: true });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['startTime'] || changes['endTime']) {
      this.fetchData();
    }
  }

  fetchData(): void {
    if (!this.startTime || !this.endTime) return;
  
    this.loading = true;
    this.error = null;
  
    this.dailyDashboardService.getPlantwideMetricsByHour(this.startTime, this.endTime).subscribe({
      next: (response) => {
        // Correctly extract from `response.data`
        this.chartData = {
          hours: response.data.hours,
          series: response.data.series
        };
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching plantwide metrics:', err);
        this.error = 'Failed to fetch plantwide metrics';
        this.loading = false;
      }
    });
  }
  
}
