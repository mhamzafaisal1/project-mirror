import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { BaseTableComponent } from '../components/base-table/base-table.component';
import { OperatorAnalyticsService } from '../services/operator-analytics.service';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { ModalWrapperComponent } from '../components/modal-wrapper-component/modal-wrapper-component.component';
import { OperatorCountbyitemChartComponent } from '../operator-countbyitem-chart/operator-countbyitem-chart.component';

@Component({
  selector: 'app-operator-analytics-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    HttpClientModule, 
    FormsModule, 
    BaseTableComponent, 
    DateTimePickerComponent,
    MatTableModule,
    MatSortModule
  ],
  templateUrl: './operator-analytics-dashboard.component.html',
  styleUrl: './operator-analytics-dashboard.component.scss'
})
export class OperatorAnalyticsDashboardComponent {
  startTime = '';
  endTime = '';
  operatorId?: number;
  columns: string[] = [];
  rows: any[] = [];
  selectedRow: any = null;

  constructor(
    private analyticsService: OperatorAnalyticsService,
    private dialog: MatDialog
  ) {}

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
        
        const allColumns = Object.keys(formattedData[0]);
        const columnsToHide = ['Time Range'];
        this.columns = allColumns.filter(col => !columnsToHide.includes(col));
        this.rows = formattedData;
      });
  }

  onRowSelected(row: any): void {
    if (this.selectedRow === row) {
      this.selectedRow = null;
      return;
    }

    this.selectedRow = row;

    setTimeout(() => {
      const element = document.querySelector('.mat-row.selected');
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);

    const dialogRef = this.dialog.open(ModalWrapperComponent, {
      width: '90vw',
      height: '80vh',
      maxHeight: '90vh',
      maxWidth: '95vw',
      panelClass: 'performance-chart-dialog',
      data: {
        component: OperatorCountbyitemChartComponent,
        operatorId: row['Operator ID'],
        startTime: this.startTime,
        endTime: this.endTime
      }
    });

    dialogRef.afterClosed().subscribe(() => {
      if (this.selectedRow === row) {
        this.selectedRow = null;
      }
    });
  }
}
