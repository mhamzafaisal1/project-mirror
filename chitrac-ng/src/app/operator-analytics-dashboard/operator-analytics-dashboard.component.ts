import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { BaseTableComponent } from '../components/base-table/base-table.component';
import { OperatorAnalyticsService } from '../services/operator-analytics.service';

@Component({
  selector: 'app-operator-analytics-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule, BaseTableComponent],
  templateUrl: './operator-analytics-dashboard.component.html',
  styleUrl: './operator-analytics-dashboard.component.scss'
})
export class OperatorAnalyticsDashboardComponent {
  startTime = '';
  endTime = '';
  operatorId?: number;
  columns: string[] = [];
  rows: any[] = [];

  constructor(private analyticsService: OperatorAnalyticsService) {}

  fetchAnalyticsData(): void {
    if (!this.startTime || !this.endTime) return;

    this.analyticsService.getOperatorPerformance(this.startTime, this.endTime, this.operatorId)
      .subscribe((data: any) => {  
        // Handle both single object and array responses
        const responses = Array.isArray(data) ? data : [data];
        
        // Format the data for the table
        const formattedData = responses.map(response => ({
          'Operator Name': response.operator.name,
          'Operator ID': response.operator.id,
          'Status': response.currentStatus.name,
          'Runtime': `${response.metrics.runtime.formatted.hours}h ${response.metrics.runtime.formatted.minutes}m`,
          'Paused Time': `${response.metrics.pausedTime.formatted.hours}h ${response.metrics.pausedTime.formatted.minutes}m`,
          'Fault Time': `${response.metrics.faultTime.formatted.hours}h ${response.metrics.faultTime.formatted.minutes}m`,
          'Total Count': response.metrics.output.totalCount,
          'Misfeed Count': response.metrics.output.misfeedCount,
          'Valid Count': response.metrics.output.validCount,
          'Pieces Per Hour': response.metrics.performance.piecesPerHour.formatted,
          'Efficiency': response.metrics.performance.efficiency.percentage,
          'Time Range': `${response.timeRange.start} to ${response.timeRange.end}`
        }));
        
        this.columns = Object.keys(formattedData[0]);
        this.rows = formattedData;
      });
  }
}
