import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  Renderer2,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatButtonModule } from "@angular/material/button";
import { FormsModule } from "@angular/forms";
import { HttpClientModule } from "@angular/common/http";
import { forkJoin } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ModalWrapperComponent } from '../components/modal-wrapper-component/modal-wrapper-component.component';
import { UseCarouselComponent } from '../use-carousel/use-carousel.component';
import { MachineFaultHistoryComponent } from '../machine-fault-history/machine-fault-history.component';
import { OperatorPerformanceChartComponent } from '../operator-performance-chart/operator-performance-chart.component';


import { DateTimePickerComponent } from "../components/date-time-picker/date-time-picker.component";
import { BaseTableComponent } from "../components/base-table/base-table.component";
import { MachineAnalyticsService } from "../services/machine-analytics.service";
import { OperatorAnalyticsService } from '../services/operator-analytics.service';
import { OperatorCountbyitemChartComponent } from "../operator-countbyitem-chart/operator-countbyitem-chart.component";
import { getStatusDotByCode } from '../../utils/status-utils';

@Component({
  selector: "app-daily-summary-dashboard",
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    DateTimePickerComponent,
    MatButtonModule,
    BaseTableComponent,
    MatDialogModule,
  ],
  templateUrl: "./daily-summary-dashboard.component.html",
  styleUrls: ["./daily-summary-dashboard.component.scss"],
})
export class DailySummaryDashboardComponent implements OnInit, OnDestroy {
  startTime: string = "";
  endTime: string = "";
  isDarkTheme: boolean = false;
  private observer!: MutationObserver;
  machineColumns: string[] = ["Status", "Machine Name", "OEE", "Total Count"];
  machineRows: any[] = [];
  selectedMachine: any = null;
  selectedRow: any | null = null;
  itemColumns: string[] = ['Item Name', 'Total Count'];
  itemRows: any[] = [];  
  operatorColumns: string[] = ['Status', 'Operator Name', 'Worked Time', 'Efficiency'];
  operatorRows: any[] = [];
  selectedOperator: any = null;
  loading: boolean = false;
  
  // Add chart dimensions and isModal property
  chartWidth: number = 1000;
  chartHeight: number = 700;
  isModal: boolean = true;

  constructor(
    private renderer: Renderer2,
    private elRef: ElementRef,
    private machineAnalyticsService: MachineAnalyticsService,
    private operatorAnalyticsService: OperatorAnalyticsService,
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
    this.observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }

  detectTheme(): void {
    const isDark = document.body.classList.contains("dark-theme");
    this.isDarkTheme = isDark;

    const element = this.elRef.nativeElement;
    this.renderer.setStyle(
      element,
      "background-color",
      isDark ? "#121212" : "#ffffff"
    );
    this.renderer.setStyle(element, "color", isDark ? "#e0e0e0" : "#000000");
  }

  fetchData(): void {
    if (!this.startTime || !this.endTime) return;
  
    const formattedStart = new Date(this.startTime).toISOString();
    const formattedEnd = new Date(this.endTime).toISOString();
  
    this.loading = true;
  
    forkJoin({
      machines: this.machineAnalyticsService.getMachinePerformance(formattedStart, formattedEnd, undefined),
      operators: this.operatorAnalyticsService.getOperatorPerformance(formattedStart, formattedEnd, undefined),
      items: this.machineAnalyticsService.getItemSummary(formattedStart, formattedEnd)
    }).subscribe({
      next: ({ machines, operators, items }) => {
        // Populate machine rows
        const machineResponses = Array.isArray(machines) ? machines : [machines];
        this.machineRows = machineResponses.map((response: any) => ({
          Status: getStatusDotByCode(response.currentStatus),
          'Machine Name': response.machine.name,
          'OEE': `${response.metrics.performance.oee.percentage}%`,
          'Total Count': response.metrics.output.totalCount,
          serial: response.machine.serial
        }));
  
        // Populate operator rows
        const operatorResponses = Array.isArray(operators) ? operators : [operators];
        this.operatorRows = operatorResponses.map((response: any) => ({
          Status: getStatusDotByCode(response.currentStatus),
          'Operator Name': response.operator.name,
          'Worked Time': `${response.metrics.runtime.formatted.hours}h ${response.metrics.runtime.formatted.minutes}m`,
          'Efficiency': `${response.metrics.performance.efficiency.percentage}%`,
          operatorId: response.operator.id
        }));
  
        // Populate item rows
        this.itemRows = items
          .filter((item: any) => item.count > 0)
          .map((item: any) => ({
            'Item Name': item.itemName,
            'Total Count': item.count
          }));
  
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching summary data:', err);
        this.loading = false;
      }
    });
  }
  
  

