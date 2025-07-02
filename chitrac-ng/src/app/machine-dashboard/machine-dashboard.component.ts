import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  Renderer2,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { HttpClientModule } from "@angular/common/http";
import { FormsModule } from "@angular/forms";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatDialog } from "@angular/material/dialog";
import { Subject, tap, takeUntil } from "rxjs";

import { BaseTableComponent } from "../components/base-table/base-table.component";
import { DateTimePickerComponent } from "../components/date-time-picker/date-time-picker.component";
import { MachineAnalyticsService } from "../services/machine-analytics.service";
import { PollingService } from "../services/polling-service.service";
import { DateTimeService } from "../services/date-time.service";
import { getStatusDotByCode } from "../../utils/status-utils";
import { ModalWrapperComponent } from "../components/modal-wrapper-component/modal-wrapper-component.component";
import { UseCarouselComponent } from "../use-carousel/use-carousel.component";
import { MachineItemSummaryTableComponent } from "../machine-item-summary-table/machine-item-summary-table.component";
import { MachineItemStackedBarChartComponent } from "../machine-item-stacked-bar-chart/machine-item-stacked-bar-chart.component";
import { MachineFaultHistoryComponent } from "../machine-fault-history/machine-fault-history.component";
import { OperatorPerformanceChartComponent } from "../operator-performance-chart/operator-performance-chart.component";

@Component({
    selector: "app-machine-dashboard",
    imports: [
        CommonModule,
        HttpClientModule,
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        BaseTableComponent,
        DateTimePickerComponent,
    ],
    templateUrl: "./machine-dashboard.component.html",
    styleUrls: ["./machine-dashboard.component.scss"]
})
export class MachineDashboardComponent implements OnInit, OnDestroy {
  startTime: string = "";
  endTime: string = "";
  machineData: any[] = [];
  columns: string[] = [];
  rows: any[] = [];
  selectedRow: any | null = null;
  isDarkTheme: boolean = false;
  isLoading: boolean = false;
  liveMode: boolean = false;
  responsiveHiddenColumns: { [key: number]: string[] } = {
    1210: ['Misfeed Count', 'Serial Number'],
    1024: ['Misfeed Count'],
    768: ['Misfeed Count', 'Serial Number', 'Downtime', 'Availability', 'Throughput', 'Efficiency'],
    480: ['Misfeed Count', 'Serial Number', 'Downtime', 'Throughput', 'Efficiency'],
  };
  

  private observer!: MutationObserver;
  private pollingSubscription: any;
  private destroy$ = new Subject<void>();

  chartWidth: number = 1000;
  chartHeight: number = 700;
  
  responsiveChartSizes: { [breakpoint: number]: { width: number; height: number } } = {
    1600: { width: 800, height: 700 },
    1210: { width: 700, height: 700 },
    1024: { width: 600, height: 600 },
    900: { width: 500, height: 500 },
    768: { width: 400, height: 400 },
    480: { width: 300, height: 300 },
    0: { width: 300, height: 350 }, // fallback for very small screens
  };
  
  isModal: boolean = true;

  private readonly POLLING_INTERVAL = 6000; // 6 seconds

  constructor(
    private analyticsService: MachineAnalyticsService,
    private renderer: Renderer2,
    private elRef: ElementRef,
    private dialog: MatDialog,
    private pollingService: PollingService,
    private dateTimeService: DateTimeService
  ) {}

