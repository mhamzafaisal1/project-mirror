import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { BaseTableComponent } from '../components/base-table/base-table.component';
import { MachineAnalyticsService } from '../services/machine-analytics.service';

@Component({
  selector: 'app-machine-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, BaseTableComponent],
  templateUrl: './machine-analytics-dashboard.component.html',
  styleUrls: ['./machine-analytics-dashboard.component.scss']
})
export class MachineAnalyticsDashboardComponent {
  startTime = '';
  endTime = '';
  machineSerial?: number;
  columns: string[] = [];
  rows: any[] = [];

  constructor(private analyticsService: MachineAnalyticsService) {}

  fetchAnalyticsData(): void {
    if (!this.startTime || !this.endTime) return;

    this.analyticsService.getMachinePerformance(this.startTime, this.endTime, this.machineSerial)
      .subscribe((data: any) => {
        console.log('API Response:', data);
        
        // Handle both single object and array responses
        const responses = Array.isArray(data) ? data : [data];
        
        // Format the data for the table
        const formattedData = responses.map(response => ({
          'Machine Name': response.machine.name,
          'Serial Number': response.machine.serial,
          'Status': response.currentStatus.name,
          'Runtime': `${response.metrics.runtime.formatted.hours}h ${response.metrics.runtime.formatted.minutes}m`,
          'Downtime': `${response.metrics.downtime.formatted.hours}h ${response.metrics.downtime.formatted.minutes}m`,
          'Total Count': response.metrics.output.totalCount,
          'Misfeed Count': response.metrics.output.misfeedCount,
          'Availability': response.metrics.performance.availability.percentage,
          'Throughput': response.metrics.performance.throughput.percentage,
          'Efficiency': response.metrics.performance.efficiency.percentage,
          'OEE': response.metrics.performance.oee.percentage,
          'Time Range': `${response.timeRange.start} to ${response.timeRange.end}`
        }));

        console.log('Formatted Data:', formattedData);
        
        this.columns = Object.keys(formattedData[0]);
        this.rows = formattedData;
      });
  }
}
