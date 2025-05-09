import { Component, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from "@angular/material/button";
import { MatDialog } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';

import { BaseTableComponent } from '../components/base-table/base-table.component';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { OperatorAnalyticsService } from '../services/operator-analytics.service';
import { getStatusDotByCode } from '../../utils/status-utils';

import { ModalWrapperComponent } from '../components/modal-wrapper-component/modal-wrapper-component.component';
import { UseCarouselComponent } from '../use-carousel/use-carousel.component';
import { OperatorItemSummaryTableComponent } from '../operator-item-summary-table/operator-item-summary-table.component';
import { OperatorCountbyitemChartComponent } from '../operator-countbyitem-chart/operator-countbyitem-chart.component';
import { OperatorCyclePieChartComponent } from '../operator-cycle-pie-chart/operator-cycle-pie-chart.component';

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
    MatButtonModule
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

  fetchAnalyticsData(): void {
    if (!this.startTime || !this.endTime) return;

    this.analyticsService.getOperatorPerformance(this.startTime, this.endTime, this.operatorId)
      .subscribe((data: any) => {  
        const responses = Array.isArray(data) ? data : [data];
        
        this.rows = responses.map(response => ({
          'Status': getStatusDotByCode(response.currentStatus?.code),
          'Operator Name': response.operator.name,
          'Operator ID': response.operator.id,
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

        const allColumns = Object.keys(this.rows[0]);
        this.columns = allColumns.filter(col => col !== 'Time Range');
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

    const carouselTabs = [
      {
        label: 'Item Summary',
        component: OperatorItemSummaryTableComponent,
        componentInputs: {
          startTime: this.startTime,
          endTime: this.endTime,
          operatorId: operatorId
        }
      },
      {
        label: 'Item Stacked Chart',
        component: OperatorCountbyitemChartComponent,
        componentInputs: {
          startTime: this.startTime,
          endTime: this.endTime,
          operatorId: operatorId
        }
      },
      {
        label: 'Running/Paused/Fault Pie Chart',
        component: OperatorCyclePieChartComponent,
        componentInputs: {
          startTime: this.startTime,
          endTime: this.endTime,
          operatorId: operatorId
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