  ngOnInit(): void {

    const isLive = this.dateTimeService.getLiveMode();
    const wasConfirmed = this.dateTimeService.getConfirmed();

    this.updateChartDimensions();
window.addEventListener('resize', this.updateChartDimensions.bind(this));

  
    if (!isLive && wasConfirmed) {
      this.startTime = this.dateTimeService.getStartTime();
      this.endTime = this.dateTimeService.getEndTime();
      this.fetchAnalyticsData();
    }
    const now = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    this.startTime = this.formatDateForInput(start);
    this.endTime = this.formatDateForInput(now);

    this.detectTheme();
    this.observer = new MutationObserver(() => this.detectTheme());
    this.observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    // Subscribe to live mode changes
    this.dateTimeService.liveMode$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isLive: boolean) => {
        this.liveMode = isLive;

        if (this.liveMode) {
          const start = new Date();
          start.setHours(0, 0, 0, 0);
          this.startTime = this.formatDateForInput(start);
          this.endTime = this.pollingService.updateEndTimestampToNow();

          this.fetchAnalyticsData();
          this.setupPolling();
        } else {
          this.stopPolling();
          this.machineData = [];
          this.rows = [];
        }
      });

    // Subscribe to confirm action
    this.dateTimeService.confirmTrigger$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.liveMode = false; // turn off polling
        this.stopPolling();

        // get times from the shared service
        this.startTime = this.dateTimeService.getStartTime();
        this.endTime = this.dateTimeService.getEndTime();

        this.fetchAnalyticsData(); // use them to fetch data
      });
  }

  ngOnDestroy(): void {
    if (this.observer) this.observer.disconnect();
    this.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener('resize', this.updateChartDimensions.bind(this));

  }

  detectTheme(): void {
    const isDark = document.body.classList.contains("dark-theme");
    this.isDarkTheme = isDark;
    const element = this.elRef.nativeElement;
    this.renderer.setStyle(element, "background-color", isDark ? "#121212" : "#ffffff");
    this.renderer.setStyle(element, "color", isDark ? "#e0e0e0" : "#000000");
  }

  private setupPolling(): void {
    if (this.liveMode) {
      // Initial data fetch
      this.analyticsService.getMachineDashboard(this.startTime, this.endTime)
        .pipe(takeUntil(this.destroy$))
        .subscribe((data: any) => {
          const responses = Array.isArray(data) ? data : [data];
          this.machineData = responses;
          const formattedData = responses.map((response) => ({
            Status: getStatusDotByCode(response.currentStatus?.code),
            "Machine Name": response.machine.name,
            "Serial Number": response.machine.serial,
            Runtime: `${response.performance.runtime.formatted.hours}h ${response.performance.runtime.formatted.minutes}m`,
            Downtime: `${response.performance.downtime.formatted.hours}h ${response.performance.downtime.formatted.minutes}m`,
            "Total Count": response.performance.output.totalCount,
            "Misfeed Count": response.performance.output.misfeedCount,
            Availability: response.performance.performance.availability.percentage,
            Throughput: response.performance.performance.throughput.percentage,
            Efficiency: response.performance.performance.efficiency.percentage,
            OEE: response.performance.performance.oee.percentage,
            
          }));
          this.columns = [
            "Status",
            "Machine Name",
            "Serial Number",
            "Runtime",
            "Downtime",
            "Total Count",
            "Misfeed Count",
            "Availability",
            "Throughput",
            "Efficiency",
            "OEE"
          ];
          
          this.rows = formattedData;
        });

      // Setup polling for subsequent updates
      this.pollingSubscription = this.pollingService.poll(
        () => {
          this.endTime = this.pollingService.updateEndTimestampToNow();
          return this.analyticsService.getMachineDashboard(this.startTime, this.endTime).pipe(
            tap((data: any) => {
              const responses = Array.isArray(data) ? data : [data];
              this.machineData = responses;
              const formattedData = responses.map((response) => ({
                Status: getStatusDotByCode(response.currentStatus?.code),
                "Machine Name": response.machine.name,
                "Serial Number": response.machine.serial,
                Runtime: `${response.performance.runtime.formatted.hours}h ${response.performance.runtime.formatted.minutes}m`,
                Downtime: `${response.performance.downtime.formatted.hours}h ${response.performance.downtime.formatted.minutes}m`,
                "Total Count": response.performance.output.totalCount,
                "Misfeed Count": response.performance.output.misfeedCount,
                Availability: `${response.performance.performance.availability.percentage}`,
                Throughput: `${response.performance.performance.throughput.percentage}`,
                Efficiency: `${response.performance.performance.efficiency.percentage}`,
                OEE: `${response.performance.performance.oee.percentage}`,
              }));
              this.columns = Object.keys(formattedData[0]);
              this.rows = formattedData;
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

  private updateChartDimensions(): void {
    const width = window.innerWidth;
  
    const breakpoints = Object.keys(this.responsiveChartSizes)
      .map(Number)
      .sort((a, b) => b - a); // sort descending
  
    for (const bp of breakpoints) {
      if (width >= bp) {
        this.chartWidth = this.responsiveChartSizes[bp].width;
        this.chartHeight = this.responsiveChartSizes[bp].height;
        return;
      }
    }
  }
  

  fetchAnalyticsData(): void {
    if (!this.startTime || !this.endTime) return;

    this.isLoading = true;
    this.analyticsService.getMachineDashboard(this.startTime, this.endTime).subscribe({
      next: (data: any) => {
        const responses = Array.isArray(data) ? data : [data];
        this.machineData = responses;

        const formattedData = responses.map((response) => ({
          Status: getStatusDotByCode(response.currentStatus?.code),
          "Machine Name": response.machine.name,
          "Serial Number": response.machine.serial,
          Runtime: `${response.performance.runtime.formatted.hours}h ${response.performance.runtime.formatted.minutes}m`,
          Downtime: `${response.performance.downtime.formatted.hours}h ${response.performance.downtime.formatted.minutes}m`,
          "Total Count": response.performance.output.totalCount,
          "Misfeed Count": response.performance.output.misfeedCount,
          Availability: response.performance.performance.availability.percentage,
          Throughput: response.performance.performance.throughput.percentage,
          Efficiency: response.performance.performance.efficiency.percentage,
          OEE: response.performance.performance.oee.percentage,
          
        }));

        const allColumns = Object.keys(formattedData[0]);
        const columnsToHide: string[] = [""];
        this.columns = allColumns.filter(col => !columnsToHide.includes(col));
        this.rows = formattedData;
        this.isLoading = false;
      },
      error: (err) => {
        console.error("Error fetching dashboard data:", err);
        this.isLoading = false;
      },
    });
  }

  onRowClick(row: any): void {
    if (this.selectedRow === row) {
      this.selectedRow = null;
      return;
    }

    this.selectedRow = row;
    setTimeout(() => {
      const element = document.querySelector(".mat-row.selected");
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);

    const machineSerial = row["Serial Number"];
    const machineData = this.machineData.find((m: any) => m.machine?.serial === machineSerial);
    if (!machineData) return;

    const itemSummaryData = machineData.itemSummary?.machineSummary?.itemSummaries || [];
    const faultSummaryData = machineData.faultData?.faultSummaries || [];
    const faultCycleData = machineData.faultData?.faultCycles || [];

    const carouselTabs = [
      {
        label: "Item Summary",
        component: MachineItemSummaryTableComponent,
        componentInputs: {
          startTime: this.startTime,
          endTime: this.endTime,
          selectedMachineSerial: machineSerial,
          itemSummaryData,
          isModal: this.isModal,
        },
      },
      {
        label: "Item Stacked Chart",
        component: MachineItemStackedBarChartComponent,
        componentInputs: {
          startTime: this.startTime,
          endTime: this.endTime,
          machineSerial,
          chartWidth: this.chartWidth,
          chartHeight: this.chartHeight,
          isModal: this.isModal,
          mode: "dashboard",
          preloadedData: machineData.itemHourlyStack,
        },
      },
      {
        label: "Fault Summaries",
        component: MachineFaultHistoryComponent,
        componentInputs: {
          viewType: "summary",
          startTime: this.startTime,
          endTime: this.endTime,
          machineSerial,
          isModal: this.isModal,
          preloadedData: faultSummaryData,
        },
      },
      {
        label: "Fault Cycles",
        component: MachineFaultHistoryComponent,
        componentInputs: {
          viewType: "cycles",
          startTime: this.startTime,
          endTime: this.endTime,
          machineSerial,
          isModal: this.isModal,
          preloadedData: faultCycleData,
        },
      },
      {
        label: "Performance Chart",
        component: OperatorPerformanceChartComponent,
        componentInputs: {
          startTime: this.startTime,
          endTime: this.endTime,
          machineSerial,
          chartWidth: this.chartWidth,
          chartHeight: this.chartHeight,
          isModal: this.isModal,
          mode: "dashboard",
          preloadedData: {
            machine: {
              serial: machineSerial,
              name: machineData.machine?.name ?? "Unknown",
            },
            timeRange: {
              start: this.startTime,
              end: this.endTime,
            },
            hourlyData: machineData.operatorEfficiency ?? [],
          },
        },
      },
    ];

    const dialogRef = this.dialog.open(ModalWrapperComponent, {
      width: "95vw",
      height: "90vh",
      maxHeight: "90vh",
      maxWidth: "95vw",
      panelClass: "custom-modal-panel", 
      backdropClass: "custom-modal-backdrop", 
      data: {
        component: UseCarouselComponent,
        componentInputs: {
          tabData: carouselTabs,
        },
        machineSerial,
        startTime: this.startTime,
        endTime: this.endTime,
      },
    });
    
    

    dialogRef.afterClosed().subscribe(() => {
      if (this.selectedRow === row) this.selectedRow = null;
    });
  }

  getEfficiencyClass(value: any): string {
    if (typeof value !== "string" || !value.includes("%")) return "";
    const num = parseInt(value.replace("%", ""));
    if (isNaN(num)) return "";
    if (num >= 90) return "green";
    if (num >= 70) return "yellow";
    return "red";
  }

  private formatDateForInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d}T${h}:${min}`;
  }
}
