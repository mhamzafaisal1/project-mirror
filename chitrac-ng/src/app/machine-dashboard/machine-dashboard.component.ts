import { Component, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';

import { BaseTableComponent } from '../components/base-table/base-table.component';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';
import { MachineAnalyticsService } from '../services/machine-analytics.service';
import { getStatusDotByCode } from '../../utils/status-utils';
import { ModalWrapperComponent } from '../components/modal-wrapper-component/modal-wrapper-component.component';
import { UseCarouselComponent } from '../use-carousel/use-carousel.component';
import { MachineItemSummaryTableComponent } from '../machine-item-summary-table/machine-item-summary-table.component';
import { MachineItemStackedBarChartComponent } from '../machine-item-stacked-bar-chart/machine-item-stacked-bar-chart.component';
import { MachineFaultHistoryComponent } from '../machine-fault-history/machine-fault-history.component';
import { OperatorPerformanceChartComponent } from '../operator-performance-chart/operator-performance-chart.component';

@Component({
  selector: 'app-machine-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    BaseTableComponent,
    DateTimePickerComponent
  ],
  templateUrl: './machine-dashboard.component.html',
  styleUrls: ['./machine-dashboard.component.scss']
})
export class MachineDashboardComponent implements OnInit, OnDestroy {
  startTime: string = '';
  endTime: string = '';
  machineData: any[] = [];
  columns: string[] = [];
  rows: any[] = [];
  selectedRow: any | null = null;
  isDarkTheme: boolean = false;
  isLoading: boolean = false;
  private observer!: MutationObserver;

  // Add chart dimensions
  chartWidth: number = 1000;
  chartHeight: number = 700;
  isModal: boolean = true;  // New property for modal context

  constructor(
    private analyticsService: MachineAnalyticsService,
    private renderer: Renderer2,
    private elRef: ElementRef,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    const end = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    this.endTime = this.formatDateForInput(end);
    this.startTime = this.formatDateForInput(start);

    this.detectTheme();

    this.observer = new MutationObserver(() => {
      this.detectTheme();
    });
    this.observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  ngOnDestroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  detectTheme() {
    const isDark = document.body.classList.contains('dark-theme');
    this.isDarkTheme = isDark;

    const element = this.elRef.nativeElement;
    this.renderer.setStyle(element, 'background-color', isDark ? '#121212' : '#ffffff');
    this.renderer.setStyle(element, 'color', isDark ? '#e0e0e0' : '#000000');
  }

  fetchAnalyticsData(): void {
    if (!this.startTime || !this.endTime) return;

    this.isLoading = true;
    this.analyticsService.getMachineDashboard(this.startTime, this.endTime)
      .subscribe({
        next: (data: any) => {
          const responses = Array.isArray(data) ? data : [data];
          
          // Store the raw data for later use
          this.machineData = responses;

          const formattedData = responses.map(response => ({
            'Status': getStatusDotByCode(response.currentStatus?.code),
            'Machine Name': response.machine.name,
            'Serial Number': response.machine.serial,
            'Runtime': `${response.performance.runtime.formatted.hours}h ${response.performance.runtime.formatted.minutes}m`,
            'Downtime': `${response.performance.downtime.formatted.hours}h ${response.performance.downtime.formatted.minutes}m`,
            'Total Count': response.performance.output.totalCount,
            'Misfeed Count': response.performance.output.misfeedCount,
            'Availability': `${response.performance.performance.availability.percentage}%`,
            'Throughput': `${response.performance.performance.throughput.percentage}%`,
            'Efficiency': `${response.performance.performance.efficiency.percentage}%`,
            'OEE': `${response.performance.performance.oee.percentage}%`
          }));

          const allColumns = Object.keys(formattedData[0]);
          const columnsToHide = ['Serial Number'];
          this.columns = allColumns.filter(col => !columnsToHide.includes(col));

          this.rows = formattedData;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error fetching dashboard data:', error);
          this.isLoading = false;
        }
      });
  }

  onRowClick(row: any): void {
    if (this.selectedRow === row) {
      this.selectedRow = null;
      return;
    }

    this.selectedRow = row;

    setTimeout(() => {
      const element = document.querySelector('.mat-row.selected');
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);

    // Find the machine data from the API response
    const machineData = this.machineData?.find((m: any) => m.machine?.serial === row['Serial Number']);
    const itemSummaryData = machineData?.itemSummary?.machineSummary?.itemSummaries;

    console.log('Machine Data:', machineData);
    console.log('Item Summary Data:', itemSummaryData);

    const carouselTabs = [
      { 
        label: 'Item Summary', 
        component: MachineItemSummaryTableComponent,
        componentInputs: {
          startTime: this.startTime,
          endTime: this.endTime,
          selectedMachineSerial: row['Serial Number'],
          itemSummaryData: itemSummaryData,
          isModal: this.isModal
        }
      },
      { 
        label: 'Item Stacked Chart', 
        component: MachineItemStackedBarChartComponent,
        componentInputs: {
          startTime: this.startTime,
          endTime: this.endTime,
          machineSerial: row['Serial Number'],
          chartWidth: this.chartWidth,
          chartHeight: this.chartHeight,
          isModal: this.isModal
        }
      },
      { 
        label: 'Fault Summaries', 
        component: MachineFaultHistoryComponent,
        componentInputs: {
          viewType: 'summary',
          startTime: this.startTime,
          endTime: this.endTime,
          machineSerial: row['Serial Number'],
          isModal: this.isModal
        }
      },
      { 
        label: 'Fault Cycles', 
        component: MachineFaultHistoryComponent,
        componentInputs: {
          viewType: 'cycles',
          startTime: this.startTime,
          endTime: this.endTime,
          machineSerial: row['Serial Number'],
          isModal: this.isModal
        }
      },
      { 
        label: 'Performance Chart', 
        component: OperatorPerformanceChartComponent,
        componentInputs: {
          startTime: this.startTime,
          endTime: this.endTime,
          machineSerial: row['Serial Number'],
          chartWidth: (this.chartWidth),
          chartHeight: (this.chartHeight),
          isModal: this.isModal
        }
      }
    ];

    const dialogRef = this.dialog.open(ModalWrapperComponent, {
      width: '95vw',
      height: '90vh',
      maxHeight: '90vh',
      maxWidth: '95vw',
      panelClass: 'performance-chart-dialog',
      data: {
        component: UseCarouselComponent,
        componentInputs: {
          tabData: carouselTabs
        },
        machineSerial: row['Serial Number'],
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

  getEfficiencyClass(value: any): string {
    if (typeof value !== 'string' || !value.includes('%')) return '';

    const num = parseInt(value.replace('%', ''));
    if (isNaN(num)) return '';

    if (num >= 90) return 'green';
    if (num >= 70) return 'yellow';
    return 'red';
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}
