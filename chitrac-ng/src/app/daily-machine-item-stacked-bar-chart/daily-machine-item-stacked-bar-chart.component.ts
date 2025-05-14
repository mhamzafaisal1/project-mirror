import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { StackedBarChartComponent, StackedBarChartData } from '../components/stacked-bar-chart/stacked-bar-chart.component';
import { DailyDashboardService } from '../services/daily-dashboard.service';

@Component({
  selector: 'app-daily-machine-item-stacked-bar-chart',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    DateTimePickerComponent,
    StackedBarChartComponent
  ],
  templateUrl: './daily-machine-item-stacked-bar-chart.component.html',
  styleUrls: ['./daily-machine-item-stacked-bar-chart.component.scss']
})
export class DailyMachineItemStackedBarChartComponent implements OnChanges {
  @Input() startTime: string = '';
  @Input() endTime: string = '';

  chartData: StackedBarChartData | null = null;
  loading = false;
  error = '';
  isDarkTheme = false;

  constructor(private dashboardService: DailyDashboardService) {
    this.isDarkTheme = document.body.classList.contains('dark-theme');

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
    if ((changes['startTime'] || changes['endTime']) && this.isValid()) {
      this.fetchData();
    }
  }

  isValid(): boolean {
    return !!this.startTime && !!this.endTime;
  }

  fetchData(): void {
    if (!this.isValid()) return;

    this.loading = true;
    this.error = '';
    const formattedStart = new Date(this.startTime).toISOString();
    const formattedEnd = new Date(this.endTime).toISOString();

    this.dashboardService.getAllMachinesItemHourlyStack(formattedStart, formattedEnd).subscribe({
      next: (response: StackedBarChartData) => {
        this.chartData = response;
        this.loading = false;
      },
      error: (err) => {
        console.error('Item/hour fetch failed:', err);
        this.error = 'Could not load stacked item data.';
        this.loading = false;
      }
    });
  }
}
