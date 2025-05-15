import { Component, OnInit, Renderer2, ElementRef, Input } from "@angular/core";
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from "@angular/common";
import { DailyDashboardService } from "../services/daily-dashboard.service";
import { DateTimePickerComponent } from "../components/date-time-picker/date-time-picker.component";
import { ChartTileComponent } from "../components/chart-tile/chart-tile.component";

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
  standalone: true,
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
    MatButtonModule
  ],
  templateUrl: './daily-analytics-dashboard.component.html',
  styleUrls: ['./daily-analytics-dashboard.component.scss']
})
export class DailyAnalyticsDashboardComponent implements OnInit {
  startTime: string = '';
  endTime: string = '';
  isDarkTheme: boolean = false;

  fullDashboardData: any = null;

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
      dataKey: 'plantwideMetrics'
    }
    // Future charts:
    // { component: ..., title: ..., icon: ..., dataKey: ... }
  ];

  constructor(
    private dashboardService: DailyDashboardService,
    private renderer: Renderer2,
    private elRef: ElementRef
  ) {}

  ngOnInit(): void {
    const now = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    this.startTime = this.formatDateForInput(start);
    this.endTime = this.formatDateForInput(now);
    this.detectTheme();
  }

  detectTheme() {
    const isDark = document.body.classList.contains('dark-theme');
    this.isDarkTheme = isDark;
    const el = this.elRef.nativeElement;
    this.renderer.setStyle(el, 'background-color', isDark ? '#121212' : '#ffffff');
    this.renderer.setStyle(el, 'color', isDark ? '#e0e0e0' : '#000000');
  }

  fetchDashboardData() {
    if (!this.startTime || !this.endTime) return;
    this.dashboardService.getFullDailyDashboard(this.startTime, this.endTime)
      .subscribe(data => {
        this.fullDashboardData = data;
      });
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
