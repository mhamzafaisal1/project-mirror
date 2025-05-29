import { Component, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatIconModule } from '@angular/material/icon';

import { BaseTableComponent } from '../components/base-table/base-table.component';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { OperatorAnalyticsService } from '../services/operator-analytics.service';
import { getStatusDotByCode } from '../../utils/status-utils';

import { ModalWrapperComponent } from '../components/modal-wrapper-component/modal-wrapper-component.component';
import { UseCarouselComponent } from '../use-carousel/use-carousel.component';
import { OperatorItemSummaryTableComponent } from '../operator-item-summary-table/operator-item-summary-table.component';
import { OperatorCountbyitemChartComponent } from '../operator-countbyitem-chart/operator-countbyitem-chart.component';
import { OperatorCyclePieChartComponent } from '../operator-cycle-pie-chart/operator-cycle-pie-chart.component';
import { OperatorFaultHistoryComponent } from '../operator-fault-history/operator-fault-history.component';
import { OperatorPerformanceChartComponent } from '../operator-performance-chart/operator-performance-chart.component';
import { OperatorLineChartComponent } from '../operator-line-chart/operator-line-chart.component';

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
    MatSortModule,
    MatButtonModule,
    OperatorPerformanceChartComponent,
    OperatorLineChartComponent,
    MatIconModule
  ],
  templateUrl: './operator-analytics-dashboard.component.html',
  styleUrl: './operator-analytics-dashboard.component.scss'
})
export class OperatorAnalyticsDashboardComponent implements OnInit, OnDestroy {
  isDarkTheme: boolean = false;
  private observer!: MutationObserver;
  startTime = '';
  endTime = '';
  operatorId?: number;
  columns: string[] = [];
  rows: any[] = [];
  selectedRow: any = null;
  isLoading = false;
  operatorData: any[] = []; // Store the raw dashboard data

  // Chart dimensions
  chartHeight = 700;
  chartWidth = 1000;

  constructor(
    private analyticsService: OperatorAnalyticsService,
    private dialog: MatDialog,
    private renderer: Renderer2,
    private elRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.detectTheme();

    this.observer = new MutationObserver(() => {
      this.detectTheme();
    });
    this.observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    this.fetchAnalyticsData();
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  detectTheme(): void {
    const isDark = document.body.classList.contains('dark-theme');
    this.isDarkTheme = isDark;

    const element = this.elRef.nativeElement;
    this.renderer.setStyle(element, 'background-color', isDark ? '#121212' : '#ffffff');
    this.renderer.setStyle(element, 'color', isDark ? '#e0e0e0' : '#000000');
  }

  async fetchAnalyticsData(): Promise<void> {
    if (!this.startTime || !this.endTime) return;

    this.isLoading = true;
    this.analyticsService.getOperatorDashboard(this.startTime, this.endTime, this.operatorId)
      .subscribe({
        next: (data: any) => {  
          // Store the raw data for later use
          this.operatorData = Array.isArray(data) ? data : [data];
          
          this.rows = this.operatorData.map(response => ({
            'Status': getStatusDotByCode(response.currentStatus?.code),
            'Operator Name': response.operator.name,
            'Operator ID': response.operator.id,
            'Runtime': `${response.performance.runtime.formatted.hours}h ${response.performance.runtime.formatted.minutes}m`,
            'Paused Time': `${response.performance.pausedTime.formatted.hours}h ${response.performance.pausedTime.formatted.minutes}m`,
            'Fault Time': `${response.performance.faultTime.formatted.hours}h ${response.performance.faultTime.formatted.minutes}m`,
            'Total Count': response.performance.output.totalCount,
            'Misfeed Count': response.performance.output.misfeedCount,
            'Valid Count': response.performance.output.validCount,
            'Pieces Per Hour': response.performance.performance.piecesPerHour.formatted,
            'Efficiency': response.performance.performance.efficiency.percentage,
            'Time Range': `${this.startTime} to ${this.endTime}`
          }));

          const allColumns = Object.keys(this.rows[0]);
          this.columns = allColumns.filter(col => col !== 'Time Range');
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error fetching analytics data:', error);
          this.isLoading = false;
        }
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
  
    const operatorId = row['Operator ID'];
  
    // Use the user-selected `this.endTime` to compute startTime for line chart
    const selectedEnd = new Date(this.endTime);
    const selectedStart = new Date(selectedEnd);
    selectedStart.setDate(selectedStart.getDate() - 28);
  
    const startTimeStr = selectedStart.toISOString();
    const endTimeStr = selectedEnd.toISOString();

    // Find the operator data from the stored dashboard data
    const operatorData = this.operatorData?.find((o: any) => o.operator?.id === operatorId);
    if (!operatorData) {
      console.error('Operator data not found for ID:', operatorId);
      return;
    }

    const carouselTabs = [
      {
        label: 'Item Summary',
        component: OperatorItemSummaryTableComponent,
        componentInputs: {
          mode: 'dashboard',
          dashboardData: this.operatorData,
          operatorId: operatorId,
          isModal: true
        }
      },
      {
        label: 'Item Stacked Chart',
        component: OperatorCountbyitemChartComponent,
        componentInputs: {
          mode: 'dashboard',
          dashboardData: this.operatorData,
          operatorId: operatorId,
          isModal: true,
          chartHeight: this.chartHeight,
          chartWidth: this.chartWidth
        }
      },
      {
        label: 'Running/Paused/Fault Pie Chart',
        component: OperatorCyclePieChartComponent,
        componentInputs: {
          mode: 'dashboard',
          dashboardData: this.operatorData,
          operatorId: operatorId,
          isModal: true,
          chartHeight: (this.chartHeight - 200),
          chartWidth: this.chartWidth
        }
      },
      {
        label: 'Fault History',
        component: OperatorFaultHistoryComponent,
        componentInputs: {
          mode: 'dashboard',
          dashboardData: this.operatorData,
          operatorId: operatorId.toString(),
          isModal: true
        }
      },
      {
        label: 'Daily Efficiency Chart',
        component: OperatorLineChartComponent,
        componentInputs: {
          mode: 'dashboard',
          dashboardData: this.operatorData,
          operatorId: operatorId.toString(),
          isModal: true,
          chartHeight: (this.chartHeight - 50),
          chartWidth: this.chartWidth
        }
      }
    ];
  
    const dialogRef = this.dialog.open(ModalWrapperComponent, {
      width: '90vw',
      height: '85vh',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'performance-chart-dialog',
      data: {
        component: UseCarouselComponent,
        componentInputs: {
          tabData: carouselTabs
        }
      }
    });
  
    dialogRef.afterClosed().subscribe(() => {
      if (this.selectedRow === row) {
        this.selectedRow = null;
      }
    });
  }
}