  fetchMachineSummaryData(): void {
    if (!this.startTime || !this.endTime) return;
  
    const formattedStart = new Date(this.startTime).toISOString();
    const formattedEnd = new Date(this.endTime).toISOString();
  
    this.machineAnalyticsService.getMachinePerformance(formattedStart, formattedEnd, undefined).subscribe((data: any) => {
      const responses = Array.isArray(data) ? data : [data];
  
      this.machineRows = responses.map((response: any) => ({
        Status: getStatusDotByCode(response.currentStatus),
        'Machine Name': response.machine.name,
        'OEE': `${response.metrics.performance.oee.percentage}%`,
        'Total Count': response.metrics.output.totalCount,
        serial: response.machine.serial // keep for row click later
      }));
    });
  }

  fetchOperatorSummaryData(): void {
    if (!this.startTime || !this.endTime) return;
  
    const formattedStart = new Date(this.startTime).toISOString();
    const formattedEnd = new Date(this.endTime).toISOString();
  
    this.operatorAnalyticsService.getOperatorPerformance(formattedStart, formattedEnd, undefined).subscribe((data: any) => {
      const responses = Array.isArray(data) ? data : [data];
  
      this.operatorRows = responses.map((response: any) => ({
        Status: getStatusDotByCode(response.currentStatus), // assumes .code
        'Operator Name': response.operator.name,
        'Worked Time': `${response.metrics.runtime.formatted.hours}h ${response.metrics.runtime.formatted.minutes}m`,
        'Efficiency': `${response.metrics.performance.efficiency.percentage}%`,
        operatorId: response.operator.id
      }));
    });
  }
  
  fetchItemSummaryData(): void {
    if (!this.startTime || !this.endTime) return;
  
    const formattedStart = new Date(this.startTime).toISOString();
    const formattedEnd = new Date(this.endTime).toISOString();
  
    this.machineAnalyticsService.getItemSummary(formattedStart, formattedEnd).subscribe({
      next: (data: any[]) => {
        this.itemRows = data
          .filter(item => item.count > 0)
          .map(item => ({
            'Item Name': item.itemName,
            'Total Count': item.count
          }));
      },
      error: (err) => {
        console.error('Error fetching item summary:', err);
      }
    });
  }
  
  

  onMachineClick(row: any): void {
    if (this.selectedRow === row) {
      this.selectedRow = null;
      return;
    }

    this.selectedRow = row;
  
    const carouselTabs = [
      {
        label: 'Fault Summaries',
        component: MachineFaultHistoryComponent,
        componentInputs: { 
          viewType: 'summary',
          startTime: this.startTime,
          endTime: this.endTime,
          machineSerial: row.serial,
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
          machineSerial: row.serial,
          isModal: this.isModal
        }
      },
      {
        label: 'Performance Chart',
        component: OperatorPerformanceChartComponent,
        componentInputs: {
          startTime: this.startTime,
          endTime: this.endTime,
          machineSerial: row.serial,
          chartWidth: this.chartWidth,
          chartHeight: this.chartHeight,
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
        machineSerial: row.serial,
        startTime: this.startTime,
        endTime: this.endTime
      }
    });
    
    dialogRef.afterClosed().subscribe(() => {
      if (this.selectedMachine === row) {
        this.selectedMachine = null;
      }
    });
  }

  onOperatorClick(row: any): void {
    this.selectedOperator = row;
  
    const dialogRef = this.dialog.open(ModalWrapperComponent, {
      width: '95vw',
      height: '90vh',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'performance-chart-dialog',
      data: {
        component: OperatorCountbyitemChartComponent,
        componentInputs: {
          operatorId: row.operatorId,
          startTime: this.startTime,
          endTime: this.endTime,
          chartWidth: this.chartWidth,
          chartHeight: this.chartHeight,
          isModal: this.isModal
        }
      }
    });
  
    dialogRef.afterClosed().subscribe(() => {
      if (this.selectedOperator === row) {
        this.selectedOperator = null;
      }
    });
  }
  
  

  // getStatusDot(status: { code: number } | undefined | null): string {
  //   const code = status?.code;
  //   if (code === 1) return '🟢';       // Running
  //   if (code === 0) return '🟡';       // Paused
  //   if (typeof code === 'number' && code > 1) return '🔴'; // Faulted
  
  //   console.warn('Unknown status code:', status);
  //   return '⚪'; // Offline or unknown
  // }
  
  
  
  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }
}
