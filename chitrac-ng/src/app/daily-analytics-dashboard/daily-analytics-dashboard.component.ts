import { Component, OnInit, Renderer2, ElementRef, Input, OnDestroy } from "@angular/core";
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from "@angular/common";
import { DailyDashboardService } from "../services/daily-dashboard.service";
import { DateTimePickerComponent } from "../components/date-time-picker/date-time-picker.component";
import { ChartTileComponent } from "../components/chart-tile/chart-tile.component";
import { PollingService } from "../services/polling-service.service";
import { Subject, Observable } from "rxjs";
import { takeUntil, tap } from "rxjs/operators";
import { FormsModule } from '@angular/forms';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { DailyMachineStackedBarChartComponent } from "../daily-machine-stacked-bar-chart/daily-machine-stacked-bar-chart.component";
import { DailyMachineOeeBarChartComponent } from "../daily-machine-oee-bar-chart/daily-machine-oee-bar-chart.component";
import { DailyMachineItemStackedBarChartComponent } from "../daily-machine-item-stacked-bar-chart/daily-machine-item-stacked-bar-chart.component";
import { DailyCountBarChartComponent } from "../daily-count-bar-chart/daily-count-bar-chart.component";
import { RankedOperatorBarChartComponent } from "../ranked-operator-bar-chart/ranked-operator-bar-chart.component";
import { PlantwideMetricsChartComponent } from "../plantwide-metrics-chart/plantwide-metrics-chart.component";

// Required for dynamic input support
import { ComponentOutletInjectorModule, DynamicIoDirective } from 'ng-dynamic-component';
import { MatButtonModule } from '@angular/material/button';
@Component({
    selector: 'app-daily-analytics-dashboard',
    imports: [
        CommonModule,
        DateTimePickerComponent,
        ChartTileComponent,
        DailyMachineStackedBarChartComponent,
        DailyMachineOeeBarChartComponent,
        DailyMachineItemStackedBarChartComponent,
        RankedOperatorBarChartComponent,
        PlantwideMetricsChartComponent,
        ComponentOutletInjectorModule,
        DynamicIoDirective,
        MatIconModule,
        MatButtonModule,
        FormsModule,
        MatSlideToggleModule
    ],
    templateUrl: './daily-analytics-dashboard.component.html',
    styleUrls: ['./daily-analytics-dashboard.component.scss']
})
export class DailyAnalyticsDashboardComponent implements OnInit, OnDestroy {
  startTime: string = '';
  endTime: string = '';
  isDarkTheme: boolean = false;
  liveMode: boolean = false;
  loading: boolean = false;
  private pollingSubscription: any;

  fullDashboardData: any = null;
  hasInitialData: boolean = false;

  chartWidth: number = 600;
  chartHeight: number = 450;

  chartComponents = [
    {
      component: DailyMachineStackedBarChartComponent,
      title: 'Machine Run/Pause/Fault Time',
      icon: 'bar_chart',
      dataKey: 'machineStatus'
    },
    {
      component: DailyMachineOeeBarChartComponent,
      title: 'Machine OEE',
      icon: 'insights',
      dataKey: 'machineOee'
    },
    {
      component: DailyMachineItemStackedBarChartComponent,
      title: 'Machine Item Stacked Bar',
      icon: 'stacked_bar_chart',
      dataKey: 'itemHourlyStack'
    },
    {
      component: DailyCountBarChartComponent,
      title: 'Daily Plantwide Count Totals',
      icon: 'calendar_view_day',
      dataKey: 'dailyCounts'
    },
    {
      component: RankedOperatorBarChartComponent,
      title: 'Top Operator Efficiency',
      icon: 'leaderboard',
      dataKey: 'topOperators'
    },
    {
      component: PlantwideMetricsChartComponent,
      title: 'Plantwide Metrics by Hour',
      icon: 'trending_up',
      dataKey: 'plantwideMetrics',
      // chartWidth and chartHeight will be passed via ndcDynamicInputs in the template
    }
    // Future charts:
    // { component: ..., title: ..., icon: ..., dataKey: ... }
  ];

  private destroy$ = new Subject<void>();
  private readonly POLLING_INTERVAL = 6000; // 6 seconds

  constructor(
    private dashboardService: DailyDashboardService,
    private renderer: Renderer2,
    private elRef: ElementRef,
    private pollingService: PollingService
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    this.startTime = this.formatDateForInput(start);
    this.endTime = this.formatDateForInput(now);
    this.detectTheme();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopPolling();
  }

  private setupPolling(): void {
    if (this.liveMode) {
      // Initial data fetch
      this.dashboardService.getFullDailyDashboard(this.startTime, this.endTime)
        .pipe(takeUntil(this.destroy$))
        .subscribe(data => {
          this.fullDashboardData = data;
          this.hasInitialData = true;
        });

      // Setup polling for subsequent updates
      this.pollingSubscription = this.pollingService.poll(
        () => {
          this.endTime = this.pollingService.updateEndTimestampToNow();
          return this.dashboardService.getFullDailyDashboard(this.startTime, this.endTime)
            .pipe(
              tap(data => {
                this.fullDashboardData = data;
                this.hasInitialData = true;
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

  onLiveModeChange(checked: boolean): void {
    this.liveMode = checked;
  
    if (this.liveMode) {
      // Reset startTime to today at 00:00
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      this.startTime = this.formatDateForInput(start);
  
      // Reset endTime to now
      this.endTime = this.pollingService.updateEndTimestampToNow();
  
      // Initial data fetch without loading state
      this.dashboardService.getFullDailyDashboard(this.startTime, this.endTime)
        .pipe(takeUntil(this.destroy$))
        .subscribe(data => {
          this.fullDashboardData = data;
          this.hasInitialData = true;
        });
      
      this.setupPolling();
    } else {
      this.stopPolling();
      // Clear the dashboard data when live mode is turned off
      this.hasInitialData = false;
      this.fullDashboardData = null;
    }
  }
  

  onDateChange(): void {
    if (this.liveMode) {
      this.liveMode = false;
      this.stopPolling();
    }
  
    // Clear previously loaded data so charts disappear until "Fetch Data" is clicked
    this.hasInitialData = false;
    this.fullDashboardData = null;
  }
  

  fetchDashboardData(): Observable<any> {
    if (!this.startTime || !this.endTime) {
      return new Observable();
    }
  
    // Set loading state for manual data fetching
    this.loading = true;
  
    return this.dashboardService.getFullDailyDashboard(this.startTime, this.endTime)
      .pipe(
        takeUntil(this.destroy$),
        tap({
          next: (data) => {
            this.fullDashboardData = data;
            this.hasInitialData = true;
            this.loading = false;
          },
          error: () => {
            this.loading = false;
          }
        })
      );
  }
  

  detectTheme() {
    const isDark = document.body.classList.contains('dark-theme');
    this.isDarkTheme = isDark;
    const el = this.elRef.nativeElement;
    this.renderer.setStyle(el, 'background-color', isDark ? '#121212' : '#ffffff');
    this.renderer.setStyle(el, 'color', isDark ? '#e0e0e0' : '#000000');
  }

  private formatDateForInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}`;
  }
}