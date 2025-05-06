import { Component, OnInit, OnDestroy, ElementRef, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


import { BaseTableComponent } from '../components/base-table/base-table.component';
import { MachineAnalyticsService } from '../services/machine-analytics.service';
import { ModalWrapperComponent } from '../components/modal-wrapper-component/modal-wrapper-component.component';
import { UseCarouselComponent } from '../use-carousel/use-carousel.component';
import { MachineFaultHistoryComponent } from '../machine-fault-history/machine-fault-history.component';
import { OperatorPerformanceChartComponent } from '../operator-performance-chart/operator-performance-chart.component';
import { DateTimePickerComponent } from '../components/date-time-picker/date-time-picker.component';

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
    BaseTableComponent,
    DateTimePickerComponent
  ],
  templateUrl: './machine-analytics-dashboard.component.html',
  styleUrls: ['./machine-analytics-dashboard.component.scss']
})
export class MachineAnalyticsDashboardComponent implements OnInit, OnDestroy {
  startTime: string = '';
  endTime: string = '';
  columns: string[] = [];
  rows: any[] = [];
  selectedRow: any | null = null;
  isDarkTheme: boolean = false;
  private observer!: MutationObserver;

  constructor(
    private analyticsService: MachineAnalyticsService,
    private dialog: MatDialog,
    private renderer: Renderer2,
    private elRef: ElementRef
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

    this.fetchAnalyticsData();
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

    this.analyticsService.getMachinePerformance(this.startTime, this.endTime, undefined)
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

        const allColumns = Object.keys(formattedData[0]);
        const columnsToHide = ['Serial Number', 'Time Range'];
        this.columns = allColumns.filter(col => !columnsToHide.includes(col));

        this.rows = formattedData;
      });
  }

  //Orignal downloadPdf function with no omition.

  // downloadPdf(): void {
  //   const doc = new jsPDF();
  
  //   const tableColumnTitles = this.columns;
  //   const tableRows = this.rows.map(row =>
  //     this.columns.map(col => row[col] ?? '')
  //   );
  
  //   doc.text('Machine Analytics Report', 14, 16);
  //   autoTable(doc, {
  //     startY: 20,
  //     head: [tableColumnTitles],
  //     body: tableRows,
  //     styles: { fontSize: 8 }
  //   });
  
  //   doc.save('machine_analytics_report.pdf');
  // }

  downloadPdf(): void {
    const doc = new jsPDF();
  
    const tableColumnTitles = this.columns.map(col => col === 'Status' ? '' : col); // keep column name blank
  
    const tableRows = this.rows.map(row =>
      this.columns.map(col => col === 'Status' ? '' : row[col] ?? '')
    );
  
    doc.text('Machine Analytics Report', 14, 16);
    autoTable(doc, {
      startY: 20,
      head: [tableColumnTitles],
      body: tableRows,
      styles: { fontSize: 8 }
    });
  
    doc.save('machine_analytics_report.pdf');
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

    const carouselTabs = [
      { 
        label: 'Fault Summaries', 
        component: MachineFaultHistoryComponent,
        componentInputs: {
          viewType: 'summary'
        }
      },
      { 
        label: 'Fault Cycles', 
        component: MachineFaultHistoryComponent,
        componentInputs: {
          viewType: 'cycles'
        }
      },
      { 
        label: 'Performance Chart', 
        component: OperatorPerformanceChartComponent 
      }
    ];

    const dialogRef = this.dialog.open(ModalWrapperComponent, {
      width: '90vw',
      height: '80vh',
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

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}
