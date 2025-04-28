import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core'; // ✅ REQUIRED!
import { DateTime } from 'luxon'; // ✅ Using Luxon for proper time control

import { BaseTableComponent } from '../components/base-table/base-table.component';
import { MachineAnalyticsService } from '../services/machine-analytics.service';
import { ModalWrapperComponent } from '../components/modal-wrapper-component/modal-wrapper-component.component';
import { OperatorPerformanceChartComponent } from '../operator-performance-chart/operator-performance-chart.component';

@Component({
  selector: 'app-machine-analytics-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule, // ✅ NEEDED here
    BaseTableComponent
  ],
  templateUrl: './machine-analytics-dashboard.component.html',
  styleUrls: ['./machine-analytics-dashboard.component.scss']
})
export class MachineAnalyticsDashboardComponent implements OnInit {
  startTime: Date = new Date();
  endTime: Date = new Date();
  columns: string[] = [];
  rows: any[] = [];
  selectedRow: any | null = null;

  constructor(
    private analyticsService: MachineAnalyticsService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    const now = DateTime.now();
    this.startTime = now.startOf('day').toJSDate(); // Start of today
    this.endTime = now.toJSDate(); // Current moment
    this.fetchAnalyticsData();
  }

  fetchAnalyticsData(): void {
    if (!this.startTime || !this.endTime) return;

    const startISO = DateTime.fromJSDate(this.startTime).toISO();
    const endISO = DateTime.fromJSDate(this.endTime).toISO();

    this.analyticsService.getMachinePerformance(startISO, endISO, undefined)
      .subscribe((data: any) => {
        const responses = Array.isArray(data) ? data : [data];

        const formattedData = responses.map(response => ({
          'Machine Name': response.machine.name,
          'Serial Number': response.machine.serial,
          'Status': response.currentStatus.name,
          'Runtime': `${response.metrics.runtime.formatted.hours}h ${response.metrics.runtime.formatted.minutes}m`,
          'Downtime': `${response.metrics.downtime.formatted.hours}h ${response.metrics.downtime.formatted.minutes}m`,
          'Total Count': response.metrics.output.totalCount,
          'Misfeed Count': response.metrics.output.misfeedCount,
          'Availability': `${response.metrics.performance.availability.percentage}%`,
          'Throughput': `${response.metrics.performance.throughput.percentage}%`,
          'Efficiency': `${response.metrics.performance.efficiency.percentage}%`,
          'OEE': `${response.metrics.performance.oee.percentage}%`,
          'Time Range': `${response.timeRange.start} to ${response.timeRange.end}`
        }));

        this.columns = Object.keys(formattedData[0]);
        this.rows = formattedData;
      });
  }

  onRowClick(row: any): void {
    if (this.selectedRow === row) {
      this.selectedRow = null;
      return;
    }

    this.selectedRow = row;

    const dialogRef = this.dialog.open(ModalWrapperComponent, {
      width: '90vw',
      height: '85vh',
      maxWidth: 'none',
      data: {
        component: OperatorPerformanceChartComponent,
        machineSerial: row['Serial Number']
      }
    });

    dialogRef.afterClosed().subscribe(() => {
      this.selectedRow = null;
    });
  }
}
