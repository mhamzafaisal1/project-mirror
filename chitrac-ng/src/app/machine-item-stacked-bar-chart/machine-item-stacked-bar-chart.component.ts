import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { StackedBarChartComponent, StackedBarChartData } from '../components/stacked-bar-chart/stacked-bar-chart.component';
import { MachineAnalyticsService } from '../services/machine-analytics.service';

@Component({
  selector: 'app-machine-item-stacked-bar-chart',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DateTimePickerComponent,
    StackedBarChartComponent
  ],
  templateUrl: './machine-item-stacked-bar-chart.component.html',
  styleUrls: ['./machine-item-stacked-bar-chart.component.scss']
})
export class MachineItemStackedBarChartComponent {
  startTime = '';
  endTime = '';
  machineSerial: number | null = null;
  chartData: StackedBarChartData | null = null;
  loading = false;
  error = '';

  constructor(private analyticsService: MachineAnalyticsService) {}

  isValid(): boolean {
    return !!this.startTime && !!this.endTime && this.machineSerial !== null;
  }

  fetchData(): void {
    if (!this.isValid()) return;

    this.loading = true;
    this.error = '';
    const formattedStart = new Date(this.startTime).toISOString();
    const formattedEnd = new Date(this.endTime).toISOString();

    this.analyticsService.getMachineItemHourlyStack(formattedStart, formattedEnd, this.machineSerial!).subscribe({
      next: (response) => {
        this.chartData = response;
        this.loading = false;
      },
      error: (err) => {
        console.error('Fetch failed:', err);
        this.error = 'Could not load data.';
        this.loading = false;
      }
    });
  }
}
