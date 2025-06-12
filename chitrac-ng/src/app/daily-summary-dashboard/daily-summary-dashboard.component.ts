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
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Subject, takeUntil, tap } from 'rxjs';

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
import { DailyDashboardService } from '../services/daily-dashboard.service';
import { PollingService } from '../services/polling-service.service';
import { DateTimeService } from '../services/date-time.service';

@Component({
    selector: "app-daily-summary-dashboard",
    imports: [
        CommonModule,
        HttpClientModule,
        FormsModule,
        DateTimePickerComponent,
        MatButtonModule,
        MatIconModule,
        MatSlideToggleModule,
        BaseTableComponent,
        MatDialogModule,
    ],
    templateUrl: "./daily-summary-dashboard.component.html",
    styleUrls: ["./daily-summary-dashboard.component.scss"]
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
  isLoading: boolean = false;
  liveMode: boolean = false;
  rawMachineData: any[] = []; // store full API response for machines
  rawOperatorData: any[] = []; // store full API response for operators
  private pollingSubscription: any;
  private destroy$ = new Subject<void>();
  private readonly POLLING_INTERVAL = 6000; // 6 seconds

  // Add chart dimensions and isModal property
  chartWidth: number = 1000;
  chartHeight: number = 700;
  isModal: boolean = true;

  constructor(
    private renderer: Renderer2,
    private elRef: ElementRef,
    private dailyDashboardService: DailyDashboardService,
    private dialog: MatDialog,
    private pollingService: PollingService,
    private dateTimeService: DateTimeService
  ) {}

  ngOnInit(): void {

    const isLive = this.dateTimeService.getLiveMode();
    const wasConfirmed = this.dateTimeService.getConfirmed();
  
    if (!isLive && wasConfirmed) {
      this.startTime = this.dateTimeService.getStartTime();
      this.endTime = this.dateTimeService.getEndTime();
      this.fetchData();
    }

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

    // Subscribe to live mode changes
    this.dateTimeService.liveMode$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(isLive => {
      this.liveMode = isLive;
      if (isLive) {
        // Reset startTime to today at 00:00
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        this.startTime = this.formatDateForInput(start);
        this.dateTimeService.setStartTime(this.startTime);

        // Reset endTime to now
        this.endTime = this.pollingService.updateEndTimestampToNow();
        this.dateTimeService.setEndTime(this.endTime);

        // Initial data fetch
        this.fetchData();
        this.setupPolling();
      } else {
        this.stopPolling();
        this.clearData();
      }
    });

    // Subscribe to confirm trigger
    this.dateTimeService.confirmTrigger$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.liveMode = false; // turn off polling
      this.stopPolling();

      // get times from the shared service
      this.startTime = this.dateTimeService.getStartTime();
      this.endTime = this.dateTimeService.getEndTime();

      this.fetchData(); // use them to fetch data
    });
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.destroy$.next();
    this.destroy$.complete();
    this.stopPolling();
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

  private setupPolling(): void {
    if (this.liveMode) {
      // Initial data fetch
      this.dailyDashboardService.getDailySummaryDashboard(this.startTime, this.endTime)
        .pipe(takeUntil(this.destroy$))
        .subscribe((data: any) => {
          this.updateDashboardData(data);
        });

      // Setup polling for subsequent updates
      this.pollingSubscription = this.pollingService.poll(
        () => {
          this.endTime = this.pollingService.updateEndTimestampToNow();
          this.dateTimeService.setEndTime(this.endTime);
          return this.dailyDashboardService.getDailySummaryDashboard(this.startTime, this.endTime)
            .pipe(
              tap((data: any) => {
                this.updateDashboardData(data);
              })
            );
        },
        this.POLLING_INTERVAL,
        this.destroy$
      ).subscribe();
    }
  }

  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  private clearData(): void {
    this.rawMachineData = [];
    this.rawOperatorData = [];
    this.machineRows = [];
    this.operatorRows = [];
    this.itemRows = [];
  }

  private updateDashboardData(data: any): void {
    this.rawMachineData = data.machineResults || [];
    this.rawOperatorData = data.operatorResults || [];

    //Machines
    this.machineRows = this.rawMachineData.map((response: any) => ({
      Status: getStatusDotByCode(response.currentStatus?.code),
      'Machine Name': response.machine?.name ?? 'Unknown',
      'OEE': response.performance?.performance?.oee?.percentage ?? '0%',
      'Total Count': response.performance?.output?.totalCount ?? 0,
      serial: response.machine?.serial
    }));

    // Operators
    this.operatorRows = this.rawOperatorData.map((response: any) => ({
      Status: getStatusDotByCode(response.currentStatus?.code),
      'Operator Name': response.operator?.name ?? 'Unknown',
      'Worked Time': `${response.metrics?.runtime?.formatted?.hours ?? 0}h ${response.metrics?.runtime?.formatted?.minutes ?? 0}m`,
      'Efficiency': response.metrics?.performance?.efficiency?.percentage ?? '0%',
      operatorId: response.operator?.id
    }));

    // Items
    this.itemRows = (data.items || [])
      .filter((item: any) => item.count > 0)
      .map((item: any) => ({
        'Item Name': item.itemName,
        'Total Count': item.count
      }));
  }

  fetchData(): void {
    if (!this.startTime || !this.endTime) return;
  
    const formattedStart = new Date(this.startTime).toISOString();
    const formattedEnd = new Date(this.endTime).toISOString();
  
    this.isLoading = true;
  
    this.dailyDashboardService.getDailySummaryDashboard(formattedStart, formattedEnd)
      .subscribe({
        next: (data: any) => {
          this.updateDashboardData(data);
          this.isLoading = false;
        },
        error: (err: any) => {
          console.error('Error fetching summary data:', err);
          this.isLoading = false;
        }
      });
  }

  onDateChange(): void {
    this.dateTimeService.setStartTime(this.startTime);
    this.dateTimeService.setEndTime(this.endTime);
    this.dateTimeService.setLiveMode(false);
    this.stopPolling();
    this.clearData();
  }

  getPercentageSafe(value: any): string {
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(num)) return '0%';
    return `${(num * 100).toFixed(2)}%`;
  }
  
  
  

  onMachineClick(row: any): void {
    if (this.selectedRow === row) {
      this.selectedRow = null;
      return;
    }
  
    this.selectedRow = row;
  
    const serial = row.serial;
    const fullMachineData = this.rawMachineData.find((m: any) => m.machine?.serial === serial);
    if (!fullMachineData) {
      console.warn('Machine data not found for serial:', serial);
      return;
    }
  
    const faultSummaries = fullMachineData.faultData?.faultSummaries || [];
    const faultCycles = fullMachineData.faultData?.faultCycles || [];
  
    const carouselTabs = [
      {
        label: 'Fault Summaries',
        component: MachineFaultHistoryComponent,
        componentInputs: {
          viewType: 'summary',
          mode: 'dashboard',
          preloadedData: faultSummaries,
          isModal: this.isModal,
          startTime: this.startTime,
          endTime: this.endTime,
          serial: serial.toString()
        }
      },
      {
        label: 'Fault Cycles',
        component: MachineFaultHistoryComponent,
        componentInputs: {
          viewType: 'cycles',
          mode: 'dashboard',
          preloadedData: faultCycles,
          isModal: this.isModal,
          startTime: this.startTime,
          endTime: this.endTime,
          serial: serial.toString()
        }
      },
      {
        label: 'Performance Chart',
        component: OperatorPerformanceChartComponent,
        componentInputs: {
          startTime: this.startTime,
          endTime: this.endTime,
          machineSerial: serial,
          chartWidth: this.chartWidth,
          chartHeight: this.chartHeight,
          isModal: this.isModal,
          mode: 'dashboard',
          preloadedData: {
            machine: {
              serial: serial,
              name: fullMachineData.machine?.name ?? 'Unknown'
            },
            timeRange: {
              start: this.startTime,
              end: this.endTime
            },
            hourlyData: fullMachineData.operatorEfficiency ?? []
          }
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
        machineSerial: serial,
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
          isModal: this.isModal,
          mode: 'dashboard',
          dashboardData: this.rawOperatorData
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

  // Add this helper for dynamic color coding
  getPerformanceClass(value: any, column?: string): string {
    if (column !== 'OEE' && column !== 'Efficiency') return '';
    let num = value;
    if (typeof value === 'string') {
      num = parseFloat(value.replace('%', ''));
    }
    if (isNaN(num)) return '';
    if (num >= 85) return 'green';
    if (num >= 60) return 'yellow';
    return 'red';
  }
  
}
